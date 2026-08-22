import type { ClinicalExplanation, ClinicalSource, EvidenceItem } from "./evidence";

/**
 * TurningPointsEngine — separa explícitamente:
 *
 *   1. Detección objetiva (`ObjectiveTurningPoint`): el "antes/después" de
 *      datos medibles (exacerbaciones, FVC, microbiología, hospitalización,
 *      soporte respiratorio). No depende de frases clínicas fijas — el
 *      campo opcional `subject` guarda el valor central (organismo,
 *      fármaco...) para que la capa de interpretación no tenga que volver
 *      a parsear texto ya formateado.
 *   2. Interpretación (LEGACY hoy, `engines/turningPoints/legacyInterpretations.ts`):
 *      la frase que explica el significado clínico. Pendiente de sustituir
 *      por contenido derivado de guías.
 *
 * `TurningPoint` es la composición de ambas capas, y es lo que consume la UI.
 */

export type TurningPointCriterion =
  | "exacerbation-rate-jump"
  | "restrictive-decline"
  | "first-persistent-organism"
  | "first-hospitalization"
  | "respiratory-support-start";

export interface ObjectiveTurningPoint {
  id: string;
  criterion: TurningPointCriterion;
  date: string;
  label: string;
  before: Record<string, string | null>;
  after: Record<string, string | null>;
  evidence: EvidenceItem[];
  /**
   * Valor objetivo central del turning point (p. ej. nombre del organismo
   * o del fármaco), disponible para que la interpretación construya su
   * mensaje sin acoplarse a una frase fija ni volver a parsear `before`/`after`.
   * No se renderiza directamente: la UI sigue mostrando solo `before`/`after`.
   */
  subject?: string;
}

export interface TurningPoint extends ObjectiveTurningPoint {
  source: ClinicalSource;
  interpretation: string;
  explanation: ClinicalExplanation;
}
