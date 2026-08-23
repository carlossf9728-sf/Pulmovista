/**
 * Helpers de presentación compartidos para explicar un GuidelineMatch —
 * usados por la pestaña "Revisión según guías" y por SentinelEngine tras
 * su migración a GuidelineMatch. No contienen lógica clínica: solo
 * resuelven ids a texto legible (vía findCriterionById) y dan formato a
 * fechas/etiquetas. No modifican ni reinterpretan nada de match.ts.
 */
import { formatDate } from "@/utils/date";
import { findCriterionById } from "./knowledge";
import type { GuidelineDocument, GuidelineMatch, GuidelineMatchStatus } from "@/types/guideline";
import type { ClinicalExplanationCitation, EvidenceItem } from "@/types/evidence";

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

/**
 * Traduce el status de un GuidelineMatch a una frase completa en español
 * — la síntesis propia de PulmoVista, distinta tanto del dato del
 * paciente como del texto literal de la recomendación. El término
 * "GuidelineMatch" nunca aparece: solo esta frase.
 */
export function interpretationSentence(status: GuidelineMatchStatus): string {
  switch (status) {
    case "applies":
      return "Con los datos disponibles, este paciente cumple el criterio clínico de la guía para esta recomendación.";
    case "possibly_applies":
      return "Con los datos disponibles, este paciente podría cumplir el criterio clínico de la guía, pero la evidencia disponible no permite confirmarlo con certeza.";
    case "insufficient_data":
      return "No hay información suficiente en los datos estructurados del paciente para determinar si cumple este criterio clínico de la guía.";
    case "does_not_apply":
      return "Con los datos disponibles, este paciente no cumple el criterio clínico de la guía para esta recomendación.";
  }
}

/** Cita estructurada (sociedad, año, sección, página, fragmento) para el bloque "Fuente" de WhyModal. `undefined` si no se encuentra el documento (no debería ocurrir). */
export function buildCitation(match: GuidelineMatch, document: GuidelineDocument | undefined): ClinicalExplanationCitation | undefined {
  if (!document) return undefined;
  return {
    society: document.source.society,
    year: document.source.year,
    section: match.guidelineCitation.section,
    page: match.guidelineCitation.page,
    sourceText: match.guidelineCitation.sourceText,
  };
}
