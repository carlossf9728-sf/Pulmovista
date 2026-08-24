/**
 * Helpers de presentación compartidos para explicar un GuidelineMatch —
 * usados por la pestaña "Revisión según guías" y por SentinelEngine tras
 * su migración a GuidelineMatch. No contienen lógica clínica: solo
 * resuelven ids a texto legible (vía findCriterionById) y dan formato a
 * fechas/etiquetas. No modifican ni reinterpretan nada de match.ts.
 */
import { formatDate } from "@/utils/date";
import { findCriterionById } from "./knowledge";
import type { GuidelineDocument, GuidelineMatch, RecommendationApplicability } from "@/types/guideline";
import type { ClinicalExplanationCitation, EvidenceItem } from "@/types/evidence";
import type { Patient } from "@/types/patient";

/** Descripción legible de un criterio; si no se encuentra, el propio id (no debería ocurrir — GuidelineMatch solo referencia criterionId reales). */
export function criterionLine(criterionId: string): string {
  return findCriterionById(criterionId)?.description ?? criterionId;
}

export function evidenceLine(e: EvidenceItem): string {
  return e.date ? `${formatDate(e.date)} — ${e.label}` : e.label;
}

/**
 * Agrega la evidencia de UN único criterio (ya agrupada por criterionId,
 * ver patientDatumLines) en una sola frase clínica legible, en vez de
 * listar cada evento fechado por separado — esa lista cruda sigue
 * disponible en match.patientEvidence para trazabilidad interna (p. ej.
 * un futuro "Ver datos utilizados"), simplemente no se muestra aquí.
 * Reconoce los dos patrones de evidencia con múltiples eventos que
 * producen los evaluadores de match.ts (exacerbaciones, cultivos
 * microbiológicos) y agrega sus recuentos con los mismos datos que ya
 * calculó match.ts, sin inventar ningún umbral nuevo. Para cualquier
 * otro criterio — normalmente ya 1-2 líneas redactadas como frase por su
 * propio evaluador — conserva ese texto tal cual.
 */
function summarizeCriterionEvidence(items: EvidenceItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0].label;

  const dated = items.filter((e) => e.date != null);

  const exacerbations = dated.filter((e) => /^Exacerbación/i.test(e.label));
  if (exacerbations.length > 0 && exacerbations.length === dated.length) {
    const severe = exacerbations.filter((e) => /grave|ingreso hospitalario/i.test(e.label));
    const hospitalized = exacerbations.filter((e) => /ingreso hospitalario/i.test(e.label));
    let sentence = `${exacerbations.length} ${exacerbations.length === 1 ? "exacerbación" : "exacerbaciones"} en el último año`;
    if (severe.length > 0) {
      sentence += `, ${severe.length === 1 ? "incluida" : "incluidas"} ${severe.length} ${severe.length === 1 ? "grave" : "graves"}`;
      if (hospitalized.length > 0) sentence += " con ingreso hospitalario";
    }
    return `${sentence}.`;
  }

  const cultures = dated.filter((e) => /^Cultivo positivo:/i.test(e.label));
  if (cultures.length > 0 && cultures.length === dated.length) {
    const organism = cultures[0].label.replace(/^Cultivo positivo:\s*/i, "").trim();
    return `${cultures.length} cultivo${cultures.length === 1 ? "" : "s"} positivo${cultures.length === 1 ? "" : "s"} para ${organism} registrado${cultures.length === 1 ? "" : "s"}.`;
  }

  return items.map((e) => e.label).join(" ");
}

/**
 * Líneas de "Dato del paciente" para una GuidelineMatch, una frase clínica
 * resumida por cada criterio evaluado (nunca un evento por línea). En una
 * recomendación GENERAL (applicability === "general"), el diagnóstico
 * registrado es el dato que la hace aplicable — es la población diana,
 * no un criterio clínico adicional — así que encabeza la lista, seguido
 * de cualquier evidencia real que sí se haya evaluado (p. ej. una
 * exclusión).
 */
