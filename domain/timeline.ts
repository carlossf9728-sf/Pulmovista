import { cap } from "@/utils/text";
import { formatZScore } from "./pft";
import { classifyRadiologyTrend } from "./radiologyTrend";
import { isSevereExacerbation } from "./selectors";
import { CLINICAL_EVENT_TYPES } from "./clinicalEvent";
import type { ClinicalEvent, ExacerbationEvent } from "@/types/clinicalEvent";
import type { ClinicalTrend } from "@/types/clinicalTrend";
import type { TimelineEntry } from "@/types/timeline";
import type { TurningPointCriterion } from "@/types/turningPoints";

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
    case CLINICAL_EVENT_TYPES.DIAGNOSIS:
      return { group: "Consulta", title: e.label, detail: e.rawText || "Diagnóstico registrado en el historial." };
    default:
      // Los 11 tipos de ClinicalEvent están cubiertos arriba; esta rama es inalcanzable en tiempo de ejecución, pero se conserva como red de seguridad si se añade un tipo nuevo sin actualizar este switch.
      return { group: "Consulta", title: "Evento clínico", detail: "" };
  }
}

/**
 * Clave de agrupación por "episodio" para la Cronología. Cae a la fecha
 * (agrupa lo del mismo día) salvo que el evento traiga `episodeId`
 * informado — hoy es el caso de un episodio de ingreso (ver
 * domain/episode.ts), que puede abarcar varios días reales.
 */
export function episodeKeyForEvent(e: ClinicalEvent): string {
  return e.episodeId ?? e.date;
}

export interface TimelineCluster<T> {
  key: string;
  /** Fecha representativa del cluster: la más antigua entre sus eventos (no necesariamente la del primero agrupado). */
  date: string;
  rows: T[];
}

/**
 * Agrupa una lista de eventos (ya trae su propio `.display`, sea el que
 * sea) por `episodeKeyForEvent`. Preserva el orden de aparición: si la
 * lista de entrada ya viene ordenada por fecha, los clusters resultantes
 * también lo están (los eventos de una misma clave quedan siempre
 * contiguos tras un `sort` estable) — salvo su posición en el array de
 * salida, que queda fijada por el primer evento con esa clave que se
 * encuentre, no por `date` (que sí se mantiene siempre como la fecha
 * mínima). Para episodios de un único día esto es irrelevante (mismo
 * dato); para un episodio de ingreso multi-día en principio también,
 * salvo que otro evento no vinculado caiga justo entre la fecha mínima
 * del episodio y la del primer evento vinculado encontrado — caso
 * patológico no resuelto aquí. No decide nada clínico: es agrupación
 * pura por clave.
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
      const cluster = clusters[existingIdx];
      cluster.rows.push(row);
      if (row.date < cluster.date) cluster.date = row.date;
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

/**
 * Interpretación clínica (capa 2) asociada a un criterio de Turning
 * Point YA EXISTENTE — no crea ningún criterio nuevo, solo traduce 3 de
 * los 5 ya establecidos (ver engines/turningPoints/objectiveDetectors.ts)
 * al vocabulario compartido Empeoramiento/Mejoría/sin etiqueta, en los
 * dominios donde el usuario lo ha autorizado explícitamente:
 *
 * - "restrictive-decline" (función pulmonar: caída de FVC ≥10% en ≤14
 *   meses) → Empeoramiento. Deliberadamente NO se generaliza a "3
 *   valores consecutivos" ni a ningún otro patrón de FEV1/FVC — ver
 *   nota de fidelidad en TimelineTab.tsx.
 * - "exacerbation-rate-jump" (salto ≥2 exacerbaciones/año) → Empeoramiento.
 * - "first-hospitalization" (primera exacerbación con ingreso) →
 *   Empeoramiento.
 *
 * "first-persistent-organism" (microbiología) y
 * "respiratory-support-start" (tratamiento) se dejan sin interpretar a
 * propósito — el usuario ha pedido explícitamente NO convertir
 * automáticamente un nuevo microorganismo ni un cambio de tratamiento
 * en una etiqueta de mejoría/empeoramiento. Esos dos criterios se
 * siguen mostrando como "Momento clave" genérico, sin esta etiqueta.
 *
 * Ningún criterio de Turning Points tiene hoy una contrapartida de
 * "mejoría" (el motor solo detecta empeoramientos objetivos) — por eso
 * esta función nunca devuelve "Mejoría".
 */
export function turningPointTrend(criterion: TurningPointCriterion): ClinicalTrend {
  switch (criterion) {
    case "restrictive-decline":
    case "exacerbation-rate-jump":
    case "first-hospitalization":
      return "Empeoramiento";
    case "first-persistent-organism":
    case "respiratory-support-start":
      return null;
  }
}

/**
 * Interpretación clínica (capa 2) de UNA exacerbación por sí sola, sin
 * necesidad de que coincida con un Turning Point — a diferencia de
 * "first-hospitalization" (que solo marca la PRIMERA vez), toda
 * exacerbación grave u hospitalizada es, por definición ya usada en el
 * resto de la app (ver domain/selectors.ts#isSevereExacerbation, misma
 * fuente que engines/guidelines/match.ts), un acontecimiento
 * desfavorable — se muestra siempre que ocurra, no solo la primera vez.
 * No hay contrapartida de "Mejoría": no existe en la app ningún
 * criterio ya establecido para "reducción clara" de exacerbaciones.
 */
export function exacerbationOwnTrend(e: ExacerbationEvent): ClinicalTrend {
  return isSevereExacerbation(e) ? "Empeoramiento" : null;
}

/**
 * Interpretación clínica (capa 2) de UN evento de la Cronología —
 * combina, según el dominio, la señal propia del evento
 * (`exacerbationOwnTrend`), el texto del propio informe (radiología,
 * ver domain/radiologyTrend.ts) o un Turning Point ya existente cuyo
 * criterio pertenezca a ESE dominio concreto (nunca un Turning Point de
 * otro dominio que coincida en fecha por casualidad — de ahí el filtro
 * por tipo de evento antes de aplicar `turningPointTrend`).
 *
 * Todo lo demás (microbiología, tratamientos, analítica,
 * ingresos/procedimientos sueltos, diagnósticos) devuelve siempre
 * `null` en esta fase — el usuario ha pedido explícitamente no
 * clasificarlos todavía sin información explícita y fiable.
 */
export function trendForRow(e: ClinicalEvent, matchingTurningPointCriterion: TurningPointCriterion | null): ClinicalTrend {
  switch (e.type) {
    case CLINICAL_EVENT_TYPES.IMAGING:
      return classifyRadiologyTrend(e.text).trend;
    case CLINICAL_EVENT_TYPES.EXACERBATION: {
      const own = exacerbationOwnTrend(e);
      if (own) return own;
      if (matchingTurningPointCriterion === "exacerbation-rate-jump" || matchingTurningPointCriterion === "first-hospitalization") {
        return turningPointTrend(matchingTurningPointCriterion);
      }
      return null;
    }
    case CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION:
      return matchingTurningPointCriterion === "restrictive-decline" ? turningPointTrend(matchingTurningPointCriterion) : null;
    default:
      return null;
  }
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
    case CLINICAL_EVENT_TYPES.DIAGNOSIS:
      return e.label;
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
