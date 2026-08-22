import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import type { PulmonaryFunctionEvent } from "@/types/clinicalEvent";

describe("mkEvent", () => {
  it("aplica los valores por defecto del prototipo (source seed_demo, confidence confirmado)", () => {
    const ev = mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", {
      FEV1Percent: 80,
    });
    expect(ev.source).toBe("seed_demo");
    expect(ev.confidence).toBe("confirmado");
    expect(ev.rawText).toBeNull();
    expect(ev.confidenceReason).toBeNull();
    expect(ev.FEV1Percent).toBe(80);
    expect(ev.patientId).toBe("p1");
    expect(ev.date).toBe("2024-01-01");
  });

  it("genera ids únicos por evento", () => {
    const a = mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01");
    const b = mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-02");
    expect(a.id).not.toBe(b.id);
  });

  it("respeta las opciones explícitas (source, confidence, confidenceReason)", () => {
    const ev = mkEvent("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false }, {
      source: "extraction_simulated",
      confidence: "posible",
      confidenceReason: "texto ambiguo",
    });
    expect(ev.source).toBe("extraction_simulated");
    expect(ev.confidence).toBe("posible");
    expect(ev.confidenceReason).toBe("texto ambiguo");
  });
});
