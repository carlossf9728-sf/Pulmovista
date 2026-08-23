import type { EvidenceItem } from "./evidence";

/**
 * GuidelineEngine — tipos con trazabilidad exacta a la fuente.
 * ----------------------------------------------------------------------
 * Flujo previsto (todavía no implementado — ver matchGuidelines() en
 * engines/guidelines/index.ts):
 *
 *   dato del paciente → GuidelineCriterion → GuidelineMatch
 *     → GuidelineRecommendation → cita exacta de la guía
 *
 * Tres entidades citables, cada una con su propia cita exacta
 * (`guidelineId` + `section` + `page` + `sourceText`, vía `GuidelineCitation`):
 *
 * - `GuidelineDefinition`: un concepto/escala/algoritmo clínico definido
 *   por la guía (p. ej. el Bronchiectasis Severity Index, o qué es una
 *   exacerbación). No es accionable por sí sola.
 * - `GuidelineCriterion`: una condición verificable contra los datos del
 *   paciente (p. ej. "≥2 exacerbaciones en el año previo"). Reutilizable
 *   entre varias recomendaciones, como población de inclusión o exclusión.
 * - `GuidelineRecommendation`: una recomendación GRADE puntual (fuerza +
 *   calidad de evidencia), que referencia los `GuidelineCriterion` que
 *   definen a quién aplica (`criteria`) y a quién excluye (`exclusions`).
 *   Cuando una guía agrupa varias actuaciones bajo una única fuerza/
 *   evidencia global (p. ej. una "narrative question" del ERS), el grupo
 *   se representa como una recomendación padre y cada actuación
 *   separable como una recomendación hija (`parentRecommendationId`) con
 *   `strength`/`evidenceQuality` en `null` — la guía no les da una fuerza
 *   individual y no se la inventamos.
 *
 * `GuidelineDocument` son los metadatos del documento en sí (sociedad,
 * año, título) — no lleva cita de página/sección porque no es una
 * afirmación puntual, es el propio documento.
 */

/** Fuente bibliográfica de una guía (sociedad científica, año, documento). */
export interface GuidelineSource {
  sourceId: string;
  society: string;
  title: string;
  year: number;
  url?: string | null;
}

/** Metadatos del documento (no es una afirmación citable puntual). */
export interface GuidelineDocument {
  guidelineId: string;
  source: GuidelineSource;
  /** Categoría diagnóstica a la que aplica (ver domain/diagnosis.ts#classifyDiagnosis). */
  disease: string;
  /** Etiqueta libre de foco/sección principal del documento (no es una cita de página — usar GuidelineCitation para eso). */
  section?: string | null;
  keywords: string[];
}

export type RecommendationStrength = "strong" | "conditional";
export type EvidenceQuality = "very low" | "low" | "moderate" | "high";

/** Cita exacta compartida por toda entidad de conocimiento extraída de una guía. */
export interface GuidelineCitation {
  guidelineId: string;
  /** Sección/encabezado del documento tal como aparece en el original. null si no consta con claridad. */
  section: string | null;
  /** Número de página del PDF fuente. null si no consta con claridad. */
  page: number | null;
  /** Fragmento textual (verbatim o casi verbatim) que respalda la entidad, en el idioma original del documento. */
  sourceText: string;
}

/**
 * Un concepto, escala o algoritmo clínico definido explícitamente por la
 * guía. No es una recomendación accionable por sí sola.
 */
export interface GuidelineDefinition extends GuidelineCitation {
  definitionId: string;
  /** Nombre del concepto tal como lo nombra la guía, p. ej. "Bronchiectasis Severity Index (BSI)". */
  term: string;
  /** Descripción fiel al documento (puede parafrasear estructura tabular, pero no añade contenido no presente en sourceText). */
  description: string;
  topic: GuidelineTopic;
  keywords: string[];
}

