/**
 * changeTrend sustituye el cálculo naive de color (aumentado→rojo,
 * disminuido→verde por dirección numérica) que tenía SummaryTab. Cada
 * caso aquí verifica que la etiqueta se apoya en un Turning Point YA
 * EXISTENTE dentro de la ventana "desde la última consulta", nunca en
 * un umbral nuevo — y que una caída de FEV1 nunca se etiqueta (no hay
 * criterio ya establecido para FEV1 en este tipo de comparación).
 */
import { describe, expect, it } from "vitest";
import { changeTrend } from "@/domain/changeTrend";
import type { ClinicalChange } from "@/types/longitudinal";
import type { TurningPoint, TurningPointCriterion } from "@/types/turningPoints";

function turningPoint(criterion: TurningPointCriterion, date: string): TurningPoint {
  return {
    id: `tp-${criterion}-${date}`,
    criterion,
    date,
    label: "Momento clave",
    before: {},
    after: {},
    evidence: [],
    source: { kind: "legacy_heuristic", ruleId: criterion, label: criterion },
    interpretation: "",
    explanation: { kindLabel: "heurística experimental", source: { kind: "legacy_heuristic", ruleId: criterion, label: criterion }, sections: [], evidence: [] },
  };
}

function change(label: string, kind: ClinicalChange["kind"]): ClinicalChange {
  return { label, from: "a", to: "b", kind };
}

describe("changeTrend", () => {
  it("FVC disminuido: Empeoramiento solo si coincide con un Turning Point restrictive-decline dentro de la ventana", () => {
    const c = change("FVC", "disminuido");
    const withTp = changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [turningPoint("restrictive-decline", "2025-06-01")] });
    expect(withTp).toBe("Empeoramiento");

    const withoutTp = changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] });
    expect(withoutTp).toBeNull();
  });

  it("FVC disminuido: sin efecto si el Turning Point cae FUERA de la ventana", () => {
    const c = change("FVC", "disminuido");
    const outside = changeTrend(c, { fromDate: "2025-06-01", toDate: "2025-12-01", turningPoints: [turningPoint("restrictive-decline", "2025-01-01")] });
    expect(outside).toBeNull();
  });

  it("FVC aumentado: nunca Empeoramiento, y nunca Mejoría (no hay criterio de mejora ya establecido)", () => {
    const c = change("FVC", "aumentado");
    expect(changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [turningPoint("restrictive-decline", "2025-06-01")] })).toBeNull();
  });

  it("FEV1: nunca se etiqueta, con o sin Turning Point — no hay criterio ya existente para esta comparación", () => {
    const c = change("FEV1", "disminuido");
    expect(changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [turningPoint("restrictive-decline", "2025-06-01")] })).toBeNull();
  });

  it("DLCO: nunca se etiqueta", () => {
    expect(changeTrend(change("DLCO", "disminuido"), { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] })).toBeNull();
  });

  it("Exacerbaciones (12 meses) aumentado: Empeoramiento solo si coincide con exacerbation-rate-jump en la ventana", () => {
    const c = change("Exacerbaciones (12 meses)", "aumentado");
    expect(changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [turningPoint("exacerbation-rate-jump", "2025-06-01")] })).toBe("Empeoramiento");
    expect(changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] })).toBeNull();
  });

  it("Exacerbaciones (12 meses) disminuido: nunca Mejoría — no existe ese criterio en ningún motor", () => {
    const c = change("Exacerbaciones (12 meses)", "disminuido");
    expect(changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [turningPoint("exacerbation-rate-jump", "2025-06-01")] })).toBeNull();
  });

  it("Hospitalizaciones (acumuladas) aumentado: siempre Empeoramiento, sin depender de un Turning Point", () => {
    const c = change("Hospitalizaciones (acumuladas)", "aumentado");
    expect(changeTrend(c, { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] })).toBe("Empeoramiento");
  });

  it("Microbiología y Tratamiento: nunca se etiquetan (capa 1 objetiva / cambio de tratamiento ya excluidos en otras fases)", () => {
    expect(changeTrend(change("Microbiología", "nuevo"), { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] })).toBeNull();
    expect(changeTrend(change("Tratamiento", "nuevo"), { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] })).toBeNull();
    expect(changeTrend(change("Tratamiento", "desaparecido"), { fromDate: "2025-01-01", toDate: "2025-12-01", turningPoints: [] })).toBeNull();
  });
});
