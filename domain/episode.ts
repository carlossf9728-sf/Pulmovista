/**
 * Episodio clínico de ingreso: una ExacerbationEvent con
 * `hospitalization=true` actúa como el episodio contenedor (nunca el
 * tipo `HospitalizationEvent` independiente — se deja fuera del rol de
 * contenedor mientras no exista una estrategia de reconciliación con el
 * conteo potencialmente duplicado ya documentado en domain/selectors.ts).
 *
 * Los subeventos del episodio (soporte respiratorio, pruebas,
 * tratamientos, diagnósticos) siguen siendo ClinicalEvent independientes
 * en su propio dominio — se asocian aquí únicamente mediante el
 * `episodeId` compartido (ClinicalEventBase), nunca copiados ni
 * duplicados: el mismo evento que aparece en su pestaña específica
 * (Microbiología, Radiología...) es el que se referencia aquí.
 */
import { cap } from "@/utils/text";
import { daysBetween } from "@/utils/date";
import { CLINICAL_EVENT_TYPES } from "./clinicalEvent";
import { microbiologyObjectiveChange } from "./microbiologyTrend";
import { selectMicrobiology } from "./selectors";
import type {
  ClinicalEvent,
  DiagnosisEvent,
  ExacerbationEvent,
  ImagingEvent,
  LabResultsEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
  TreatmentStartedEvent,
  TreatmentStoppedEvent,
} from "@/types/clinicalEvent";

export function isHospitalizationEpisode(e: ClinicalEvent): e is ExacerbationEvent {
  return e.type === CLINICAL_EVENT_TYPES.EXACERBATION && e.hospitalization === true;
}

/** Duración del ingreso en días. null si falta la fecha de alta o es anterior al ingreso (dato incoherente: no se muestra en vez de mostrar un negativo). */
export function episodeDurationDays(container: ExacerbationEvent): number | null {
  if (!container.dischargeDate) return null;
  const days = daysBetween(container.date, container.dischargeDate);
  return days >= 0 ? days : null;
}

/** "Exacerbación grave · ingreso 7 días" — titular resumido del episodio para la Cronología. */
export function episodeHeadline(container: ExacerbationEvent): string {
  const severity = container.severity ? ` ${container.severity.toLowerCase()}` : "";
  const days = episodeDurationDays(container);
  const duration = days != null ? ` · ingreso ${days} día${days === 1 ? "" : "s"}` : "";
  return cap(`exacerbación${severity}${duration}`) ?? `Exacerbación${severity}${duration}`;
}

/**
 * Línea de aviso corta bajo el titular, p. ej. "Precisó VMNI · alta a
 * domicilio". Solo compone datos ya estructurados (drug del soporte
 * respiratorio vinculado, dischargeDisposition) — null si no hay nada
 * que mostrar.
 */
export function episodeHighlightLine(container: ExacerbationEvent, linked: ClinicalEvent[]): string | null {
  const supportDrugs = Array.from(
    new Set(
      linked
        .filter((e): e is RespiratorySupportEvent => e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT)
        .map((e) => e.drug)
        .filter((d): d is string => Boolean(d)),
    ),
  );
  const fragments: string[] = [];
  if (supportDrugs.length) fragments.push(`Precisó ${supportDrugs.join(", ")}`);
  if (container.dischargeDisposition) fragments.push(`alta a ${container.dischargeDisposition.toLowerCase()}`);
  if (!fragments.length) return null;
  const line = fragments.join(" · ");
  return cap(line) ?? line;
}

/** Eventos vinculados al episodio por `episodeId` — nunca el propio contenedor, ordenados por fecha. [] si el episodio no tiene episodeId (no hay nada que vincular). */
export function selectLinkedEpisodeEvents(container: ExacerbationEvent, allEvents: ClinicalEvent[]): ClinicalEvent[] {
  if (!container.episodeId) return [];
  return allEvents.filter((e) => e.id !== container.id && e.episodeId === container.episodeId).sort((a, b) => a.date.localeCompare(b.date));
}

export interface EpisodeSections {
  support: RespiratorySupportEvent[];
  tests: (MicrobiologyEvent | ImagingEvent | LabResultsEvent | PulmonaryFunctionEvent)[];
  treatmentsDuring: TreatmentStartedEvent[];
  treatmentsAtDischarge: TreatmentStartedEvent[];
  stopped: TreatmentStoppedEvent[];
  diagnoses: DiagnosisEvent[];
}

