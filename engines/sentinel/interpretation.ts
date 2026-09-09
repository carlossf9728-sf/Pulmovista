/**
 * Interpretación corta de Argos para una señal objetiva de Sentinel —
 * mismo principio que engines/turningPoints/legacyInterpretations.ts:
 * una frase breve que describe la FORMA del cambio ya detectado por
 * objectiveDetectors.ts (aumento, descenso, persistencia...), nunca un
 * juicio respaldado por guía ni una gravedad nueva. Es una heurística
 * interna de PulmoVista (LEGACY/EXPERIMENTAL, igual que Turning Points),
 * completamente separada de `guidelineInterpretations` — cuando SÍ hay
 * soporte de guía, esa es la capa que lo declara, nunca esta.
 */
import type { ObjectiveSentinelSignal } from "@/types/sentinel";
import type { ClinicalExplanation } from "@/types/evidence";

export function argosInterpretation(signal: ObjectiveSentinelSignal): string {
  switch (signal.signalId) {
    case "fev1-trend-decline":
      return "Descenso longitudinal objetivo de FEV1. Requiere revisión.";
    case "exacerbation-rate-increase":
      return "Aumento longitudinal de exacerbaciones. Requiere revisión.";
    case "persistent-organism":
      return `Aislamiento persistente de ${signal.subject}. Requiere revisión.`;
    case "new-respiratory-support":
      return `Inicio de ${signal.subject}. Cambio relevante en el manejo. Requiere revisión.`;
  }
}

/**
 * Trazabilidad "¿Por qué?" de la interpretación corta — deja explícito
 * que procede de una regla longitudinal interna, no de una guía, y que
 * no equivale a una conclusión clínica definitiva (a diferencia de
 * `guidelineInterpretations`, que si tiene ese respaldo).
 */
export function buildArgosExplanation(signal: ObjectiveSentinelSignal, interpretation: string): ClinicalExplanation {
  return {
    kindLabel: "heurística experimental",
    source: { kind: "legacy_heuristic", ruleId: `sentinel:${signal.signalId}`, label: signal.label },
    sections: [
      { label: "Dato objetivo", emphasis: true, text: signal.datum },
      { label: "Cómo lo interpreta Argos", text: interpretation },
      {
        label: "Sobre esta interpretación",
        text: "Procede de una regla longitudinal interna de PulmoVista, no de una recomendación de guía clínica, y no equivale a una conclusión clínica definitiva.",
      },
    ],
    evidence: signal.evidence,
  };
}
