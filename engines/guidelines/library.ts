/**
 * Biblioteca de guías — capa de presentación sobre la base de
 * conocimiento REAL (engines/guidelines/knowledge/), la misma que usa
 * matchPatientToGuidelines (./match.ts). Nunca una segunda lista manual:
 * cada cifra se calcula aquí a partir de KNOWLEDGE_BASE_DEFINITIONS/
 * CRITERIA/RECOMMENDATIONS, así que no puede desincronizarse de lo que
 * el motor de coincidencia realmente evalúa.
 *
 * Sustituye por completo al antiguo engines/guidelines/index.ts +
 * data.ts (contenido SIMULADO, eliminado): esa pantalla mostraba guías
 * inventadas de EPOC/fibrosis pulmonar con una única recomendación de
 * relleno cada una, dando a entender que el sistema entero de guías era
 * un prototipo — cuando ERS 2025 y SEPAR 2018 ya alimentan de verdad
 * "Revisión según guías", Argos y el resto de motores.
 */
import { ALL_DIAGNOSIS_CATEGORIES } from "@/domain/diagnosis";
import { isRecommendationEvaluated, SUPPORTED_DIAGNOSIS_CATEGORIES } from "./match";
import { findCriteriaByGuideline, findDefinitionsByGuideline, findRecommendationsByGuideline, KNOWLEDGE_BASE_DOCUMENTS } from "./knowledge";
import type { DiagnosisCategory } from "@/domain/diagnosis";
import type { GuidelineCriterion, GuidelineDefinition, GuidelineDocument, GuidelineRecommendation } from "@/types/guideline";

/** "Activa" = estructurada en la base de conocimiento Y dentro de una categoría diagnóstica que matchPatientToGuidelines evalúa — nunca solo "presente en el array". */
export type GuidelineLibraryStatus = "active";

export interface GuidelineLibraryEntry {
  guidelineId: string;
  title: string;
  society: string;
  year: number;
  disease: string;
  sourceUrl: string | null;
  status: GuidelineLibraryStatus;
  definitionCount: number;
  criterionCount: number;
  /** Recomendaciones estructuradas en la base de conocimiento — incluye actuaciones hija de un bloque narrativo (ver GuidelineRecommendation#parentRecommendationId), cada una con su propia cita. */
  recommendationCount: number;
  /** De esas, cuántas están dentro del alcance que matchPatientToGuidelines evalúa hoy (ver match.ts#isRecommendationEvaluated) — nunca todas por defecto: estructurar una recomendación y evaluarla son pasos distintos. */
  evaluatedRecommendationCount: number;
}

/** Detalle completo de una guía para la vista "Ver contenido" — mismas colecciones que consume matchPatientToGuidelines, sin recalcular ni copiar nada. */
export interface GuidelineLibraryDetail extends GuidelineLibraryEntry {
  definitions: GuidelineDefinition[];
  criteria: GuidelineCriterion[];
  recommendations: GuidelineRecommendation[];
}

function toEntry(doc: GuidelineDocument): GuidelineLibraryEntry {
  const recommendations = findRecommendationsByGuideline(doc.guidelineId);
  return {
    guidelineId: doc.guidelineId,
    title: doc.source.title,
    society: doc.source.society,
    year: doc.source.year,
    disease: doc.disease,
    sourceUrl: doc.source.url ?? null,
    status: "active",
    definitionCount: findDefinitionsByGuideline(doc.guidelineId).length,
    criterionCount: findCriteriaByGuideline(doc.guidelineId).length,
    recommendationCount: recommendations.length,
    evaluatedRecommendationCount: recommendations.filter((r) => isRecommendationEvaluated(r.recommendationId)).length,
  };
}

/**
 * Guías realmente cargadas y activas — hoy ERS 2025 y SEPAR 2018, ambas
 * con `disease: "Bronquiectasias"` dentro de SUPPORTED_DIAGNOSIS_CATEGORIES.
 * Si en el futuro se añade una guía a la base de conocimiento para una
 * categoría todavía no evaluada por match.ts, aparecería aquí igualmente
 * marcada "active" solo cuando esa categoría entre en
 * SUPPORTED_DIAGNOSIS_CATEGORIES — la condición se recalcula, nunca se
 * asume por estar en KNOWLEDGE_BASE_DOCUMENTS.
 */
export function listActiveGuidelines(): GuidelineLibraryEntry[] {
  return KNOWLEDGE_BASE_DOCUMENTS.filter((doc) => SUPPORTED_DIAGNOSIS_CATEGORIES.includes(doc.disease as DiagnosisCategory)).map(toEntry);
}

/**
 * Categorías diagnósticas reales (domain/diagnosis.ts) sin ninguna guía
 * activa todavía — hoy EPOC y Fibrosis pulmonar. Nunca inventa un
 * nombre de guía concreto (GOLD, ATS/ERS/JRS/ALAT...) para esas
 * categorías: no hay ninguna base de conocimiento estructurada que lo
 * respalde, así que solo se nombra la categoría diagnóstica, no un
 * documento que no existe en este sistema.
 */
export function listUncoveredDiagnosisCategories(): DiagnosisCategory[] {
  return ALL_DIAGNOSIS_CATEGORIES.filter((c) => !SUPPORTED_DIAGNOSIS_CATEGORIES.includes(c));
}

/** Detalle completo de una guía activa por su guidelineId — `null` si no existe o no está activa (nunca se construye un detalle para una guía sin evaluar). */
export function getGuidelineDetail(guidelineId: string): GuidelineLibraryDetail | null {
  const entry = listActiveGuidelines().find((g) => g.guidelineId === guidelineId);
  if (!entry) return null;
  return {
    ...entry,
    definitions: findDefinitionsByGuideline(guidelineId),
    criteria: findCriteriaByGuideline(guidelineId),
    recommendations: findRecommendationsByGuideline(guidelineId),
  };
}
