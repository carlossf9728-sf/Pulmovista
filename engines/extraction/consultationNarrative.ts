import { CONSULTATION_NARRATIVE_TRIGGER } from "./keywords";

/**
 * ¿El texto (de un segmento, o de un documento completo) contiene
 * narrativa clínica de consulta/evolución (motivo de la visita, relato
 * de síntomas, curso clínico)? Un texto que solo trae datos objetivos
 * (cultivo, TC, FEV1, analítica...) sin ninguna frase de este tipo NO
 * debe producir un evento de Consulta — ver CONSULTATION_NARRATIVE_TRIGGER.
 * Extraída a su propio módulo para que classifySegment pueda usarla sin
 * depender de engines/extraction/index.ts (evita un ciclo de imports).
 */
export function hasConsultationNarrative(text: string): boolean {
  return CONSULTATION_NARRATIVE_TRIGGER.test(text);
}
