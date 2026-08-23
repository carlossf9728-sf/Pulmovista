import type { EvidenceQuality, RecommendationStrength } from "./guideline";
import type { ClinicalExplanation, EvidenceItem } from "./evidence";

/**
 * SentinelEngine — migrado de heurísticas legacy a GuidelineMatch.
 * ----------------------------------------------------------------------
 * Separa explícitamente dos capas, igual que TurningPoints:
 *
 *   1. Detección OBJETIVA (`ObjectiveSentinelSignal`, ver
 *      engines/sentinel/objectiveDetectors.ts): cambios calculables
 *      directamente de los datos del paciente (caída de FEV1, aumento de
 *      exacerbaciones, aislamiento microbiológico persistente, inicio de
 *      soporte respiratorio). No atribuye ningún significado clínico.
 *   2. Interpretación respaldada por guía (`SentinelGuidelineInterpretation`,
 *      ver engines/sentinel/guidelineInterpretation.ts, derivada de
 *      GuidelineMatch sin modificar su lógica): solo existe cuando hay al
 *      menos una GuidelineRecommendation, dentro del alcance actual de
 *      GuidelineMatch (macrólidos, antibióticos inhalados, erradicación
 *      de Pseudomonas, corticoides inhalados, fisioterapia/aclaramiento),
 *      cuyo criterio se relaciona con la señal objetiva. Si no la hay,
 *      `guidelineInterpretations` queda vacío y se muestra
 *      `noSupportMessage` — nunca se rellena con una interpretación
 *      heurística ni se inventa una recomendación.
 *
 * `SentinelFinding` es la composición de ambas capas y lo que consume la
 * UI (SentinelView, AlertsTab). Ya no existen las heurísticas legacy
 * (`legacyRules.ts`, eliminado) ni su noción de "confianza" — el
 * respaldo clínico, cuando existe, es siempre la fuerza/calidad de
 * evidencia GRADE que la propia guía declara.
 */

export type SentinelSignalId = "fev1-trend-decline" | "exacerbation-rate-increase" | "persistent-organism" | "new-respiratory-support";

/** Cambio objetivo, calculable directamente de los datos del paciente — sin significado clínico atribuido. */
export interface ObjectiveSentinelSignal {
  signalId: SentinelSignalId;
  label: string;
  datum: string;
  evidence: EvidenceItem[];
  /** Valor central objetivo (p. ej. el organismo persistente), disponible para vincular con GuidelineCriterion sin volver a parsear `datum`. */
  subject?: string;
}

/**
 * Traducción a lenguaje clínico del estado de una GuidelineRecommendation
 * para este paciente concreto — la UI nunca muestra el término técnico
 * "GuidelineMatch", solo esta etiqueta.
 */
export type SentinelStatusLabel = "Cumple" | "Posiblemente cumple" | "Información insuficiente" | "No cumple";

export interface SentinelGuidelineInterpretation {
  guidelineId: string;
  society: string;
  year: number;
  recommendationId: string;
  recommendationText: string;
  statusLabel: SentinelStatusLabel;
  strength: RecommendationStrength | null;
  evidenceQuality: EvidenceQuality | null;
  section: string | null;
  page: number | null;
  sourceText: string;
  /** Cadena completa del botón "¿Por qué?": dato del paciente → criterio de la guía → evaluación → recomendación → guía → sección → página → fragmento fuente. */
  explanation: ClinicalExplanation;
}

export interface SentinelFinding extends ObjectiveSentinelSignal {
  /** Interpretaciones respaldadas por guía — ERS y SEPAR siempre por separado, nunca fusionadas. Vacío si no hay soporte suficiente. */
  guidelineInterpretations: SentinelGuidelineInterpretation[];
  /** Mensaje fijo cuando `guidelineInterpretations` está vacío; `null` en caso contrario. */
  noSupportMessage: string | null;
}
