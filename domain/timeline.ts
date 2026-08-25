import { cap } from "@/utils/text";
import { formatZScore } from "./pft";
import { CLINICAL_EVENT_TYPES } from "./clinicalEvent";
import type { ClinicalEvent } from "@/types/clinicalEvent";
import type { TimelineEntry } from "@/types/timeline";

/** Traduce un ClinicalEvent a su representación en la línea de tiempo. Réplica exacta de `displayForEvent()`. */
export function displayForEvent(e: ClinicalEvent): TimelineEntry {
  switch (e.type) {
    case CLINICAL_EVENT_TYPES.CONSULTATION:
      return { group: "Consulta", title: "Consulta / evolución", detail: e.rawText || "" };
    case CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION: {
      // El z-score (cuando la prueba lo trae) se añade junto al % del predicho, nunca en su lugar — ver domain/pft.ts.
      const fev1 = `FEV1 ${e.FEV1Percent ?? "—"}%${e.FEV1zScore != null ? ` (z ${formatZScore(e.FEV1zScore)})` : ""}`;
      const fvc = e.FVCPercent != null ? ` · FVC ${e.FVCPercent}%${e.FVCzScore != null ? ` (z ${formatZScore(e.FVCzScore)})` : ""}` : "";
      return {
        group: "Función pulmonar",
        title: `${fev1}${fvc}`,
        detail: `DLCO ${e.DLCOPercent ?? "No disponible"}%`,
      };
    }
    case CLINICAL_EVENT_TYPES.MICROBIOLOGY:
      return {
        group: "Microbiología",
        title: `Cultivo: ${e.organism}`,
        detail:
          `${e.sensitivity?.length ? "Sensible a " + e.sensitivity.join(", ") + ". " : ""}${
            e.resistance?.length ? "Resistente a " + e.resistance.join(", ") + "." : ""
          }` || "Sin antibiograma registrado",
      };
    case CLINICAL_EVENT_TYPES.EXACERBATION:
      return {
        group: "Exacerbación",
        title: `Exacerbación${e.severity ? " " + e.severity.toLowerCase() : ""}${e.hospitalization ? " (hospitalización)" : ""}`,
        detail: e.confidenceReason || `Tratamiento: ${e.treatment || "No disponible"}`,
      };
    case CLINICAL_EVENT_TYPES.HOSPITALIZATION:
      return {
        group: "Hospitalización",
        title: e.procedureLabel ? `Ingreso/procedimiento: ${e.procedureLabel}` : "Hospitalización registrada",
        detail: e.confidenceReason || "Sin detalle adicional.",
      };
    case CLINICAL_EVENT_TYPES.IMAGING:
      return { group: "Radiología", title: e.label, detail: e.text };
    case CLINICAL_EVENT_TYPES.LAB_RESULTS:
      return { group: "Analítica", title: e.label, detail: e.text };
    case CLINICAL_EVENT_TYPES.TREATMENT_STARTED:
    case CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT:
      return {
        group: "Tratamiento",
        title: `Inicio: ${cap(e.drug)}`,
        detail: e.dose ? `Dosis: ${e.dose}${e.schedule ? " · " + e.schedule : ""}` : "En curso",
      };
    case CLINICAL_EVENT_TYPES.TREATMENT_STOPPED:
      return { group: "Tratamiento", title: `Finalizado: ${cap(e.drug)}`, detail: "Tratamiento retirado" };
    default:
      return { group: "Consulta", title: "Evento clínico", detail: e.rawText || "" };
  }
}

/**
 * Clave de agrupación por "episodio" para la Cronología. Hoy siempre
 * cae a la fecha (agrupa lo del mismo día), pero ya respeta
 * `episodeId` si algún evento lo trae informado — ningún motor lo
 * asigna todavía (ver nota de fidelidad en ClinicalEventBase), así que
 * en la práctica esto sigue agrupando por día. El punto es no tener que
 * volver a tocar la lógica de agrupación el día que exista una fuente
 * real de episodios: bastará con que esa fuente rellene `episodeId`.
 */
export function episodeKeyForEvent(e: ClinicalEvent): string {
  return e.episodeId ?? e.date;
}

