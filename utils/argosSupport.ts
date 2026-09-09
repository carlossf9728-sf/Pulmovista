/**
 * Simplifica el estado de soporte de guía de un SentinelFinding a 3
 * niveles para la tarjeta compacta de Argos — NUNCA una evaluación
 * clínica nueva: solo una lectura más gruesa de los `statusLabel` que
 * `engines/sentinel/guidelineInterpretation.ts` ya calculó a partir de
 * GuidelineMatch. Si esos estados cambiaran de nombre o de número, solo
 * hay que tocar esta función — GuidelinesReviewTab sigue mostrando el
 * detalle completo (Cumple/Posiblemente cumple/Información insuficiente/
 * No cumple) sin pasar por aquí.
 */
import type { SentinelGuidelineInterpretation } from "@/types/sentinel";

export type ArgosSupportLevel = "respaldado" | "posible" | "sin_soporte";

export const ARGOS_SUPPORT_LABEL: Record<ArgosSupportLevel, string> = {
  respaldado: "Respaldado por guía",
  posible: "Posible aplicabilidad",
  sin_soporte: "Sin interpretación basada en guía disponible",
};

/** "Respaldado" si alguna recomendación relacionada cumple ahora mismo; "posible" si hay recomendaciones relacionadas pero ninguna cumple con certeza; "sin_soporte" si no hay ninguna recomendación relacionada dentro del alcance actual de las guías cargadas. */
export function argosSupportLevel(guidelineInterpretations: Pick<SentinelGuidelineInterpretation, "statusLabel">[]): ArgosSupportLevel {
  if (guidelineInterpretations.some((gi) => gi.statusLabel === "Cumple")) return "respaldado";
  if (guidelineInterpretations.length) return "posible";
  return "sin_soporte";
}
