import { uid } from "@/utils/id";
import {
  CLINICAL_EVENT_TYPES,
  type ClinicalEvent,
  type ClinicalEventPayload,
  type ConfidenceLevel,
  type EventSource,
} from "@/types/clinicalEvent";

export { CLINICAL_EVENT_TYPES };

/**
 * Lista documental de los niveles de confianza posibles. En el prototipo
 * original no se consumía programáticamente (solo aparecía en un
 * comentario) — se conserva por paridad y como referencia para la UI.
 */
export const CONFIDENCE_LEVELS: ConfidenceLevel[] = [
  "confirmado",
  "probable",
  "posible",
  "dato incompleto",
  "dato contradictorio",
];

export interface MkEventOptions {
  source?: EventSource;
  rawText?: string | null;
  confidence?: ConfidenceLevel;
  confidenceReason?: string | null;
  /** Vincula el evento a un episodio compartido — ver ClinicalEventBase#episodeId y domain/episode.ts. */
  episodeId?: string | null;
}

/**
 * Factoría de ClinicalEvent. Réplica de `mkEvent()` del prototipo: mismos
 * valores por defecto (source "seed_demo", confidence "confirmado").
 *
 * El tipo concreto se fija con el parámetro de tipo explícito, p. ej.
 * `mkEvent<PulmonaryFunctionEvent>(patientId, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, date, { FEV1Percent: 82 })`.
 */
export function mkEvent<T extends ClinicalEvent>(
  patientId: string | null,
  type: T["type"],
  date: string,
  payload: ClinicalEventPayload<T> = {} as ClinicalEventPayload<T>,
  opts: MkEventOptions = {},
): T {
  return {
    id: uid("ev"),
    patientId,
    date,
    type,
    source: opts.source || "seed_demo",
    rawText: opts.rawText || null,
    confidence: opts.confidence || "confirmado",
    confidenceReason: opts.confidenceReason || null,
    episodeId: opts.episodeId ?? null,
    ...payload,
  } as unknown as T;
}
