import type { ClinicalExplanation, ClinicalSource, EvidenceItem } from "./evidence";

/**
 * TurningPointsEngine — separa explícitamente:
 *
 *   1. Detección objetiva (`ObjectiveTurningPoint`): el "antes/después" de
 *      datos medibles (exacerbaciones, FVC, microbiología, hospitalización,
 *      soporte respiratorio). No depende de frases clínicas fijas.
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
  before: Record<string, string | null>;
  after: Record<string, string | null>;
  evidence: EvidenceItem[];
}

export interface TurningPoint extends ObjectiveTurningPoint {
  label: string;
  source: ClinicalSource;
  interpretation: string;
  explanation: ClinicalExplanation;
}