/**
 * Clasifica los eventos ya vinculados (ver `selectLinkedEpisodeEvents`)
 * por sección para el detalle del episodio. Un TreatmentStartedEvent se
 * considera "al alta" solo cuando su fecha coincide exactamente con
 * `dischargeDate`; cualquier fecha anterior es "durante el ingreso". Sin
 * fecha de alta, todo tratamiento vinculado se trata como "durante el
 * ingreso" — no hay forma de distinguir sin ese dato.
 */
export function groupLinkedEventsBySection(container: ExacerbationEvent, linked: ClinicalEvent[]): EpisodeSections {
  const sections: EpisodeSections = { support: [], tests: [], treatmentsDuring: [], treatmentsAtDischarge: [], stopped: [], diagnoses: [] };
  for (const e of linked) {
    switch (e.type) {
      case CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT:
        sections.support.push(e);
        break;
      case CLINICAL_EVENT_TYPES.MICROBIOLOGY:
      case CLINICAL_EVENT_TYPES.IMAGING:
      case CLINICAL_EVENT_TYPES.LAB_RESULTS:
      case CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION:
        sections.tests.push(e);
        break;
      case CLINICAL_EVENT_TYPES.TREATMENT_STARTED:
        if (container.dischargeDate && e.date === container.dischargeDate) sections.treatmentsAtDischarge.push(e);
        else sections.treatmentsDuring.push(e);
        break;
      case CLINICAL_EVENT_TYPES.TREATMENT_STOPPED:
        sections.stopped.push(e);
        break;
      case CLINICAL_EVENT_TYPES.DIAGNOSIS:
        sections.diagnoses.push(e);
        break;
      default:
        break;
    }
  }
  return sections;
}

export interface EpisodeChange {
  label: string;
  date: string;
}

/**
 * "Qué cambió tras este episodio" — solo señales objetivas y
 * conservadoras, cada una apoyada en un criterio ya existente en la app
 * (nunca uno nuevo):
 *  - capa 1 de microbiología (domain/microbiologyTrend.ts): nuevo
 *    aislamiento tras el alta.
 *  - el mismo criterio restrictive-decline de Turning Points, calculado
 *    por quien llama (`restrictiveDeclineDates`) para no acoplar este
 *    módulo a engines/ — igual patrón que domain/timeline.ts#trendForRow.
 *  - un soporte respiratorio que no existía antes del ingreso y aparece
 *    tras el alta.
 *  - un nuevo diagnóstico registrado tras el alta.
 * No se incluye "inicio de antibiótico inhalado": no hay un criterio ya
 * existente y fiable para detectarlo de forma genérica (qué fármaco
 * cuenta como "inhalado") sin inventar una heurística nueva.
 */
export function changesAfterEpisode(container: ExacerbationEvent, allEvents: ClinicalEvent[], restrictiveDeclineDates: ReadonlySet<string>): EpisodeChange[] {
  const dischargeDate = container.dischargeDate;
  if (!dischargeDate) return [];
  const changes: EpisodeChange[] = [];

  const micro = selectMicrobiology(allEvents);
  for (const m of micro) {
    if (m.date > dischargeDate && microbiologyObjectiveChange(m, micro) === "Nuevo aislamiento") {
      changes.push({ label: `Nuevo aislamiento microbiológico: ${m.organism}`, date: m.date });
    }
  }

  for (const e of allEvents) {
    if (e.type === CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION && e.date > dischargeDate && restrictiveDeclineDates.has(e.date)) {
      changes.push({ label: "Deterioro funcional posterior (descenso restrictivo de FVC)", date: e.date });
    }
  }

  const supportBefore = allEvents.some((e) => e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT && e.date < container.date);
  if (!supportBefore) {
    const supportAfter = allEvents
      .filter((e): e is RespiratorySupportEvent => e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT && e.date > dischargeDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (supportAfter) changes.push({ label: `Nueva necesidad de soporte respiratorio: ${supportAfter.drug}`, date: supportAfter.date });
  }

  const diagnosisAfter = allEvents
    .filter((e): e is DiagnosisEvent => e.type === CLINICAL_EVENT_TYPES.DIAGNOSIS && e.date > dischargeDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (diagnosisAfter) changes.push({ label: `Nuevo diagnóstico relevante: ${diagnosisAfter.label}`, date: diagnosisAfter.date });

  return changes.sort((a, b) => a.date.localeCompare(b.date));
}
