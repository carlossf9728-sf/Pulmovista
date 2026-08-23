/**
 * Helpers de presentación compartidos para explicar un GuidelineMatch —
 * usados por la pestaña "Revisión según guías" y por SentinelEngine tras
 * su migración a GuidelineMatch. No contienen lógica clínica: solo
 * resuelven ids a texto legible (vía findCriterionById) y dan formato a
 * fechas/etiquetas. No modifican ni reinterpretan nada de match.ts.
 */
import { formatDate } from "@/utils/date";
import { findCriterionById } from "./knowledge";
import type { GuidelineMatch } from "@/types/guideline";
import type { EvidenceItem } from "@/types/evidence";

/** Descripción legible de un criterio; si no se encuentra, el propio id (no debería ocurrir — GuidelineMatch solo referencia criterionId reales). */
export function criterionLine(criterionId: string): string {
  return findCriterionById(criterionId)?.description ?? criterionId;
}

export function evidenceLine(e: EvidenceItem): string {
  return e.date ? `${formatDate(e.date)} — ${e.label}` : e.label;
}

/** Resume matchedCriteria/unmatchedCriteria/missingCriteria/conflictingCriteria de un GuidelineMatch en una línea legible, con su resultado. */
export function criteriaSummaryText(match: GuidelineMatch): string {
  const parts = [
    ...match.matchedCriteria.map((id) => `${criterionLine(id)} — cumplido`),
    ...match.unmatchedCriteria.map((id) => `${criterionLine(id)} — no cumplido`),
    ...match.missingCriteria.map((id) => `${criterionLine(id)} — sin datos suficientes`),
    ...match.conflictingCriteria.map((id) => `${criterionLine(id)} — exclusión presente`),
  ];
  return parts.length ? parts.join(" · ") : "Sin criterios verificables asociados a esta recomendación.";
}
