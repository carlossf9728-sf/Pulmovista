import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import {
  changesAfterEpisode,
  episodeDurationDays,
  episodeHeadline,
  episodeHighlightLine,
  groupLinkedEventsBySection,
  isHospitalizationEpisode,
  selectLinkedEpisodeEvents,
} from "@/domain/episode";
import type {
  DiagnosisEvent,
  ExacerbationEvent,
  ImagingEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
  TreatmentStartedEvent,
  TreatmentStoppedEvent,
} from "@/types/clinicalEvent";

const EP = "ep-test";

function container(overrides: Partial<ExacerbationEvent> = {}): ExacerbationEvent {
  return mkEvent<ExacerbationEvent>(
    "p1",
    CLINICAL_EVENT_TYPES.EXACERBATION,
    "2026-01-19",
    { severity: "Grave", hospitalization: true, ...overrides },
    { episodeId: overrides.episodeId === undefined ? EP : overrides.episodeId },
  );
}

describe("isHospitalizationEpisode", () => {
  it("es true solo para una exacerbación con hospitalization=true", () => {
    expect(isHospitalizationEpisode(container())).toBe(true);
    expect(isHospitalizationEpisode(mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false }))).toBe(false);
    expect(isHospitalizationEpisode(mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", { sampleType: "Esputo", organism: "X", sensitivity: [], resistance: [] }))).toBe(
      false,
    );
  });
});

describe("episodeDurationDays", () => {
  it("calcula la duración exacta en días entre ingreso y alta", () => {
    expect(episodeDurationDays(container({ dischargeDate: "2026-01-26" }))).toBe(7);
  });
  it("null sin fecha de alta", () => {
    expect(episodeDurationDays(container({ dischargeDate: null }))).toBeNull();
  });
  it("null si la fecha de alta es anterior al ingreso (dato incoherente)", () => {
    expect(episodeDurationDays(container({ dischargeDate: "2026-01-01" }))).toBeNull();
  });
});

describe("episodeHeadline", () => {
  it("incluye gravedad y duración cuando hay fecha de alta", () => {
    expect(episodeHeadline(container({ dischargeDate: "2026-01-26" }))).toBe("Exacerbación grave · ingreso 7 días");
  });
  it("usa singular 'día' cuando la duración es 1", () => {
    expect(episodeHeadline(container({ dischargeDate: "2026-01-20" }))).toBe("Exacerbación grave · ingreso 1 día");
  });
  it("omite la duración sin fecha de alta", () => {
    expect(episodeHeadline(container({ dischargeDate: null }))).toBe("Exacerbación grave");
  });
});

describe("episodeHighlightLine", () => {
  it("compone soporte respiratorio y destino al alta cuando ambos constan", () => {
    const c = container({ dischargeDisposition: "domicilio" });
    const support = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2026-01-19", { drug: "VMNI" }, { episodeId: EP });
    expect(episodeHighlightLine(c, [support])).toBe("Precisó VMNI · alta a domicilio");
  });
  it("null si no hay soporte vinculado ni destino al alta", () => {
    expect(episodeHighlightLine(container({ dischargeDisposition: null }), [])).toBeNull();
  });
});

describe("selectLinkedEpisodeEvents", () => {
  it("solo devuelve eventos con el mismo episodeId, nunca el propio contenedor, ordenados por fecha", () => {
    const c = container();
    const support = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2026-01-20", { drug: "VMNI" }, { episodeId: EP });
    const unrelated = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-01-01", { drug: "oxígeno domiciliario" });
    const lab = mkEvent<TreatmentStartedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2026-01-19", { drug: "piperacilina-tazobactam IV" }, { episodeId: EP });
    const linked = selectLinkedEpisodeEvents(c, [c, support, unrelated, lab]);
    expect(linked.map((e) => e.id)).toEqual([lab.id, support.id]);
  });
  it("[] si el contenedor no tiene episodeId", () => {
    expect(selectLinkedEpisodeEvents(container({ episodeId: null }), [])).toEqual([]);
  });
});

