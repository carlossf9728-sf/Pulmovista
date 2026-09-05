/**
 * Empeoramiento/Mejoría (ClinicalTrend) para un ClinicalChange de
 * `computeChangesSinceLastVisit` (engines/longitudinal) — sustituye el
 * cálculo naive que existía en SummaryTab (aumentado→rojo,
 * disminuido→verde por dirección numérica, sin mirar qué significa
 * clínicamente). Una caída de FEV1/FVC nunca debe verse en verde solo
 * porque el número bajó.
 *
 * Mismo principio conservador que domain/timeline.ts#trendForRow: cada
 * caso se apoya en un criterio YA EXISTENTE en la app, nunca uno nuevo,
 * y por defecto no se etiqueta nada (null) cuando no hay un criterio
 * reutilizable para ese dato:
 *  - FVC: solo si el cambio coincide con un Turning Point
 *    restrictive-decline ya detectado dentro de la misma ventana
 *    "desde la última consulta" — igual que en Cronología, nunca se
 *    generaliza a cualquier descenso de FVC.
 *  - Exacerbaciones (12 meses): solo si coincide con un Turning Point
 *    exacerbation-rate-jump ya detectado en la ventana. Una reducción
 *    nunca se marca Mejoría — no existe ese criterio en ningún motor.
 *  - Hospitalizaciones (acumuladas) aumentado: Empeoramiento siempre —
 *    reutiliza el mismo principio ya usado en
 *    domain/timeline.ts#exacerbationOwnTrend ("una exacerbación grave/
 *    hospitalización sí puede señalarse como acontecimiento
 *    desfavorable", en cada ocurrencia).
 *  - FEV1, DLCO, Microbiología, Tratamiento: sin criterio ya
 *    establecido y fiable para este tipo de comparación — nunca se
 *    etiquetan, se muestran solo como cambio objetivo.
 */
import type { ClinicalChange } from "@/types/longitudinal";
import type { ClinicalTrend } from "@/types/clinicalTrend";
import type { TurningPoint } from "@/types/turningPoints";

export interface ChangeTrendWindow {
  fromDate: string;
  toDate: string;
  turningPoints: TurningPoint[];
}

function hasTurningPointInWindow(criterion: TurningPoint["criterion"], window: ChangeTrendWindow): boolean {
  return window.turningPoints.some((tp) => tp.criterion === criterion && tp.date > window.fromDate && tp.date <= window.toDate);
}

export function changeTrend(change: ClinicalChange, window: ChangeTrendWindow): ClinicalTrend {
  switch (change.label) {
    case "FVC":
      return change.kind === "disminuido" && hasTurningPointInWindow("restrictive-decline", window) ? "Empeoramiento" : null;
    case "Exacerbaciones (12 meses)":
      return change.kind === "aumentado" && hasTurningPointInWindow("exacerbation-rate-jump", window) ? "Empeoramiento" : null;
    case "Hospitalizaciones (acumuladas)":
      return change.kind === "aumentado" ? "Empeoramiento" : null;
    default:
      return null;
  }
}