/**
 * Condición verificable contra los datos de un paciente. Hoy solo se
 * declara la forma — la evaluación real contra ClinicalEvent[] es trabajo
 * de una fase futura.
 */
export interface GuidelineCriterion extends GuidelineCitation {
  criterionId: string;
  description: string;
  topic: GuidelineTopic;
  keywords: string[];
}

/** Recomendación GRADE puntual, o una actuación hija dentro de un bloque narrativo. */
export interface GuidelineRecommendation extends GuidelineCitation {
  recommendationId: string;
  topic: GuidelineTopic;
  /** El texto operativo de la recomendación ("we recommend...", "se recomienda..."), fiel al original — no se convierte una condicional en absoluta. */
  recommendationText: string;
  /** GuidelineCriterion.criterionId de las condiciones de inclusión/población que definen a quién aplica. */
  criteria: string[];
  /** GuidelineCriterion.criterionId de las condiciones de exclusión explícitas. */
  exclusions: string[];
  /**
   * null cuando esta entrada es una actuación hija dentro de un bloque
   * cuya fuerza/evidencia es global (ver `parentRecommendationId`) y la
   * guía no le da una fuerza individual.
   */
  strength: RecommendationStrength | null;
  evidenceQuality: EvidenceQuality | null;
  /** Si esta recomendación es una actuación hija de un bloque narrativo más amplio, el recommendationId del padre. */
  parentRecommendationId?: string | null;
  keywords: string[];
}

export type GuidelineTopic =
  | "diagnóstico"
  | "evaluación inicial"
  | "seguimiento"
  | "gravedad"
  | "exacerbaciones"
  | "paciente que se deteriora"
  | "microbiología"
  | "pseudomonas aeruginosa"
  | "erradicación"
  | "micobacterias"
  | "antibióticos inhalados"
  | "macrólidos"
  | "tratamiento antibiótico"
  | "tratamiento antiinflamatorio"
  | "fisioterapia respiratoria"
  | "aclaramiento mucociliar"
  | "broncodilatadores"
  | "rehabilitación pulmonar"
  | "soporte respiratorio"
  | "nutrición"
  | "hemoptisis"
  | "cirugía"
  | "trasplante"
  | "vacunación"
  | "etiología"
  | "comorbilidades"
  | "educación del paciente"
  | "atención domiciliaria";

/**
 * Agregado usado por el stub simulado original (engines/guidelines/data.ts
 * + GuidelinesView) — se mantiene con el mismo nombre de campo
 * (`definition`) por compatibilidad, sin tocar la UI en esta fase. La
 * base de conocimiento real (engines/guidelines/knowledge/) exporta sus
 * GuidelineDefinition/GuidelineCriterion/GuidelineRecommendation como
 * colecciones planas indexadas por guidelineId, sin pasar por este tipo.
 */
export interface Guideline {
  definition: GuidelineDocument;
  recommendations: GuidelineRecommendation[];
}

export type GuidelineMatchStatus =
  | "applies"
  | "possibly_applies"
  | "insufficient_data"
  | "does_not_apply";

/**
 * Resultado de evaluar una recomendación de guía contra los datos de un
 * paciente concreto. No se genera todavía (GuidelineEngine expone
 * `matchGuidelines()` como stub que devuelve `[]`), pero el tipo queda
 * fijado para que Sentinel/Turning Points puedan consumirlo después.
 */
export interface GuidelineMatch {
  recommendationId: string;
  patientId: string;
  status: GuidelineMatchStatus;
  /** GuidelineCriterion.criterionId que el paciente cumple. */
  matchedCriteria: string[];
  /** GuidelineCriterion.criterionId que no se pueden evaluar por falta de datos. */
  missingCriteria: string[];
  /** GuidelineCriterion.criterionId de exclusión que el paciente sí cumple (contraindicarían la recomendación). */
  conflictingCriteria: string[];
  patientEvidence: EvidenceItem[];
}
