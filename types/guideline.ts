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

/**
 * Si una recomendación aplica por pertenecer a la población diana de la
 * guía (p. ej. "todos los pacientes con bronquiectasias") o si exige
 * comprobar criterios clínicos concretos en el paciente.
 *
 * Se declara explícitamente en cada GuidelineRecommendation en vez de
 * inferirse de `criteria`/`prerequisites` vacíos, para que el código que
 * lo consume (p. ej. GuidelinesReviewTab) no tenga que reconstruir esa
 * distinción cada vez ni arriesgarse a inferirla mal si el modelo
 * cambia. El valor SÍ se deriva del contenido real de cada recomendación
 * (general ⟺ `criteria.length === 0 && prerequisites.length === 0`,
 * ver notas de fidelidad en ers2025.ts/separ2018.ts) — no es una
 * clasificación clínica nueva, solo la hace explícita.
 */
export type RecommendationApplicability = "general" | "conditional";

/** Recomendación GRADE puntual, o una actuación hija dentro de un bloque narrativo. */
export interface GuidelineRecommendation extends GuidelineCitation {
  recommendationId: string;
  topic: GuidelineTopic;
  /** El texto operativo de la recomendación ("we recommend...", "se recomienda..."), fiel al original — no se convierte una condicional en absoluta. */
  recommendationText: string;
  /** Si aplica por población diana ("general") o exige criterios clínicos concretos ("conditional") — ver RecommendationApplicability. */
  applicability: RecommendationApplicability;
  /** GuidelineCriterion.criterionId de las condiciones de inclusión/población que definen a quién aplica. */
  criteria: string[];
  /** GuidelineCriterion.criterionId de las condiciones de exclusión explícitas (su presencia contraindica la recomendación). */
  exclusions: string[];
  /**
   * GuidelineCriterion.criterionId de comprobaciones de seguridad que el
   * texto exige realizar/confirmar explícitamente antes de aplicar la
   * recomendación (p. ej. "NTM infection should be excluded before
   * initiating..."). Semánticamente distinto de `exclusions`: en una
   * exclusión, no poder confirmarla no bloquea la recomendación (se
   * asume ausente salvo evidencia en contra, como en la práctica
   * clínica habitual); en un prerrequisito, no poder confirmar que la
   * comprobación se hizo SÍ impide `applies` — la evaluación de cada
   * criterionId listado aquí sigue la misma polaridad que en `criteria`
   * (cumplido = no bloquea; no cumplido/con evidencia en contra =
   * bloquea; sin datos = falta información), nunca la polaridad
   * invertida de `exclusions`.
   */
  prerequisites: string[];
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
 * paciente concreto. Producido por engines/guidelines/match.ts
 * (evaluación real, alcance inicial: macrólidos, antibióticos inhalados,
 * erradicación de Pseudomonas, corticoides inhalados y fisioterapia/
 * aclaramiento de vía aérea — ver ese archivo para el registro de
 * criterios soportados). NO conectado todavía a Sentinel, Turning Points,
 * Missing Information, Review Opportunities ni a la UI.
 */
export interface GuidelineMatch {
  patientId: string;
  recommendationId: string;
  status: GuidelineMatchStatus;
  /** GuidelineCriterion.criterionId (de `criteria` o `prerequisites`) que el paciente cumple, con certeza o con evidencia de confianza baja (ver `status: "possibly_applies"`). */
  matchedCriteria: string[];
  /** GuidelineCriterion.criterionId (de `criteria` o `prerequisites`) evaluados y confirmados como NO cumplidos (distinto de faltar información). Un `prerequisites` no cumplido bloquea la recomendación igual que un `unmatchedCriteria` de `criteria`. */
  unmatchedCriteria: string[];
  /** GuidelineCriterion.criterionId (de `criteria` o `prerequisites`) que no se pueden evaluar por falta de datos estructurados del paciente. Cualquiera de los dos fuerza `insufficient_data` — nunca se asume cumplido. */
  missingCriteria: string[];
  /** GuidelineCriterion.criterionId (de `exclusions`) que el paciente sí cumple (contraindicarían la recomendación). */
  conflictingCriteria: string[];
  /** Datos concretos del paciente usados en la evaluación (con fecha, cuando proceda), para trazabilidad. */
  patientEvidence: EvidenceItem[];
  /** Cita exacta de la guía que respalda la recomendación evaluada (idéntica a la de la GuidelineRecommendation). */
  guidelineCitation: GuidelineCitation;
}
