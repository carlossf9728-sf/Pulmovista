import { captureFragment, indexOfSentenceEnd } from "../fragment";
import { captureHospitalizationFragment } from "../negation";
import { PROCEDURE_TRIGGER } from "../keywords";

export interface HospitalizationExtraction {
  procedureLabel: string | null;
  fragment: string;
}

/** Procedimiento respiratorio explícito (broncoscopia, toracocentesis...) — independiente de si el segmento también menciona "ingreso"/exacerbación, igual que en el motor monolítico. */
export function extractProcedure(segmentText: string): HospitalizationExtraction | null {
  const procedure = captureFragment(segmentText, PROCEDURE_TRIGGER);
  if (!procedure) return null;
  return { procedureLabel: procedure.label, fragment: procedure.fragment };
}

/**
 * Ingreso sin procedimiento identificado — solo se llama cuando el
 * segmento NO produjo ya una ExacerbationEvent y no continúa un episodio
 * de ingreso ya abierto (ver pipeline.ts): un ingreso mencionado junto a
 * una exacerbación explícita, o repetido en una frase posterior del
 * MISMO episodio ("al alta... tras N días de ingreso"), se cuenta una
 * sola vez. Negación-consciente (ver negation.ts): "sin ingresos
 * previos" nunca produce un HospitalizationEvent.
 *
 * `headerDeclaresHospitalization` — igual que en extractExacerbation:
 * cuando el segmento viene de un encabezado "Ingreso:"/"Hospitalización:"
 * sin ninguna otra categoría (p. ej. un ingreso sin ningún signo de
 * exacerbación reconocible en el cuerpo), la palabra del encabezado ya no
 * está en `segmentText` (segment.ts la separa) y `captureHospitalizationFragment`
 * no encontraría nada — se usa entonces la primera frase del segmento
 * como fragmento, en vez de perder la hospitalización en silencio.
 */
export function extractHospitalizationFallback(segmentText: string, headerDeclaresHospitalization = false): HospitalizationExtraction | null {
  const hosp = captureHospitalizationFragment(segmentText);
  if (hosp) return { procedureLabel: null, fragment: hosp.fragment };
  if (!headerDeclaresHospitalization || !segmentText.trim()) return null;
  const end = indexOfSentenceEnd(segmentText, 0);
  const fragment = (end === -1 ? segmentText : segmentText.slice(0, end + 1)).trim();
  return { procedureLabel: null, fragment };
}
