import type { ClinicalExplanation, ClinicalSource, EvidenceItem } from "./evidence";

/**
 * MissingInfoEngine / ReviewOpportunities — LEGACY / EXPERIMENTAL.
 *
 * Ambos tipos ya incluyen `source` para que, cuando existan checklists
 * derivados de guías reales (datos mínimos exigidos por una guía para un
 * diagnóstico dado), puedan sustituir el contenido sin cambiar la forma
 * que consume AlertsTab.
 */

/**
 * Bloque agrupado de ausencias relacionadas (p. ej. "Estudio etiológico
 * de bronquiectasias incompleto"), distinto de un `items` suelto porque:
 * (1) agrupa varios componentes bajo un mismo concepto en vez de listarlos
 * como líneas sueltas sin relación aparente, y (2) puede llevar una
 * `explanation` citable para "¿Por qué?" — nunca una orden clínica
 * ("debe pedir X"), solo una constatación de qué no consta y, si existe,
 * la fuente estructurada que justifica revisarlo.
 */
export interface MissingInfoGroup {
  title: string;
  /** Solo los componentes que NO constan — es una constatación, no una lista de comprobación completa con lo ya hecho. */
  missingComponents: string[];
  /** null cuando no hay ninguna fuente estructurada y citable que respalde el bloque — nunca se inventa una recomendación para rellenar esto. */
  explanation: ClinicalExplanation | null;
}

export interface MissingInfoResult {
  category: string;
  items: string[];
  /** Bloques agrupados con posible trazabilidad "¿Por qué?" — ver MissingInfoGroup. [] si ninguno aplica. */
  groups: MissingInfoGroup[];
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
