/**
 * Selectores derivados sobre ClinicalEvent[]. Réplica funcional exacta de
 * los selectores del prototipo original — con una excepción deliberada:
 * `selectHospitalizationCount` cuenta EPISODIOS (por `episodeId`), no
 * eventos sueltos — ver su propio comentario para la reconciliación
 * documentada como pendiente en una versión anterior de este archivo.
 */
import { sortByDate, yearOf } from "@/utils/date";
import { cap } from "@/utils/text";
import { CLINICAL_EVENT_TYPES } from "./clinicalEvent";
import type { Patient } from "@/types/patient";
import type {
  ClinicalEvent,
  ConsultationEvent,
  ExacerbationEvent,
  ImagingEvent,
  LabResultsEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
  TreatmentStartedEvent,
} from "@/types/clinicalEvent";
import type { ExacerbationYearCount, PatientStateAsOf, TreatmentSummary } from "@/types/longitudinal";

function isConsultation(e: ClinicalEvent): e is ConsultationEvent {
  return e.type === CLINICAL_EVENT_TYPES.CONSULTATION;
}
function isPulmonaryFunction(e: ClinicalEvent): e is PulmonaryFunctionEvent {
  return e.type === CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION;
}
function isMicrobiology(e: ClinicalEvent): e is MicrobiologyEvent {
  return e.type === CLINICAL_EVENT_TYPES.MICROBIOLOGY;
}
function isExacerbation(e: ClinicalEvent): e is ExacerbationEvent {
  return e.type === CLINICAL_EVENT_TYPES.EXACERBATION;
}
function isImaging(e: ClinicalEvent): e is ImagingEvent {
  return e.type === CLINICAL_EVENT_TYPES.IMAGING;
}
function isLabResults(e: ClinicalEvent): e is LabResultsEvent {
  return e.type === CLINICAL_EVENT_TYPES.LAB_RESULTS;
}
function isTreatmentStart(e: ClinicalEvent): e is TreatmentStartedEvent | RespiratorySupportEvent {
  return e.type === CLINICAL_EVENT_TYPES.TREATMENT_STARTED || e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT;
}

/**
 * ¿Puede `date` tratarse como una fecha clínica real al ordenar o
 * comparar en el tiempo? false cuando `datePrecision` es "unresolved"
 * (ver types/clinicalEvent.ts) — el evento sigue siendo válido y visible
 * en listados y Cronología, pero ningún motor de TENDENCIA longitudinal
 * (Argos, Turning Points, microbiología, PFR, comparaciones entre
 * visitas) debe usar su fecha para decidir un antes/después: la fecha
 * "unresolved" solo se conserva por compatibilidad técnica (ordenar sin
 * romper), nunca como base de una comparación cuyo resultado dependa de
 * que sea correcta.
 */
export function isDateReliable(e: ClinicalEvent): boolean {
  return e.datePrecision !== "unresolved";
}

/**
 * ERS define "severe exacerbation" (ers-def-severe-exacerbation) como la
 * que requiere hospitalización o antibiótico intravenoso. `hospitalization`
 * es el campo directo; el texto de `severity` conteniendo "grave" se usa
 * como señal de apoyo cuando no hay ingreso registrado (no es un campo
 * booleano de "requirió antibiótico IV" — ese dato no existe en el modelo).
 * Fuente única de verdad — reutilizada por engines/guidelines/match.ts y
 * por domain/timeline.ts (cambio longitudinal de exacerbaciones), para no
 * duplicar ni desalinear el mismo criterio en dos sitios.
 */
export function isSevereExacerbation(e: ExacerbationEvent): boolean {
  return e.hospitalization === true || /grave/i.test(e.severity);
}

export function selectConsultations(events: ClinicalEvent[]): ConsultationEvent[] {
  return sortByDate(events.filter(isConsultation));
}

export function selectPFT(events: ClinicalEvent[]): PulmonaryFunctionEvent[] {
  return sortByDate(events.filter(isPulmonaryFunction));
}

