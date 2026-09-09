/**
 * Radiología — igual que antes (label = la mención del tipo de prueba,
 * texto = la frase que la describe), pero acotado al segmento: si el
 * segmento tiene encabezado explícito ("Radiología:"/"TC:"), todo el
 * segmento es la descripción; si no, se recorta a la frase relevante
 * dentro del segmento (nunca el segmento entero si el segmento mezcla
 * más de una cosa).
 */
import { captureFragment } from "../fragment";
import { IMAGING_TRIGGER } from "../keywords";

export interface ImagingExtraction {
  label: string;
  fragment: string;
}

export function extractImaging(segmentText: string, isExplicitHeader: boolean): ImagingExtraction | null {
  if (isExplicitHeader) {
    const trigger = segmentText.match(IMAGING_TRIGGER);
    return { label: trigger ? trigger[0].trim() : "Radiología", fragment: segmentText.trim() };
  }
  const captured = captureFragment(segmentText, IMAGING_TRIGGER);
  if (!captured) return null;
  return { label: captured.label, fragment: captured.fragment };
}
