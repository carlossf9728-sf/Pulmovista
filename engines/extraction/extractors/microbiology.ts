/**
 * Microbiología — mismo criterio de detección por organismo que el
 * motor monolítico (ORGANISM_PATTERNS), pero la sensibilidad/resistencia
 * ya no se busca en todo el segmento: se acota al fragmento alrededor de
 * CADA organismo, para que dos organismos distintos en el mismo
 * segmento no terminen compartiendo por error el antibiograma del otro.
 */
import { captureFragment } from "../fragment";
import { ORGANISM_PATTERNS } from "../keywords";

export interface MicrobiologyExtraction {
  organism: string;
  sampleType: string;
  sensitivity: string[];
  resistance: string[];
  fragment: string;
}

export function extractMicrobiology(segmentText: string): MicrobiologyExtraction[] {
  const results: MicrobiologyExtraction[] = [];
  for (const organism of ORGANISM_PATTERNS) {
    const key = organism.split(" ")[0];
    if (!new RegExp(key, "i").test(segmentText)) continue;
    const captured = captureFragment(segmentText, new RegExp(key, "i"));
    const fragment = captured?.fragment ?? segmentText.trim();
    const sensMatch = fragment.match(/sensible[^.]{0,80}/i);
    const resMatch = fragment.match(/resistente[^.]{0,80}/i);
    results.push({
      sampleType: "Esputo",
      organism,
      sensitivity: sensMatch ? [sensMatch[0].replace(/sensible( a| únicamente a)?/i, "").trim()] : [],
      resistance: resMatch ? [resMatch[0].replace(/resistente( a)?/i, "").trim()] : [],
      fragment,
    });
  }
  return results;
}
