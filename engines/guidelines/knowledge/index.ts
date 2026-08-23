/**
 * Base de conocimiento estructurada — ERS 2025 + SEPAR 2018.
 * ----------------------------------------------------------------------
 * Colecciones planas indexadas por `guidelineId`, con cita exacta
 * (`section` + `page` + `sourceText`) en cada GuidelineDefinition/
 * GuidelineCriterion/GuidelineRecommendation. Ver ers2025.ts y
 * separ2018.ts para las notas de fidelidad de cada fuente.
 *
 * NO conectado todavía a Sentinel, Turning Points, Missing Information,
 * Review Opportunities ni a ningún componente de UI — ver
 * tests/engines/guidelinesKnowledge.test.ts para las comprobaciones de
 * integridad estructural (IDs únicos, referencias válidas, sin fuerza/
 * evidencia/página inventadas).
 */
import { ERS_2025_CRITERIA, ERS_2025_DEFINITIONS, ERS_2025_DOCUMENT, ERS_2025_GUIDELINE_ID, ERS_2025_RECOMMENDATIONS } from "./ers2025";
import { SEPAR_2018_CRITERIA, SEPAR_2018_DEFINITIONS, SEPAR_2018_DOCUMENT, SEPAR_2018_GUIDELINE_ID, SEPAR_2018_RECOMMENDATIONS } from "./separ2018";
import type { GuidelineCriterion, GuidelineDefinition, GuidelineDocument, GuidelineRecommendation } from "@/types/guideline";

export {
  ERS_2025_GUIDELINE_ID,
  ERS_2025_DOCUMENT,
  ERS_2025_DEFINITIONS,
  ERS_2025_CRITERIA,
  ERS_2025_RECOMMENDATIONS,
  SEPAR_2018_GUIDELINE_ID,
  SEPAR_2018_DOCUMENT,
  SEPAR_2018_DEFINITIONS,
  SEPAR_2018_CRITERIA,
  SEPAR_2018_RECOMMENDATIONS,
};

export const KNOWLEDGE_BASE_DOCUMENTS: GuidelineDocument[] = [ERS_2025_DOCUMENT, SEPAR_2018_DOCUMENT];
export const KNOWLEDGE_BASE_DEFINITIONS: GuidelineDefinition[] = [...ERS_2025_DEFINITIONS, ...SEPAR_2018_DEFINITIONS];
export const KNOWLEDGE_BASE_CRITERIA: GuidelineCriterion[] = [...ERS_2025_CRITERIA, ...SEPAR_2018_CRITERIA];
export const KNOWLEDGE_BASE_RECOMMENDATIONS: GuidelineRecommendation[] = [...ERS_2025_RECOMMENDATIONS, ...SEPAR_2018_RECOMMENDATIONS];

export function findDefinitionsByGuideline(guidelineId: string): GuidelineDefinition[] {
  return KNOWLEDGE_BASE_DEFINITIONS.filter((d) => d.guidelineId === guidelineId);
}

export function findCriteriaByGuideline(guidelineId: string): GuidelineCriterion[] {
  return KNOWLEDGE_BASE_CRITERIA.filter((c) => c.guidelineId === guidelineId);
}

export function findRecommendationsByGuideline(guidelineId: string): GuidelineRecommendation[] {
  return KNOWLEDGE_BASE_RECOMMENDATIONS.filter((r) => r.guidelineId === guidelineId);
}

/** Recomendaciones hija de un bloque narrativo (parentRecommendationId). */
export function findChildRecommendations(parentRecommendationId: string): GuidelineRecommendation[] {
  return KNOWLEDGE_BASE_RECOMMENDATIONS.filter((r) => r.parentRecommendationId === parentRecommendationId);
}

export function findCriterionById(criterionId: string): GuidelineCriterion | undefined {
  return KNOWLEDGE_BASE_CRITERIA.find((c) => c.criterionId === criterionId);
}

export function findRecommendationById(recommendationId: string): GuidelineRecommendation | undefined {
  return KNOWLEDGE_BASE_RECOMMENDATIONS.find((r) => r.recommendationId === recommendationId);
}
