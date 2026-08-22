import { describe, expect, it } from "vitest";
import { runExtractionEngine } from "@/engines/extraction";

describe("runExtractionEngine", () => {
  it("extrae función pulmonar (FEV1/FVC/DLCO)", () => {
    const events = runExtractionEngine("FEV1 78%. FVC 85%. DLCO 70%.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1Percent: 78, FVCPercent: 85, DLCOPercent: 70 });
  });

  it("extrae un microorganismo con sensibilidad", () => {
    const events = runExtractionEngine("Cultivo de esputo con Pseudomonas aeruginosa, sensible a ciprofloxacino.", "2024-01-01");
    const micro = events.find((e) => e.type === "microbiology");
    expect(micro).toMatchObject({ organism: "Pseudomonas aeruginosa" });
    if (micro?.type === "microbiology") {
      expect(micro.sensitivity[0]).toContain("ciprofloxacino");
    }
  });

  it("detecta una exacerbación explícita", () => {
    const events = runExtractionEngine("Presenta una exacerbación moderada.", "2024-01-01");
    const exac = events.find((e) => e.type === "exacerbation");
    expect(exac).toBeDefined();
    expect(exac?.confidence).toBe("confirmado");
  });

  it("detecta una posible exacerbación por signos + antibiótico sin usar la palabra 'exacerbación'", () => {
    const events = runExtractionEngine("Refiere mayor disnea y se pauta ciprofloxacino.", "2024-01-01");
    const exac = events.find((e) => e.type === "exacerbation");
    expect(exac?.confidence).toBe("posible");
    expect(exac?.confidenceReason).toMatch(/exacerbaci/i);
  });

  it("detecta hospitalización cuando no hay exacerbación explícita ni signos+antibiótico", () => {
    const events = runExtractionEngine("Ingreso programado para estudio.", "2024-01-01");
    expect(events.some((e) => e.type === "hospitalization")).toBe(true);
  });

  it("detecta inicio de tratamiento con dosis de 1 dígito y pauta", () => {
    const events = runExtractionEngine("Se inicia prednisona 5 mg lunes, miércoles y viernes.", "2024-01-01");
    const treatment = events.find((e) => e.type === "treatment_started");
    expect(treatment).toMatchObject({ drug: "prednisona", dose: "5 mg" });
    if (treatment?.type === "treatment_started") {
      expect(treatment.schedule).toContain("lunes");
    }
  });

  it("BUG heredado del prototipo (no corregido): trunca dosis de 2+ dígitos a su último dígito", () => {
    // El regex de dosis `${drug}[^.]{0,6}(\d+\s?mg)` hace backtracking voraz
    // y se come todos los dígitos de la dosis salvo el último antes de que
    // el grupo capturador entre en juego. Este test fija el comportamiento
    // ACTUAL (incorrecto) como regresión intencionada — ver comentario en
    // engines/extraction/index.ts. No se corrige en esta fase.
    const events = runExtractionEngine("Se inicia azitromicina 250 mg lunes, miércoles y viernes.", "2024-01-01");
    const treatment = events.find((e) => e.type === "treatment_started");
    expect(treatment).toMatchObject({ drug: "azitromicina", dose: "0 mg" });
  });

  it("clasifica oxígeno/VMNI como soporte respiratorio, no tratamiento farmacológico", () => {
    const events = runExtractionEngine("Se inicia oxígeno domiciliario.", "2024-01-01");
    expect(events.some((e) => e.type === "respiratory_support")).toBe(true);
    expect(events.some((e) => e.type === "treatment_started")).toBe(false);
  });

  it("detecta la retirada de un tratamiento", () => {
    const events = runExtractionEngine("Se retira prednisona por buena evolución.", "2024-01-01");
    expect(events.some((e) => e.type === "treatment_stopped")).toBe(true);
  });

  it("fecha todos los eventos detectados con la fecha de la consulta (limitación conocida)", () => {
    const events = runExtractionEngine("FEV1 78%. Exacerbación en enero de 2023.", "2024-06-01");
    expect(events.every((e) => e.date === "2024-06-01")).toBe(true);
  });
});
