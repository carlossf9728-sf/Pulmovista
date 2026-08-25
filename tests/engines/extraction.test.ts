import { describe, expect, it } from "vitest";
import { runExtractionEngine } from "@/engines/extraction";

describe("runExtractionEngine", () => {
  it("extrae función pulmonar (FEV1/FVC/DLCO)", () => {
    const events = runExtractionEngine("FEV1 78%. FVC 85%. DLCO 70%.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1Percent: 78, FVCPercent: 85, DLCOPercent: 70 });
  });

  it("extrae el z-score de FEV1, FVC y FEV1/FVC por separado, y nunca el z-score de DLCO (no se toca)", () => {
    const events = runExtractionEngine(
      "FEV1 68%, z-score -1.9. FVC 76%, z-score -1.7. FEV1/FVC 74%, z-score -1.1. DLCO 65%.",
      "2024-01-01",
    );
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({
      FEV1Percent: 68,
      FEV1zScore: -1.9,
      FVCPercent: 76,
      FVCzScore: -1.7,
      FEV1FVCRatio: 74,
      FEV1FVCzScore: -1.1,
      DLCOPercent: 65,
    });
    // El tipo PulmonaryFunctionEvent no tiene ningún campo de z-score para DLCO — no hay nada que verificar ahí más allá de que no exista el campo.
    expect(pft && "DLCOzScore" in pft).toBe(false);
  });

  it("no confunde 'FEV1/FVC' con 'FEV1' o 'FVC' sueltos al extraer el % (evita el falso positivo de leer el cociente como si fuera el volumen)", () => {
    const events = runExtractionEngine("FEV1/FVC 65%.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1FVCRatio: 65, FEV1Percent: null, FVCPercent: null });
  });

  it("tampoco confunde el z-score de FEV1/FVC con el de FEV1 o FVC sueltos", () => {
    const events = runExtractionEngine("FEV1/FVC z-score -1.2.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1FVCzScore: -1.2, FEV1zScore: null, FVCzScore: null });
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

  it("extrae correctamente dosis de 2+ dígitos (bug técnico corregido, no clínico)", () => {
    // Antes: el regex de dosis `${drug}[^.]{0,6}(\d+\s?mg)` hacía backtracking
    // voraz y se comía todos los dígitos de la dosis salvo el último antes de
    // que el grupo capturador entrara en juego, produciendo dose="0 mg" en vez
    // de "250 mg". Se corrigió con un cuantificador perezoso (`[^.]{0,6}?`) —
    // ver comentario en engines/extraction/index.ts. Este test fija el
    // comportamiento correcto como regresión.
    const events = runExtractionEngine("Se inicia azitromicina 250 mg lunes, miércoles y viernes.", "2024-01-01");
    const treatment = events.find((e) => e.type === "treatment_started");
    expect(treatment).toMatchObject({ drug: "azitromicina", dose: "250 mg" });
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

  it("detecta una prueba de imagen torácica y separa solo la frase que la contiene", () => {
    const events = runExtractionEngine("Buena tolerancia al ejercicio. TC tórax con progresión leve de bronquiectasias en língula. Se mantiene tratamiento habitual.", "2024-01-01");
    const imaging = events.find((e) => e.type === "imaging");
    expect(imaging).toBeDefined();
    if (imaging?.type === "imaging") {
      expect(imaging.text).toContain("progresión leve de bronquiectasias en língula");
      expect(imaging.text).not.toContain("Se mantiene tratamiento habitual");
    }
  });

  it("detecta una analítica y la etiqueta como tal", () => {
    const events = runExtractionEngine("Analítica con PCR 45 mg/L y leucocitos elevados. Resto sin hallazgos.", "2024-01-01");
    const lab = events.find((e) => e.type === "lab_results");
    expect(lab).toBeDefined();
    if (lab?.type === "lab_results") {
      expect(lab.label).toBe("Analítica");
      expect(lab.text).toContain("PCR 45 mg/L");
    }
  });

  it("detecta un procedimiento explícito (broncoscopia) aunque no se mencione la palabra 'ingreso'", () => {
    const events = runExtractionEngine("Se realiza broncoscopia ambulatoria por hemoptisis leve, sin complicaciones.", "2024-01-01");
    const proc = events.find((e) => e.type === "hospitalization");
    expect(proc).toBeDefined();
    if (proc?.type === "hospitalization") {
      expect(proc.procedureLabel).toMatch(/broncoscopia/i);
    }
  });

  it("una hospitalización sin procedimiento identificado no rellena procedureLabel", () => {
    const events = runExtractionEngine("Ingreso programado para estudio.", "2024-01-01");
    const hosp = events.find((e) => e.type === "hospitalization");
    expect(hosp).toBeDefined();
    if (hosp?.type === "hospitalization") {
      expect(hosp.procedureLabel).toBeUndefined();
    }
  });
});