/**
 * Igual que selectPFT, pero acotado a pruebas con FEV1Percent presente
 * Y con fecha fiable (helper de tendencia reutilizado por Sentinel y
 * Turning Points para comparar consecutivas — ver isDateReliable: una
 * prueba con datePrecision "unresolved" sigue viéndose en Cronología/
 * pestaña Función pulmonar (que usan selectPFT sin filtrar), pero no
 * puede formar parte de una tendencia cuyo orden dependa de su fecha).
 */
export function selectPFTWithFEV1(events: ClinicalEvent[]): (PulmonaryFunctionEvent & { FEV1Percent: number })[] {
  return selectPFT(events)
    .filter(isDateReliable)
    .filter((p): p is PulmonaryFunctionEvent & { FEV1Percent: number } => p.FEV1Percent != null);
}

/** Igual que selectPFTWithFEV1, pero acotado a FVCPercent (usado por el detector de descenso restrictivo de Turning Points). */
export function selectPFTWithFVC(events: ClinicalEvent[]): (PulmonaryFunctionEvent & { FVCPercent: number })[] {
  return selectPFT(events)
    .filter(isDateReliable)
    .filter((p): p is PulmonaryFunctionEvent & { FVCPercent: number } => p.FVCPercent != null);
}

export function selectMicrobiology(events: ClinicalEvent[]): MicrobiologyEvent[] {
  return sortByDate(events.filter(isMicrobiology));
}

export function selectExacerbations(events: ClinicalEvent[]): ExacerbationEvent[] {
  return sortByDate(events.filter(isExacerbation));
}

/**
 * Cuenta EPISODIOS de hospitalización distintos, no eventos sueltos: un
 * HospitalizationEvent (p. ej. un procedimiento realizado durante el
 * ingreso) que comparte `episodeId` con la ExacerbationEvent.hospitalization
 * =true que abrió ese mismo episodio (ver domain/episode.ts y
 * engines/extraction/pipeline.ts) es la MISMA hospitalización, nunca una
 * segunda — se deduplica por `episodeId` cuando existe; un evento sin
 * episodeId (dato suelto, sin vincular a ningún episodio) cuenta por su
 * propio id.
 */
export function selectHospitalizationCount(events: ClinicalEvent[], upToDate: string | null): number {
  const d = upToDate ? new Date(upToDate) : null;
  const hospitalizationEvents = events.filter((e) => {
    if (d && new Date(e.date) > d) return false;
    return (e.type === CLINICAL_EVENT_TYPES.EXACERBATION && e.hospitalization) || e.type === CLINICAL_EVENT_TYPES.HOSPITALIZATION;
  });
  return new Set(hospitalizationEvents.map((e) => e.episodeId ?? e.id)).size;
}

export function selectImaging(events: ClinicalEvent[]): ImagingEvent[] {
  return sortByDate(events.filter(isImaging));
}

export function selectLabResults(events: ClinicalEvent[]): LabResultsEvent[] {
  return sortByDate(events.filter(isLabResults));
}

/** Terapias no farmacológicas ya presentes en los datos demo — solo para la etiqueta de categoría en pantalla, no afecta a ningún motor clínico. */
const NON_PHARMACOLOGICAL_KEYWORDS = ["fisioterapia", "rehabilitación", "oxígeno"];

function treatmentCategory(s: TreatmentStartedEvent | RespiratorySupportEvent): TreatmentSummary["category"] {
  if (s.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT) return "Soporte respiratorio";
  if (NON_PHARMACOLOGICAL_KEYWORDS.some((k) => s.drug.toLowerCase().includes(k))) return "No farmacológico";
  return "Farmacológico";
}

