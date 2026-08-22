import type { EvidenceItem } from "./evidence";

/**
 * GuidelineEngine — tipos preparatorios para la siguiente gran fase.
 *
 * En esta fase GUIDELINES sigue siendo un stub con contenido simulado
 * (ver engines/guidelines/data.ts): ningún texto de recomendación aquí es
 * real ni debe tratarse como tal. El objetivo de estos tipos es dejar la
 * arquitectura lista para que, cuando se carguen guías reales, el flujo
 *
 *   datos del paciente → GuidelineEngine → GuidelineMatch → alerta
 *
 * pueda sustituir a Sentinel/Turning Points/Missing Info legacy sin
 * rediseñar la interfaz ni los componentes de UI.
 */

/** Fuente bibliográfica de una guía (sociedad científica, año, documento). */
export interface GuidelineSource {
  sourceId: string;
  society: string;
  title: string;
  year: number;
  url?: string | null;
}

/** Metadatos de una guía clínica, independientes de sus recomendaciones concretas. */
export interface GuidelineDefinition {
  guidelineId: string;
  source: GuidelineSource;
  /** Categoría diagnóstica a la que aplica (ver domain/diagnosis.ts#classifyDiagnosis). */
  disease: string;
  section?: string | null;
  page?: number | null;
  keywords: string[];
}

/**
 * Condición estructurada que una recomendación exige verificar en los
 * datos del paciente. La evaluación real (comparar contra ClinicalEvent[])
 * es trabajo de la siguiente fase; hoy solo se declara la forma.
 */
export interface GuidelineCondition {
  conditionId: string;
  description: string;
}

/** Recomendación concreta dentro de una guía. */
export interface GuidelineRecommendation {
  recommendationId: string;
  guidelineId: string;
  title: string;
  conditions: GuidelineCondition[];
  /** Contenido simulado hasta que se cargue el texto real de la recomendación. */
  recommendationText: string;
  evidenceLevel?: string | null;
}

/** Guía completa: metadatos + recomendaciones asociadas. */
export interface Guideline {
  definition: GuidelineDefinition;
  recommendations: GuidelineRecommendation[];
}

export type GuidelineMatchStatus =
  | "applies"
  | "possibly_applies"
  | "insufficient_data"
  | "does_not_apply";

/**
 * Resultado de evaluar una recomendación de guía contra los datos de un
 * paciente concreto. No se genera todavía en esta fase (GuidelineEngine
 * expone `matchGuidelines()` como stub que devuelve `[]`), pero el tipo
 * queda fijado para que Sentinel/Turning Points puedan consumirlo después.
 */
export interface GuidelineMatch {
  recommendationId: string;
  patientId: string;
  status: GuidelineMatchStatus;
  matchedConditions: string[];
  missingConditions: string[];
  conflictingConditions: string[];
  patientEvidence: EvidenceItem[];
}
