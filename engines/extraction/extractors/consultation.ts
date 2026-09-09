/**
 * Consulta/evolución — NUNCA el fallback general. Solo produce un
 * candidato cuando el segmento trae narrativa clínica real
 * (hasConsultationNarrative: motivo de consulta, síntomas, evolución,
 * impresión clínica...).
 *
 * Fragmento: un segmento con encabezado explícito ("Consulta:"/"Alta:")
 * usa el segmento completo — ya está delimitado por segmentClinicalText,
 * así que no puede traer analítica, microbiología, PFR, radiología ni
 * tratamientos de otra sección. Sin encabezado (narrativa mezclada con
 * datos objetivos en el mismo párrafo, el caso "texto sin encabezados"),
 * se acota a las frases que realmente contienen la narrativa —
 * captureFragmentSpanningAllMatches, para no arrastrar el resto del
 * párrafo cuando solo una parte es narrativa real.
 */
import { captureFragmentSpanningAllMatches } from "../fragment";
import { CONSULTATION_NARRATIVE_TRIGGER } from "../keywords";
import { hasConsultationNarrative } from "../consultationNarrative";

export function extractConsultation(segmentText: string, isExplicitHeader: boolean): { fragment: string } | null {
  if (!hasConsultationNarrative(segmentText)) return null;
  if (isExplicitHeader) return { fragment: segmentText.trim() };
  const fragment = captureFragmentSpanningAllMatches(segmentText, CONSULTATION_NARRATIVE_TRIGGER) ?? segmentText.trim();
  return { fragment };
}
