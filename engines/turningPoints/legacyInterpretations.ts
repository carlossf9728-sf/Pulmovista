/**
 * LEGACY / EXPERIMENTAL / PENDIENTE DE SUSTITUCIÓN POR GuidelineEngine.
 * ----------------------------------------------------------------------
 * Traduce un ObjectiveTurningPoint a una frase de interpretación clínica.
 * Lee el dato objetivo (`subject`, `before`/`after`) en vez de acoplarse
 * a texto fijo independiente de los datos, pero el contenido de la frase
 * en sí sigue siendo una heurística local, no una guía real.
 */
import type { ObjectiveTurningPoint } from "@/types/turningPoints";

export function interpretTurningPointLegacy(tp: ObjectiveTurningPoint): string {
  switch (tp.criterion) {
    case "exacerbation-rate-jump":
      return "Posible transición desde una fase estable a un fenotipo de deterioro frecuente.";
    case "restrictive-decline":
      return "Descenso funcional significativo, compatible con progresión de un patrón restrictivo.";
    case "first-persistent-organism":
      return `Primer aislamiento persistente de ${tp.subject}: posible colonización crónica.`;
    case "first-hospitalization":
      return "Primera hospitalización registrada por agudización: hito relevante en la trayectoria de la enfermedad.";
    case "respiratory-support-start":
      return `Inicio de ${tp.subject}: suele marcar un cambio relevante en el manejo de la enfermedad.`;
  }
}

/**
 * Formulación corta y directa para tarjetas compactas (bloque "Momentos
 * clave" del Resumen) — mismo dato objetivo (`criterion`/`subject`) que
 * `interpretTurningPointLegacy`, sin la cláusula explicativa final
 * ("hito relevante...", "posible colonización crónica..."). No es una
 * interpretación distinta: es la misma, más breve.
 */
export function shortTurningPointLabel(tp: ObjectiveTurningPoint): string {
  switch (tp.criterion) {
    case "exacerbation-rate-jump":
      return "Salto en la frecuencia de exacerbaciones";
    case "restrictive-decline":
      return "Descenso funcional restrictivo significativo";
    case "first-persistent-organism":
      return `Primer aislamiento persistente de ${tp.subject}`;
    case "first-hospitalization":
      return "Primera hospitalización por exacerbación";
    case "respiratory-support-start":
      return `Inicio de ${tp.subject}`;
  }
}

/** Etiqueta legible del criterio, usada como `source.label` en la trazabilidad. */
export function turningPointCriterionLabel(criterion: ObjectiveTurningPoint["criterion"]): string {
  switch (criterion) {
    case "exacerbation-rate-jump":
      return "Salto en la tasa de exacerbaciones";
    case "restrictive-decline":
      return "Descenso funcional restrictivo";
    case "first-persistent-organism":
      return "Primer aislamiento persistente de un organismo";
    case "first-hospitalization":
      return "Primera hospitalización";
    case "respiratory-support-start":
      return "Inicio de soporte respiratorio";
  }
}
