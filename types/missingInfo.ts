import type { ClinicalSource, EvidenceItem } from "./evidence";

/**
 * MissingInfoEngine / ReviewOpportunities — LEGACY / EXPERIMENTAL.
 *
 * Ambos tipos ya incluyen `source` para que, cuando existan checklists
 * derivados de guías reales (datos mínimos exigidos por una guía para un
 * diagnóstico dado), puedan sustituir el contenido sin cambiar la forma
 * que consume AlertsTab.
 */

export interface MissingInfoResult {
  category: string;
  items: string[];
  source: ClinicalSource;
}

export interface ReviewOpportunity {
  id: string;
  title: string;
  detail: string;
  evidence: EvidenceItem[];
  note: string;
  action: string;
  source: ClinicalSource;
}