export function patientDatumLines(patient: Patient, match: GuidelineMatch, applicability: RecommendationApplicability): string[] {
  const groups = new Map<string, EvidenceItem[]>();
  for (const item of match.patientEvidence) {
    const key = item.criterionId ?? "";
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const summaryLines = [...groups.values()].map(summarizeCriterionEvidence).filter((line) => line.length > 0);

  if (applicability !== "general") return summaryLines;
  return [`Diagnóstico registrado: "${patient.primaryDiagnosis}".`, ...summaryLines];
}

/** Resume matchedCriteria/unmatchedCriteria/missingCriteria/conflictingCriteria de un GuidelineMatch en una línea legible, con su resultado. */
export function criteriaSummaryText(match: GuidelineMatch, applicability: RecommendationApplicability): string {
  const parts = [
    ...match.matchedCriteria.map((id) => `${criterionLine(id)} — cumplido`),
    ...match.unmatchedCriteria.map((id) => `${criterionLine(id)} — no cumplido`),
    ...match.missingCriteria.map((id) => `${criterionLine(id)} — sin datos suficientes`),
    ...match.conflictingCriteria.map((id) => `${criterionLine(id)} — exclusión presente`),
  ];
  if (parts.length) return parts.join(" · ");
  return applicability === "general"
    ? "No se exige ningún criterio clínico adicional: esta recomendación aplica a toda la población diana de la guía."
    : "Sin criterios verificables asociados a esta recomendación.";
}

function joinCriterionLines(criterionIds: string[], fallback: string): string {
  if (!criterionIds.length) return fallback;
  return criterionIds.map(criterionLine).join("; ");
}

/**
 * Traduce el resultado de una GuidelineMatch a una frase completa en
 * español — la síntesis propia de PulmoVista, distinta tanto del dato
 * del paciente como del texto literal de la recomendación. El término
 * "GuidelineMatch" nunca aparece: solo esta frase. Siempre nombra el
 * criterio concreto involucrado (vía criterionLine) en vez de una frase
 * genérica: nunca dice solo "cumple el criterio clínico" sin decir cuál.
 * En una recomendación GENERAL nunca dice "cumple el criterio clínico"
 * (no existe ninguno): explica que aplica por pertenecer a la población
 * diana, y nombra la exclusión concreta cuando es ella la que decide el
 * resultado.
 */
export function interpretationSentence(match: GuidelineMatch, applicability: RecommendationApplicability): string {
  if (applicability === "general") {
    const exclusion = joinCriterionLines(match.conflictingCriteria, "una exclusión de la guía");
    switch (match.status) {
      case "applies":
        return "Esta recomendación aplica de forma general a los pacientes con este diagnóstico; no depende de ningún criterio clínico adicional.";
      case "does_not_apply":
        return `Esta recomendación aplica de forma general a los pacientes con este diagnóstico, pero no es aplicable a este paciente porque se cumple la exclusión de la guía: ${exclusion}.`;
      case "possibly_applies":
        return `Esta recomendación aplica de forma general a los pacientes con este diagnóstico; con los datos disponibles no se puede confirmar con certeza si se cumple la exclusión de la guía: ${exclusion}.`;
      case "insufficient_data":
        return `Esta recomendación aplica de forma general a los pacientes con este diagnóstico; no hay información suficiente para confirmar si se cumple la exclusión de la guía: ${exclusion}.`;
    }
  }
  switch (match.status) {
    case "applies": {
      const criteria = joinCriterionLines(match.matchedCriteria, "el criterio clínico de la guía");
      return `Cumple el criterio de la guía para esta recomendación: ${criteria}.`;
    }
    case "possibly_applies": {
      const criteria = joinCriterionLines(match.matchedCriteria, "el criterio clínico de la guía");
      return `Cumple de forma orientativa el criterio de la guía (${criteria}), pero la evidencia disponible no permite confirmarlo con certeza.`;
    }
    case "insufficient_data": {
      const criteria = joinCriterionLines(match.missingCriteria, "un criterio clínico de la guía");
      return `No hay información suficiente en los datos estructurados del paciente para confirmar el criterio de la guía: ${criteria}.`;
    }
    case "does_not_apply": {
      if (match.conflictingCriteria.length) {
        const exclusion = joinCriterionLines(match.conflictingCriteria, "una exclusión de la guía");
        return `No aplica: se cumple la exclusión de la guía: ${exclusion}.`;
      }
      const criteria = joinCriterionLines(match.unmatchedCriteria, "el criterio clínico de la guía");
      return `No cumple el criterio de la guía para esta recomendación: ${criteria}.`;
    }
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
