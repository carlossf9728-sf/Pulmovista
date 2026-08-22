import type { ClinicalExplanation, ClinicalSource, EvidenceItem } from "./evidence";

/**
 * SentinelEngine — LEGACY / EXPERIMENTAL.
 *
 * `SentinelFinding` es el contrato de salida que consume la UI
 * (SentinelView, AlertsTab). Hoy se rellena a partir de
 * `engines/sentinel/legacyRules.ts` (heurísticas locales). El campo
 * `source` ya distingue el origen, así que en una fase futura este mismo
 * tipo podrá rellenarse a partir de `GuidelineMatch` sin tocar la UI:
 *
 *   datos del paciente → GuidelineEngine → GuidelineMatch → SentinelFinding
 */
export type SentinelConfidence = "Alta" | "Moderada" | "Baja";

export interface SentinelFinding {
  ruleId: string;
  label: string;
  source: ClinicalSource;
  datum: string;
  interpretation: string;
  recommendation: string;
  evidence: EvidenceItem[];
  confidence: SentinelConfidence;
  explanation: ClinicalExplanation;
}
