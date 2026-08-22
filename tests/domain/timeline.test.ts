import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { displayForEvent } from "@/domain/timeline";
import type { ExacerbationEvent, MicrobiologyEvent, PulmonaryFunctionEvent } from "@/types/clinicalEvent";

describe("displayForEvent", () => {
  it("representa un evento de función pulmonar", () => {
    const ev = mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", {
      FEV1Percent: 78,
      FVCPercent: 85,
      DLCOPercent: 70,
    });
    const display = displayForEvent(ev);
    expect(display.group).toBe("Función pulmonar");
    expect(display.title).toBe("FEV1 78% · FVC 85%");
    expect(display.detail).toBe("DLCO 70%");
  });

  it("representa un evento de microbiología sin antibiograma", () => {
    const ev = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", {
      sampleType: "Esputo",
      organism: "Haemophilus influenzae",
      sensitivity: [],
      resistance: [],
    });
    expect(displayForEvent(ev).detail).toBe("Sin antibiograma registrado");
  });

  it("representa una exacerbación grave con hospitalización", () => {
    const ev = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", {
      severity: "Grave",
      hospitalization: true,
    });
    expect(displayForEvent(ev).title).toBe("Exacerbación grave (hospitalización)");
  });

  it("usa el grupo Consulta por defecto para eventos de consulta", () => {
    const ev = mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { rawText: "Texto libre" });
    const display = displayForEvent(ev);
    expect(display.group).toBe("Consulta");
    expect(display.detail).toBe("Texto libre");
  });
});