export function selectTreatments(events: ClinicalEvent[]): TreatmentSummary[] {
  const started = sortByDate(events.filter(isTreatmentStart));
  const stopped = sortByDate(events.filter((e) => e.type === CLINICAL_EVENT_TYPES.TREATMENT_STOPPED));
  const usedStops = new Set<string>();
  return started.map((s) => {
    const stop = stopped.find(
      (e2) =>
        e2.type === CLINICAL_EVENT_TYPES.TREATMENT_STOPPED &&
        !usedStops.has(e2.id) &&
        e2.drug &&
        s.drug &&
        e2.drug.toLowerCase() === s.drug.toLowerCase() &&
        new Date(e2.date) >= new Date(s.date),
    );
    if (stop) usedStops.add(stop.id);
    const base = cap(s.drug) ?? s.drug;
    // Dosis y frecuencia van pegadas al nombre ("Fármaco 750 mg cada 12 horas"); duración, pauta de días
    // concretos y el motivo de un cambio (intensificación, ajuste de dosis...) van entre paréntesis, sin
    // descartar ninguno en silencio cuando faltan los demás.
    const inline = [s.dose, s.frequency].filter((v): v is string => !!v).join(" ");
    const parenthetical = [s.changeNote, s.duration, s.schedule].filter((v): v is string => !!v).join(" · ");
    const label = `${base}${inline ? " " + inline : ""}${parenthetical ? ` (${parenthetical})` : ""}`;
    return {
      id: s.id,
      name: label,
      start: s.date,
      end: stop ? stop.date : null,
      status: stop ? "Finalizado" : "Activo",
      category: treatmentCategory(s),
      confidence: s.confidence,
    } satisfies TreatmentSummary;
  });
}

/** Estado del paciente reconstruido a fecha dada, a partir de eventos. */
export function getStateAsOf(patient: Patient, dateStr: string): PatientStateAsOf {
  const d = new Date(dateStr);
  const pftUpTo = selectPFT(patient.events).filter((p) => new Date(p.date) <= d);
  const latest = pftUpTo.length ? pftUpTo[pftUpTo.length - 1] : null;
  const organisms = new Set(
    selectMicrobiology(patient.events)
      .filter((m) => new Date(m.date) <= d)
      .map((m) => m.organism),
  );
  const oneYearBefore = new Date(d);
  oneYearBefore.setDate(oneYearBefore.getDate() - 365);
  const exacCount = selectExacerbations(patient.events).filter((e) => {
    const ed = new Date(e.date);
    return ed <= d && ed > oneYearBefore;
  }).length;
  const hospCumulative = selectHospitalizationCount(patient.events, dateStr);
  const activeTreatments = new Set(
    selectTreatments(patient.events)
      .filter((t) => new Date(t.start) <= d && (!t.end || new Date(t.end) > d))
      .map((t) => t.name),
  );
  return {
    fev1: latest ? (latest.FEV1Percent ?? null) : null,
    fvc: latest ? (latest.FVCPercent ?? null) : null,
    dlco: latest ? (latest.DLCOPercent ?? null) : null,
    organisms,
    exacCount,
    hospCumulative,
    activeTreatments,
  };
}

/**
 * Bucketing por año — base de la tendencia de exacerbaciones de Argos y
 * Turning Points. Excluye exacerbaciones con fecha "unresolved" (ver
 * isDateReliable): un año equivocado por una fecha no resuelta podría
 * convertir un aumento o descenso real en uno falso. La exacerbación
 * sigue existiendo y visible en selectExacerbations/Cronología sin
 * filtrar — solo no cuenta para esta tendencia por año.
 */
export function exacerbationsByYear(patient: Patient): ExacerbationYearCount[] {
  const byYear: Record<number, number> = {};
  selectExacerbations(patient.events)
    .filter(isDateReliable)
    .forEach((e) => {
      const y = yearOf(e.date);
      byYear[y] = (byYear[y] || 0) + 1;
    });
  return Object.entries(byYear)
    .map(([year, count]) => ({ year: parseInt(year, 10), count }))
    .sort((a, b) => a.year - b.year);
}
