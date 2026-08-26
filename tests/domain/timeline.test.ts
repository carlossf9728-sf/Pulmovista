import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { displayForEvent, episodeKeyForEvent, episodeSummary, exacerbationOwnTrend, groupTimelineRows, isNotableEvent, trendForRow, turningPointTrend } from "@/domain/timeline";
import type { ExacerbationEvent, HospitalizationEvent, ImagingEvent, MicrobiologyEvent, PulmonaryFunctionEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";

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

describe("episodeSummary", () => {
  it("compone una cabecera clínica breve a partir de lo que cada evento ya trae, no de texto libre resumido", () => {
    const consulta = mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { rawText: "..." });
    const tratamiento = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2024-01-01", { drug: "tobramicina inhalada" });
    expect(episodeSummary([consulta, tratamiento])).toBe("Consulta + inicio de tobramicina inhalada");
  });

  it("otro ejemplo: ingreso + exacerbación + TAC", () => {
    const ingreso = mkEvent<HospitalizationEvent>("p1", CLINICAL_EVENT_TYPES.HOSPITALIZATION, "2024-01-01", {});
    const exacerbacion = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true });
    const tac = mkEvent("p1", CLINICAL_EVENT_TYPES.IMAGING, "2024-01-01", { label: "TAC tórax", text: "..." });
    expect(episodeSummary([ingreso, exacerbacion, tac])).toBe("Ingreso + exacerbación + TAC tórax");
  });

  it("con más eventos que el máximo, corta y añade un contador de los que faltan", () => {
    const events = [
      mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { rawText: "..." }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", { sampleType: "Esputo", organism: "H. influenzae", sensitivity: [], resistance: [] }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 70 }),
    ];
    expect(episodeSummary(events, 3)).toBe("Consulta + exacerbación + cultivo de H. influenzae +1 más");
  });

  it("un procedimiento identificado se nombra en vez del genérico 'ingreso'", () => {
    const procedimiento = mkEvent<HospitalizationEvent>("p1", CLINICAL_EVENT_TYPES.HOSPITALIZATION, "2024-01-01", { procedureLabel: "broncoscopia" });
    const consulta = mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { rawText: "..." });
    expect(episodeSummary([consulta, procedimiento])).toBe("Consulta + broncoscopia");
  });
});

describe("turningPointTrend", () => {
  it("traduce restrictive-decline, exacerbation-rate-jump y first-hospitalization a Empeoramiento", () => {
    expect(turningPointTrend("restrictive-decline")).toBe("Empeoramiento");
    expect(turningPointTrend("exacerbation-rate-jump")).toBe("Empeoramiento");
    expect(turningPointTrend("first-hospitalization")).toBe("Empeoramiento");
  });

  it("deja first-persistent-organism y respiratory-support-start sin etiqueta — el usuario pidió no auto-clasificar microbiología ni tratamiento", () => {
    expect(turningPointTrend("first-persistent-organism")).toBeNull();
    expect(turningPointTrend("respiratory-support-start")).toBeNull();
  });

  it("ningún criterio produce 'Mejoría': Turning Points solo detecta empeoramientos objetivos", () => {
    const criteria: Array<Parameters<typeof turningPointTrend>[0]> = [
      "restrictive-decline",
      "exacerbation-rate-jump",
      "first-persistent-organism",
      "first-hospitalization",
      "respiratory-support-start",
    ];
    expect(criteria.map(turningPointTrend)).not.toContain("Mejoría");
  });
});

describe("exacerbationOwnTrend", () => {
  it("una exacerbación grave u hospitalizada es Empeoramiento por sí sola, cada vez que ocurre (no solo la primera)", () => {
    const grave = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: false });
    const hospitalizada = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-06-01", { severity: "Moderada", hospitalization: true });
    expect(exacerbationOwnTrend(grave)).toBe("Empeoramiento");
    expect(exacerbationOwnTrend(hospitalizada)).toBe("Empeoramiento");
  });

  it("una exacerbación leve o moderada sin ingreso no se etiqueta", () => {
    const leve = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(exacerbationOwnTrend(leve)).toBeNull();
  });

  it("nunca devuelve 'Mejoría': no hay ningún criterio ya establecido para 'reducción clara' de exacerbaciones", () => {
    const leve = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(exacerbationOwnTrend(leve)).not.toBe("Mejoría");
  });
});

describe("trendForRow", () => {
  it("radiología: clasifica a partir del propio texto del informe, con o sin Turning Point asociado", () => {
    const progresa = mkEvent<ImagingEvent>("p1", CLINICAL_EVENT_TYPES.IMAGING, "2024-01-01", { label: "TC tórax", text: "Progresión de las bronquiectasias." });
    const sinCambios = mkEvent<ImagingEvent>("p1", CLINICAL_EVENT_TYPES.IMAGING, "2024-01-01", { label: "TC tórax", text: "Sin cambios significativos." });
    expect(trendForRow(progresa, null)).toBe("Empeoramiento");
    expect(trendForRow(sinCambios, null)).toBeNull();
  });

  it("exacerbación grave/hospitalizada es Empeoramiento aunque no coincida con ningún Turning Point", () => {
    const grave = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true });
    expect(trendForRow(grave, null)).toBe("Empeoramiento");
  });

  it("exacerbación leve sin Turning Point asociado no se etiqueta", () => {
    const leve = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(trendForRow(leve, null)).toBeNull();
  });

  it("exacerbación leve SÍ se etiqueta si coincide con exacerbation-rate-jump o first-hospitalization", () => {
    const leve = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(trendForRow(leve, "exacerbation-rate-jump")).toBe("Empeoramiento");
    expect(trendForRow(leve, "first-hospitalization")).toBe("Empeoramiento");
  });

  it("una exacerbación NUNCA hereda un Turning Point de otro dominio (p. ej. restrictive-decline, de función pulmonar)", () => {
    const leve = mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false });
    expect(trendForRow(leve, "restrictive-decline")).toBeNull();
    expect(trendForRow(leve, "first-persistent-organism")).toBeNull();
  });

  it("función pulmonar: solo se etiqueta si el Turning Point que coincide en fecha es restrictive-decline, nunca otro criterio", () => {
    const pft = mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 68 });
    expect(trendForRow(pft, "restrictive-decline")).toBe("Empeoramiento");
    expect(trendForRow(pft, "exacerbation-rate-jump")).toBeNull();
    expect(trendForRow(pft, null)).toBeNull();
  });

  it("microbiología, tratamientos, ingresos y el resto de dominios no clasificados devuelven siempre null en esta fase", () => {
    const cultivo = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] });
    const soporte = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2024-01-01", { drug: "oxígeno" });
    const ingreso = mkEvent<HospitalizationEvent>("p1", CLINICAL_EVENT_TYPES.HOSPITALIZATION, "2024-01-01", {});
    expect(trendForRow(cultivo, "first-persistent-organism")).toBeNull();
    expect(trendForRow(soporte, "respiratory-support-start")).toBeNull();
    expect(trendForRow(ingreso, "first-hospitalization")).toBeNull();
  });
});
