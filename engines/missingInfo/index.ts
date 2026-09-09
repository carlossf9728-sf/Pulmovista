/**
 * MissingInfoEngine
 * ----------------------------------------------------------------------
 * `computeMissingInfo` usa hoy el checklist LEGACY de legacyRules.ts, más
 * un bloque agrupado aparte para el cribado etiológico de bronquiectasias
 * (ver computeEtiologicalScreeningGroup): es una constatación de qué
 * componentes no constan, nunca una orden clínica — y solo lleva
 * trazabilidad "¿Por qué?" cuando existe una GuidelineDefinition real y
 * citable que la respalde (separ-def-tabla1-causas). Si esa definición
 * desapareciera de la base de conocimiento, el grupo se sigue mostrando
 * sin explicación en vez de fallar o inventar una cita.
 *
 * `computeReviewOpportunities` deriva 1:1 de TurningPointsEngine y aplica
 * una nota fija (LEGACY): no comprueba realmente si hubo una revisión
 * posterior documentada, solo lo asume. Ambas están marcadas para que
 * puedan sustituirse por contenido derivado de guías sin cambiar
 * `MissingInfoResult`/`ReviewOpportunity`, que ya consume AlertsTab.
 */
import { classifyDiagnosis } from "@/domain/diagnosis";
import { computeTurningPoints } from "@/engines/turningPoints";
import { findDefinitionById, KNOWLEDGE_BASE_DOCUMENTS } from "@/engines/guidelines/knowledge";
import { allEtiologicoParameterNames, BRONCHIECTASIS_ETIOLOGICAL_SCREENING, MISSING_INFO_LEGACY_RULES } from "./legacyRules";
import { uid } from "@/utils/id";
import type { DiagnosisCategory } from "@/domain/diagnosis";
import type { Patient } from "@/types/patient";
import type { ClinicalExplanation, ClinicalSource } from "@/types/evidence";
import type { MissingInfoGroup, MissingInfoResult, ReviewOpportunity } from "@/types/missingInfo";

export { MISSING_INFO_LEGACY_RULES };

const ETIOLOGICAL_SCREENING_DEFINITION_ID = "separ-def-tabla1-causas";

/** Explicación citable para "¿Por qué?" del bloque de cribado etiológico — null si la definición no está en la base de conocimiento (no debería ocurrir, pero nunca se inventa una cita para rellenar el hueco). */
function buildEtiologicalScreeningExplanation(): ClinicalExplanation | null {
  const definition = findDefinitionById(ETIOLOGICAL_SCREENING_DEFINITION_ID);
  if (!definition) return null;
  const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === definition.guidelineId);
  if (!document) return null;
  return {
    kindLabel: "guideline_definition",
    source: {
      kind: "guideline_definition",
      guidelineId: definition.guidelineId,
      definitionId: definition.definitionId,
      society: document.source.society,
      year: document.source.year,
      section: definition.section,
      page: definition.page,
    },
    sections: [
      {
        label: "Por qué revisar esto",
        emphasis: true,
        text: "La guía identifica varias causas de bronquiectasias con tratamiento específico dirigido a la etiología — completar este cribado permite descartarlas o tratarlas si corresponde. Esto no es una recomendación de pedir una prueba concreta, solo una referencia de qué causas contempla la guía.",
      },
    ],
    evidence: [],
    citation: {
      society: document.source.society,
      year: document.source.year,
      section: definition.section,
      page: definition.page,
      sourceText: definition.sourceText,
    },
  };
}

/** null si la categoría no es Bronquiectasias, o si ya constan los 3 componentes — el bloque solo existe cuando hay algo real que constatar. */
function computeEtiologicalScreeningGroup(patient: Patient, category: DiagnosisCategory): MissingInfoGroup | null {
  if (category !== "Bronquiectasias") return null;
  const registeredNames = allEtiologicoParameterNames(patient);
  const missingComponents = BRONCHIECTASIS_ETIOLOGICAL_SCREENING.filter((c) => !c.matcher.test(registeredNames)).map((c) => c.label);
  if (!missingComponents.length) return null;
  return {
    title: "Estudio etiológico de bronquiectasias incompleto",
    missingComponents,
    explanation: buildEtiologicalScreeningExplanation(),
  };
}

export function computeMissingInfo(patient: Patient): MissingInfoResult {
  const category = classifyDiagnosis(patient.primaryDiagnosis);
  const rules = MISSING_INFO_LEGACY_RULES[category] || MISSING_INFO_LEGACY_RULES.General;
  const source: ClinicalSource = {
    kind: "legacy_heuristic",
    ruleId: `missing-info:${category}`,
    label: `Lista de comprobación de datos mínimos — ${category}`,
  };
  const group = computeEtiologicalScreeningGroup(patient, category);
  return {
    category,
    items: rules.filter((r) => r.check(patient)).map((r) => r.text),
    groups: group ? [group] : [],
    source,
  };
}

export function computeReviewOpportunities(patient: Patient): ReviewOpportunity[] {
  return computeTurningPoints(patient).map((tp) => ({
    id: uid("ro"),
    title: "Posible punto para revisión",
    detail: tp.interpretation,
    evidence: tp.evidence,
    note: "No consta posteriormente una valoración documentada de estrategia preventiva en la información introducida.",
    action: "Revisar recomendación de guía",
    source: tp.source,
  }));
}
