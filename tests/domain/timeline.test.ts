import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { displayForEvent, episodeKeyForEvent, groupTimelineRows, isNotableEvent } from "@/domain/timeline";
import type { ExacerbationEvent, HospitalizationEvent, MicrobiologyEvent, PulmonaryFunctionEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";

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

  it("añade el z-score junto al % del predicho cuando la prueba lo trae, sin sustituirlo", () => {
    const ev = mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", {
      FEV1Percent: 68,
      FEV1zScore: -1.9,
      FVCPercent: 76,
      FVCzScore: -1.7,
    });
    const display = displayForEvent(ev);
    expect(display.title).toBe("FEV1 68% (z −1.9) · FVC 76% (z −1.7)");
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

describe("episodeKeyForEvent", () => {
  it("cae a la fecha cuando no hay episodeId (comportamiento de hoy: agrupa por día)", () => {
    const ev = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(episodeKeyForEvent(ev)).toBe("2024-01-01");
  });

  it("usa episodeId cuando está informado, en vez de asumir que 'mismo día' es siempre 'mismo episodio'", () => {
    const base = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    const ev = { ...base, episodeId: "visita-mañana" };
    expect(episodeKeyForEvent(ev)).toBe("visita-mañana");
  });
});

describe("groupTimelineRows", () => {
  it("agrupa eventos del mismo día en un único cluster", () => {
    const a = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    const b = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", { sampleType: "Esputo", organism: "H. influenzae", sensitivity: [], resistance: [] });
    const c = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-02-01", { severity: "Leve", hospitalization: false });
    const clusters = groupTimelineRows([a, b, c]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].rows).toHaveLength(2);
    expect(clusters[0].date).toBe("2024-01-01");
    expect(clusters[1].rows).toHaveLength(1);
  });

  it("mantiene el orden de aparición de la lista de entrada (si ya viene ordenada por fecha, los clusters también lo estarán)", () => {
    const jan = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    const feb = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-02-01", { severity: "Leve", hospitalization: false });
    const clusters = groupTimelineRows([feb, jan]);
    expect(clusters.map((c) => c.date)).toEqual(["2024-02-01", "2024-01-01"]);
  });

  it("un único evento produce un cluster de un solo elemento, sin overhead", () => {
    const a = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(groupTimelineRows([a])).toEqual([{ key: "2024-01-01", date: "2024-01-01", rows: [a] }]);
  });
});

describe("isNotableEvent", () => {
  const noTurningPoints = new Set<string>();

  it("una exacerbación sin hospitalización no es notable por sí sola", () => {
    const ev = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(isNotableEvent(ev, noTurningPoints)).toBe(false);
  });

  it("una exacerbación CON hospitalización sí es notable — campo ya existente, sin umbral nuevo", () => {
    const ev = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true });
    expect(isNotableEvent(ev, noTurningPoints)).toBe(true);
  });

  it("un evento de hospitalización/procedimiento es notable", () => {
    const ev = mkEvent<HospitalizationEvent>("p1", CLINICAL_EVENT_TYPES.HOSPITALIZATION, "2024-01-01", {});
    expect(isNotableEvent(ev, noTurningPoints)).toBe(true);
  });

  it("un inicio de soporte respiratorio es notable", () => {
    const ev = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2024-01-01", { drug: "oxígeno" });
    expect(isNotableEvent(ev, noTurningPoints)).toBe(true);
  });

  it("un evento cuya fecha coincide con un Momento clave detectado es notable, aunque su tipo no lo sea por sí solo", () => {
    const ev = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", { sampleType: "Esputo", organism: "P. aeruginosa", sensitivity: [], resistance: [] });
    expect(isNotableEvent(ev, new Set(["2024-01-01"]))).toBe(true);
    expect(isNotableEvent(ev, new Set(["2024-06-01"]))).toBe(false);
  });
});
