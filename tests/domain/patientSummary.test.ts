import { describe, expect, it } from "vitest";
import { buildDemoPatients } from "@/data/demoPatients";
import { buildPatientSummaryText, currentStatusFields } from "@/domain/patientSummary";

describe("buildPatientSummaryText", () => {
  const [p1, , p3] = buildDemoPatients();

  it("identifica al paciente solo por su código PulmoVista e incluye los datos de 'Estado actual'", () => {
    const text = buildPatientSummaryText(p1);
    expect(text.split("\n")[0]).toBe(`Resumen PulmoVista · ${p1.code}`);
    expect(text).toContain("- Bronquiectasias no fibrosis quística");
    for (const [label, value] of currentStatusFields(p1)) {
      expect(text).toContain(`- ${label}: ${value ?? "No disponible"}`);
    }
    expect(text).toContain("- FEV1 más reciente: 68% (1.74 L)");
  });

  it("incluye los cambios desde la última consulta y la información que falta", () => {
    const text = buildPatientSummaryText(p1);
    expect(text).toContain("Cambios desde la última consulta (20/11/2025 → 25/06/2026):");
    expect(text).toContain("- FEV1: 71% → 68%");
    expect(text).toContain("- No consta cultivo para micobacterias.");
  });

  it("dice explícitamente cuando no falta información relevante, en vez de omitir la sección", () => {
    expect(buildPatientSummaryText(p3)).toContain("- No se han identificado ausencias relevantes para este diagnóstico.");
  });

  it("paciente sin eventos: sin comparación posible y sin 'null' en el texto", () => {
    const text = buildPatientSummaryText({ ...p1, age: null, events: [] });
    expect(text).toContain("Cambios desde la última consulta: aún no hay suficientes consultas para comparar.");
    expect(text).toContain("Edad no disponible");
    expect(text).not.toMatch(/null|undefined/);
  });
});
