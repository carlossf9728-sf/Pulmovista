/**
 * GuidelineEngine — stub tipado.
 * ----------------------------------------------------------------------
 * `GUIDELINES` sigue siendo contenido simulado (ver data.ts). Esta fase
 * NO añade guías reales ni evaluación de condiciones: solo deja lista la
 * forma que usará la siguiente fase.
 *
 *   datos del paciente → GuidelineEngine.matchGuidelines() → GuidelineMatch[]
 *
 * `matchGuidelines` es un stub que siempre devuelve `[]` (ninguna guía
 * simulada declara `conditions` evaluables todavía). El tipo de retorno
 * ya es el definitivo para que Sentinel/Turning Points puedan consumirlo
 * sin cambios de interfaz el día que se implemente.
 */
import { classifyDiagnosis } from "@/domain/diagnosis";
import { GUIDELINE_DEFINITIONS, GUIDELINE_RECOMMENDATIONS } from "./data";
import type { Patient } from "@/types/patient";
import type { Guideline, GuidelineMatch } from "@/types/guideline";

export const GUIDELINES: Guideline[] = GUIDELINE_DEFINITIONS.map((definition) => ({
  definition,
  recommendations: GUIDELINE_RECOMMENDATIONS.filter((r) => r.guidelineId === definition.guidelineId),
}));

export function findGuidelinesForDiagnosis(dx: string): Guideline[] {
  const cat = classifyDiagnosis(dx);
  return GUIDELINES.filter((g) => g.definition.disease === cat);
}

/** Stub — ver nota de cabecera. No implementado en esta fase. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma definitiva del stub, se usará al implementar la evaluación real
export function matchGuidelines(_patient: Patient): GuidelineMatch[] {
  return [];
}
