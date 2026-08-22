/**
 * MissingInfoEngine
 * ----------------------------------------------------------------------
 * `computeMissingInfo` usa hoy el checklist LEGACY de legacyRules.ts.
 * `computeReviewOpportunities` deriva 1:1 de TurningPointsEngine y aplica
 * una nota fija (LEGACY): no comprueba realmente si hubo una revisión
 * posterior documentada, solo lo asume. Ambas están marcadas para que
 * puedan sustituirse por contenido derivado de guías sin cambiar
 * `MissingInfoResult`/`ReviewOpportunity`, que ya consume AlertsTab.
 */
import { classifyDiagnosis } from "@/domain/diagnosis";
import { computeTurningPoints } from "@/engines/turningPoints";
import { MISSING_INFO_LEGACY_RULES } from "./legacyRules";
import { uid } from "@/utils/id";
import type { Patient } from "@/types/patient";
import type { ClinicalSource } from "@/types/evidence";
import type { MissingInfoResult, ReviewOpportunity } from "@/types/missingInfo";

export { MISSING_INFO_LEGACY_RULES };

export function computeMissingInfo(patient: Patient): MissingInfoResult {
  const category = classifyDiagnosis(patient.primaryDiagnosis);
  const rules = MISSING_INFO_LEGACY_RULES[category] || MISSING_INFO_LEGACY_RULES.General;
  const source: ClinicalSource = {
    kind: "legacy_heuristic",
    ruleId: `missing-info:${category}`,
    label: `Checklist de datos mínimos — ${category}`,
  };
  return { category, items: rules.filter((r) => r.check(patient)).map((r) => r.text), source };
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
