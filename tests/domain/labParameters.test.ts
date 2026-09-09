import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { groupLabParameters, latestPoint, selectUnstructuredLabResults } from "@/domain/labParameters";
import type { LabResultsEvent } from "@/types/clinicalEvent";

function lab(date: string, opts: Partial<LabResultsEvent> = {}): LabResultsEvent {
  return mkEvent<LabResultsEvent>("p1", CLINICAL_EVENT_TYPES.LAB_RESULTS, date, { label: "Analítica", text: "", ...opts });
}

describe("groupLabParameters", () => {
  it("agrupa por nombre exacto a través de varios LabResultsEvent, ordenados por fecha ascendente", () => {
    const events = [
      lab("2026-06-20", { parameters: [{ name: "PCR", valueText: "8 mg/L", numericValue: 8, unit: "mg/L", status: "alterado", category: "general" }] }),
      lab("2026-02-05", { parameters: [{ name: "PCR", valueText: "95 mg/L", numericValue: 95, unit: "mg/L", status: "alterado", category: "general" }] }),
    ];
    const series = groupLabParameters(events, "general");
    expect(series).toHaveLength(1);
    expect(series[0].name).toBe("PCR");
    // Fecha ascendente aunque los eventos de entrada no lo estén: 05/02 (95) antes que 20/06 (8).
    expect(series[0].points.map((p) => p.valueText)).toEqual(["95 mg/L", "8 mg/L"]);
  });

  it("separa por category — el mismo nombre no mezcla 'general' con 'etiologico'", () => {
    const events = [
      lab("2026-01-01", { parameters: [{ name: "X", valueText: "1", category: "general" }] }),
      lab("2026-02-01", { parameters: [{ name: "X", valueText: "2", category: "etiologico" }] }),
    ];
    expect(groupLabParameters(events, "general")).toHaveLength(1);
    expect(groupLabParameters(events, "etiologico")).toHaveLength(1);
    expect(groupLabParameters(events, "general")[0].points).toHaveLength(1);
  });

  it("un parámetro sin status explícito (null) no se pierde, pero tampoco se le asigna 'normal' ni 'alterado'", () => {
    const events = [lab("2026-01-01", { parameters: [{ name: "IgE total", valueText: "45 kU/L", numericValue: 45, unit: "kU/L", status: null, category: "etiologico" }] })];
    const series = groupLabParameters(events, "etiologico");
    expect(series[0].points[0].status).toBeNull();
  });

  it("conserva referenceRange cuando el parámetro lo trae", () => {
    const events = [
      lab("2026-01-01", {
        parameters: [{ name: "IgG", valueText: "950 mg/dL", numericValue: 950, unit: "mg/dL", referenceRange: { low: 700, high: 1600 }, status: "normal", category: "etiologico" }],
      }),
    ];
    const series = groupLabParameters(events, "etiologico");
    expect(series[0].points[0].referenceRange).toEqual({ low: 700, high: 1600 });
  });

  it("no produce ninguna serie a partir de LabResultsEvent sin parameters (analíticas antiguas sin desglose)", () => {
    const events = [lab("2026-01-01", { text: "PCR y hemograma sin alteraciones." })];
    expect(groupLabParameters(events, "general")).toEqual([]);
  });
});

describe("latestPoint", () => {
  it("devuelve el último punto de la serie (el más reciente)", () => {
    const events = [
      lab("2026-01-01", { parameters: [{ name: "PCR", valueText: "10 mg/L", category: "general" }] }),
      lab("2026-06-01", { parameters: [{ name: "PCR", valueText: "3 mg/L", category: "general" }] }),
    ];
    const series = groupLabParameters(events, "general")[0];
    expect(latestPoint(series)?.valueText).toBe("3 mg/L");
  });
});

describe("selectUnstructuredLabResults", () => {
  it("devuelve solo los LabResultsEvent sin parameters (o con parameters vacío), nunca los que sí tienen desglose", () => {
    const withParams = lab("2026-01-01", { parameters: [{ name: "PCR", valueText: "8 mg/L", category: "general" }] });
    const withoutParams = lab("2026-02-01", { text: "Analítica sin desglosar." });
    const withEmptyParams = lab("2026-03-01", { parameters: [] });
    const result = selectUnstructuredLabResults([withParams, withoutParams, withEmptyParams]);
    expect(result.map((e) => e.id)).toEqual([withoutParams.id, withEmptyParams.id]);
  });
});