export interface TimelineCluster<T> {
  key: string;
  /** Fecha representativa del cluster (la del primer evento agrupado). */
  date: string;
  rows: T[];
}

/**
 * Agrupa una lista de eventos (ya trae su propio `.display`, sea el que
 * sea) por `episodeKeyForEvent`. Preserva el orden de aparición: si la
 * lista de entrada ya viene ordenada por fecha, los clusters resultantes
 * también lo están (los eventos de una misma clave quedan siempre
 * contiguos tras un `sort` estable). No decide nada clínico: es
 * agrupación pura por clave.
 */
export function groupTimelineRows<T extends ClinicalEvent>(rows: T[]): TimelineCluster<T>[] {
  const clusters: TimelineCluster<T>[] = [];
  const indexByKey = new Map<string, number>();
  for (const row of rows) {
    const key = episodeKeyForEvent(row);
    const existingIdx = indexByKey.get(key);
    if (existingIdx == null) {
      indexByKey.set(key, clusters.length);
      clusters.push({ key, date: row.date, rows: [row] });
    } else {
      clusters[existingIdx].rows.push(row);
    }
  }
  return clusters;
}

/**
 * Si un ClinicalEvent debe destacarse visualmente en la Cronología —
 * reutiliza `computeTurningPoints()` (comparando por fecha exacta,
 * calculado por quien llama para no acoplar este módulo a
 * engines/turningPoints) y campos ya existentes del propio evento
 * (hospitalización, soporte respiratorio). No introduce ningún umbral
 * clínico nuevo: son las mismas condiciones que ya usan otros motores,
 * solo reutilizadas aquí para decidir peso visual, no para generar una
 * alerta nueva.
 */
export function isNotableEvent(e: ClinicalEvent, turningPointDates: ReadonlySet<string>): boolean {
  if (turningPointDates.has(e.date)) return true;
  if (e.type === CLINICAL_EVENT_TYPES.EXACERBATION && e.hospitalization) return true;
  if (e.type === CLINICAL_EVENT_TYPES.HOSPITALIZATION) return true;
  if (e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT) return true;
  return false;
}

/** Fragmento breve de UN evento para la cabecera resumida de un episodio — nunca el detalle completo, solo "qué fue". */
function episodeFragment(e: ClinicalEvent): string {
  switch (e.type) {
    case CLINICAL_EVENT_TYPES.CONSULTATION:
      return "consulta";
    case CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION:
      return "función pulmonar";
    case CLINICAL_EVENT_TYPES.MICROBIOLOGY:
      return `cultivo de ${e.organism}`;
    case CLINICAL_EVENT_TYPES.EXACERBATION:
      return "exacerbación";
    case CLINICAL_EVENT_TYPES.HOSPITALIZATION:
      return e.procedureLabel || "ingreso";
    case CLINICAL_EVENT_TYPES.IMAGING:
      return e.label;
    case CLINICAL_EVENT_TYPES.LAB_RESULTS:
      return "analítica";
    case CLINICAL_EVENT_TYPES.TREATMENT_STARTED:
    case CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT:
      return `inicio de ${e.drug}`;
    case CLINICAL_EVENT_TYPES.TREATMENT_STOPPED:
      return `fin de ${e.drug}`;
    default:
      return "evento clínico";
  }
}

/**
 * Cabecera clínica resumida de un episodio con varios eventos, p. ej.
 * "Consulta + inicio de tobramicina inhalada" o "Ingreso + exacerbación
 * + TAC tórax" — sustituye a un contador genérico ("N elementos") por
 * algo que ya dice de qué trató la visita. Solo compone los `label`/
 * `drug`/`organism` que ya trae cada evento: no resume texto libre ni
 * añade ningún juicio clínico. Con más de `maxFragments` eventos, corta
 * y añade un contador de los que faltan para no alargar la cabecera sin
 * límite.
 */
export function episodeSummary(rows: ClinicalEvent[], maxFragments = 3): string {
  const fragments = rows.map(episodeFragment);
  const shown = fragments.slice(0, maxFragments);
  const rest = fragments.length - shown.length;
  const text = rest > 0 ? `${shown.join(" + ")} +${rest} más` : shown.join(" + ");
  return cap(text) ?? text;
}