describe("groupLinkedEventsBySection", () => {
  it("clasifica cada tipo de evento vinculado en su sección, y un tratamiento por fecha respecto a dischargeDate", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const support = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2026-01-19", { drug: "VMNI" }, { episodeId: EP });
    const during = mkEvent<TreatmentStartedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2026-01-19", { drug: "piperacilina-tazobactam IV" }, { episodeId: EP });
    const atDischarge = mkEvent<TreatmentStartedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2026-01-26", { drug: "prednisona oral" }, { episodeId: EP });
    const stopped = mkEvent<TreatmentStoppedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STOPPED, "2026-01-25", { drug: "piperacilina-tazobactam IV" }, { episodeId: EP });
    const lab = mkEvent<ImagingEvent>("p1", CLINICAL_EVENT_TYPES.IMAGING, "2026-01-19", { label: "Rx tórax", text: "Sin condensación." }, { episodeId: EP });
    const diagnosis = mkEvent<DiagnosisEvent>("p1", CLINICAL_EVENT_TYPES.DIAGNOSIS, "2026-01-19", { label: "Agudización grave de EPOC" }, { episodeId: EP });

    const linked = [support, during, atDischarge, stopped, lab, diagnosis];
    const sections = groupLinkedEventsBySection(c, linked);
    expect(sections.support.map((e) => e.id)).toEqual([support.id]);
    expect(sections.tests.map((e) => e.id)).toEqual([lab.id]);
    expect(sections.treatmentsDuring.map((e) => e.id)).toEqual([during.id]);
    expect(sections.treatmentsAtDischarge.map((e) => e.id)).toEqual([atDischarge.id]);
    expect(sections.stopped.map((e) => e.id)).toEqual([stopped.id]);
    expect(sections.diagnoses.map((e) => e.id)).toEqual([diagnosis.id]);
  });

  it("sin dischargeDate, todo tratamiento vinculado se clasifica como 'durante el ingreso'", () => {
    const c = container({ dischargeDate: null });
    const t = mkEvent<TreatmentStartedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2026-01-19", { drug: "prednisona oral" }, { episodeId: EP });
    const sections = groupLinkedEventsBySection(c, [t]);
    expect(sections.treatmentsDuring.map((e) => e.id)).toEqual([t.id]);
    expect(sections.treatmentsAtDischarge).toEqual([]);
  });
});

describe("changesAfterEpisode", () => {
  it("[] sin fecha de alta — no hay 'después' que evaluar", () => {
    expect(changesAfterEpisode(container({ dischargeDate: null }), [], new Set())).toEqual([]);
  });

  it("nuevo aislamiento microbiológico tras el alta, reutilizando microbiologyObjectiveChange", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const before = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2025-08-30", { sampleType: "Esputo", organism: "Moraxella catarrhalis", sensitivity: [], resistance: [] });
    const after = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2026-06-15", { sampleType: "Esputo", organism: "Haemophilus influenzae", sensitivity: [], resistance: [] });
    const changes = changesAfterEpisode(c, [c, before, after], new Set());
    expect(changes).toEqual([{ label: "Nuevo aislamiento microbiológico: Haemophilus influenzae", date: "2026-06-15" }]);
  });

  it("no señala un cultivo posterior si es el mismo organismo que el previo (persistencia, no cambio objetivo de nuevo aislamiento)", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const before = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2025-08-30", { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] });
    const after = mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2026-06-15", { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] });
    expect(changesAfterEpisode(c, [c, before, after], new Set())).toEqual([]);
  });

  it("deterioro funcional posterior solo si la fecha del PFT coincide con un restrictive-decline ya detectado por Turning Points (nunca un umbral nuevo)", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const pft = mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2026-06-10", { FVCPercent: 53 });
    const withTp = changesAfterEpisode(c, [c, pft], new Set(["2026-06-10"]));
    expect(withTp).toEqual([{ label: "Deterioro funcional posterior (descenso restrictivo de FVC)", date: "2026-06-10" }]);
    const withoutTp = changesAfterEpisode(c, [c, pft], new Set());
    expect(withoutTp).toEqual([]);
  });

  it("nueva necesidad de soporte respiratorio solo si no existía ninguno antes del ingreso", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const supportAfter = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2026-03-01", { drug: "oxígeno domiciliario" });
    expect(changesAfterEpisode(c, [c, supportAfter], new Set())).toEqual([{ label: "Nueva necesidad de soporte respiratorio: oxígeno domiciliario", date: "2026-03-01" }]);

    const supportBefore = mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-09-05", { drug: "oxígeno domiciliario" });
    expect(changesAfterEpisode(c, [c, supportBefore, supportAfter], new Set())).toEqual([]);
  });

  it("nuevo diagnóstico relevante registrado tras el alta", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const diagnosis = mkEvent<DiagnosisEvent>("p1", CLINICAL_EVENT_TYPES.DIAGNOSIS, "2026-04-01", { label: "Hipertensión pulmonar secundaria" });
    expect(changesAfterEpisode(c, [c, diagnosis], new Set())).toEqual([{ label: "Nuevo diagnóstico relevante: Hipertensión pulmonar secundaria", date: "2026-04-01" }]);
  });

  it("un diagnóstico del propio episodio (fecha de ingreso, antes del alta) no cuenta como cambio posterior", () => {
    const c = container({ dischargeDate: "2026-01-26" });
    const ownDiagnosis = mkEvent<DiagnosisEvent>("p1", CLINICAL_EVENT_TYPES.DIAGNOSIS, "2026-01-19", { label: "Agudización grave de EPOC" }, { episodeId: EP });
    expect(changesAfterEpisode(c, [c, ownDiagnosis], new Set())).toEqual([]);
  });
});
