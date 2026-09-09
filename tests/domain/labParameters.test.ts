import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { groupLabParametersByPanel, latestPoint, selectUnstructuredLabResults } from "@/domain/labParameters";
import type { LabResultsEvent } from "@/types/clinicalEvent";

function lab(date: string, opts: Partial<LabResultsEvent> = {}): LabResultsEvent {
  return mkEvent<LabResultsEvent>("p1", CLINICAL_EVENT_TYPES.LAB_RESULTS, date, { label: "Analítica", text: "", ...opts });
}

describe("groupLabParametersByPanel", () => {
  it("agrupa por nombre exacto a través de varios LabResultsEvent, ordenados por fecha ascendente", () => {
    const events = [
      lab("2026-06-20", { parameters: [{ name: "PCR", valueText: "8 mg/L", numericValue: 8, unit: "mg/L", status: "alterado", category: "inflamacion" }] }),
      lab("2026-02-05", { parameters: [{ name: "PCR", valueText: "95 mg/L", numericValue: 95, unit: "mg/L", status: "alterado", category: "inflamacion" }] }),
    ];
    const byPanel = groupLabParametersByPanel(events);
    const series = byPanel.inflamacion ?? [];
    expect(series).toHaveLength(1);
    expect(series[0].name).toBe("PCR");
    // Fecha ascendente aunque los eventos de entrada no lo estén: 05/02 (95) antes que 20/06 (8).
    expect(series[0].points.map((p) => p.valueText)).toEqual(["95 mg/L", "8 mg/L"]);
  });

  it("reparte por bloque de laboratorio — el mismo nombre en dos categorías distintas no se mezcla en un mismo bloque", () => {
    const events = [
      lab("2026-01-01", { parameters: [{ name: "X", valueText: "1", category: "hemograma" }] }),
      lab("2026-02-01", { parameters: [{ name: "X", valueText: "2", category: "inmunologia" }] }),
    ];
    const byPanel = groupLabParametersByPanel(events);
    // Mismo `name` en dos eventos con categorías distintas: la serie es una sola (agrupa por nombre), y
    // se ubica en el bloque de la categoría más reciente — no hay una resolución "más correcta" posible.
    expect(byPanel.inmunologia).toHaveLength(1);
    expect(byPanel.hemograma).toBeUndefined();
  });

  it("un parámetro sin status explícito (null) no se pierde, pero tampoco se le asigna 'normal' ni 'alterado'", () => {
    const events = [lab("2026-01-01", { parameters: [{ name: "IgE total", valueText: "45 kU/L", numericValue: 45, unit: "kU/L", status: null, category: "inmunologia" }] })];
    const series = groupLabParametersByPanel(events).inmunologia ?? [];
    expect(series[0].points[0].status).toBeNull();
  });

  it("conserva referenceRange cuando el parámetro lo trae", () => {
    const events = [
      lab("2026-01-01", {
        parameters: [{ name: "IgG", valueText: "950 mg/dL", numericValue: 950, unit: "mg/dL", referenceRange: { low: 700, high: 1600 }, status: "normal", category: "inmunologia" }],
      }),
    ];
    const series = groupLabParametersByPanel(events).inmunologia ?? [];
    expect(series[0].points[0].referenceRange).toEqual({ low: 700, high: 1600 });
  });

  it("no produce ningún bloque a partir de LabResultsEvent sin parameters (analíticas antiguas sin desglose)", () => {
    const events = [lab("2026-01-01", { text: "PCR y hemograma sin alteraciones." })];
    expect(groupLabParametersByPanel(events)).toEqual({});
  });

  it("reparte varios parámetros de la misma analítica en sus bloques correspondientes, cada uno en el suyo", () => {
    const events = [
      lab("2026-01-01", {
        parameters: [
          { name: "Leucocitos", valueText: "11.000/µL", category: "hemograma" },
          { name: "Creatinina", valueText: "0,9 mg/dL", category: "funcion_renal" },
          { name: "Alfa-1-antitripsina", valueText: "135 mg/dL", category: "alfa1_antitripsina" },
        ],
      }),
    ];
    const byPanel = groupLabParametersByPanel(events);
    expect(byPanel.hemograma?.map((s) => s.name)).toEqual(["Leucocitos"]);
    expect(byPanel.funcion_renal?.map((s) => s.name)).toEqual(["Creatinina"]);
    expect(byPanel.alfa1_antitripsina?.map((s) => s.name)).toEqual(["Alfa-1-antitripsina"]);
    expect(byPanel.otros).toBeUndefined();
  });
});

describe("latestPoint", () => {
  it("devuelve el último punto de la serie (el más reciente)", () => {
    const events = [
      lab("2026-01-01", { parameters: [{ name: "PCR", valueText: "10 mg/L", category: "inflamacion" }] }),
      lab("2026-06-01", { parameters: [{ name: "PCR", valueText: "3 mg/L", category: "inflamacion" }] }),
    ];
    const series = (groupLabParametersByPanel(events).inflamacion ?? [])[0];
    expect(latestPoint(series)?.valueText).toBe("3 mg/L");
  });
});

describe("selectUnstructuredLabResults", () => {
  it("devuelve solo los LabResultsEvent sin parameters (o con parameters vacío), nunca los que sí tienen desglose", () => {
    const withParams = lab("2026-01-01", { parameters: [{ name: "PCR", valueText: "8 mg/L", category: "inflamacion" }] });
    const withoutParams = lab("2026-02-01", { text: "Analítica sin desglosar." });
    const withEmptyParams = lab("2026-03-01", { parameters: [] });
    const result = selectUnstructuredLabResults([withParams, withoutParams, withEmptyParams]);
    expect(result.map((e) => e.id)).toEqual([withoutParams.id, withEmptyParams.id]);
  });
});
