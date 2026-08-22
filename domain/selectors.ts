/**
 * Selectores derivados sobre ClinicalEvent[]. Réplica funcional exacta de
 * los selectores del prototipo original — incluida la forma en que
 * `selectHospitalizationCount` puede, en teoría, contar dos veces la misma
 * hospitalización si conviven un EXACERBATION.hospitalization=true y un
 * HOSPITALIZATION independiente para el mismo episodio (no se corrige
 * aquí: ver nota "LEGACY" — es una incoherencia de modelado del dominio
 * documentada para revisión en la siguiente fase, no un bug técnico).
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
function isTreatmentStart(e: ClinicalEvent): e is TreatmentStartedEvent | RespiratorySupportEvent {
  return e.type === CLINICAL_EVENT_TYPES.TREATMENT_STARTED || e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT;
}

export function selectConsultations(events: ClinicalEvent[]): ConsultationEvent[] {
  return sortByDate(events.filter(isConsultation));
}

export function selectPFT(events: ClinicalEvent[]): PulmonaryFunctionEvent[] {
  return sortByDate(events.filter(isPulmonaryFunction));
}

/** Igual que selectPFT, pero acotado a pruebas con FEV1Percent presente (helper de tipado reutilizado por Sentinel y Turning Points). */
export function selectPFTWithFEV1(events: ClinicalEvent[]): (PulmonaryFunctionEvent & { FEV1Percent: number })[] {
  return selectPFT(events).filter(
    (p): p is PulmonaryFunctionEvent & { FEV1Percent: number } => p.FEV1Percent != null,
  );
}

export function selectMicrobiology(events: ClinicalEvent[]): MicrobiologyEvent[] {
  return sortByDate(events.filter(isMicrobiology));
}

export function selectExacerbations(events: ClinicalEvent[]): ExacerbationEvent[] {
  return sortByDate(events.filter(isExacerbation));
}

export function selectHospitalizationCount(events: ClinicalEvent[], upToDate: string | null): number {
  const d = upToDate ? new Date(upToDate) : null;
  return events.filter((e) => {
    if (d && new Date(e.date) > d) return false;
    return (e.type === CLINICAL_EVENT_TYPES.EXACERBATION && e.hospitalization) || e.type === CLINICAL_EVENT_TYPES.HOSPITALIZATION;
  }).length;
}

export function selectImaging(events: ClinicalEvent[]): ImagingEvent[] {
  return sortByDate(events.filter(isImaging));
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
    const label = s.dose ? `${cap(s.drug)} ${s.dose}${s.schedule ? " (" + s.schedule + ")" : ""}` : (cap(s.drug) ?? s.drug);
    return {
      id: s.id,
      name: label,
      start: s.date,
      end: stop ? stop.date : null,
      status: stop ? "Finalizado" : "Activo",
      category: s.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT ? "Soporte respiratorio" : "Farmacológico",
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

export function exacerbationsByYear(patient: Patient): ExacerbationYearCount[] {
  const byYear: Record<number, number> = {};
  selectExacerbations(patient.events).forEach((e) => {
    const y = yearOf(e.date);
    byYear[y] = (byYear[y] || 0) + 1;
  });
  return Object.entries(byYear)
    .map(([year, count]) => ({ year: parseInt(year, 10), count }))
    .sort((a, b) => a.year - b.year);
}
