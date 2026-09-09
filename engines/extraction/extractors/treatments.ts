/**
 * Tratamientos — mismo criterio léxico que el motor monolítico
 * (inicia/retira + fármaco de TREATMENT_KEYWORDS), pero el fragmento ya
 * no es "todo el segmento": se acota a la frase que menciona ESE
 * fármaco concreto, para que dos fármacos distintos en el mismo
 * segmento no terminen compartiendo el mismo `rawText`.
 */
import { captureFragment } from "../fragment";
import { RESPIRATORY_SUPPORT_KEYWORDS, TREATMENT_KEYWORDS } from "../keywords";

export interface TreatmentExtraction {
  kind: "started" | "stopped";
  isRespiratorySupport: boolean;
  drug: string;
  dose: string | null;
  schedule: string | null;
  fragment: string;
}

export function extractTreatments(segmentText: string): TreatmentExtraction[] {
  const results: TreatmentExtraction[] = [];
  for (const drug of TREATMENT_KEYWORDS) {
    if (!new RegExp(drug, "i").test(segmentText)) continue;

    const started = new RegExp(`(inicia|se inicia|añade|comienza|pauta|se pauta|prescribe)[^.]{0,30}${drug}`, "i").test(segmentText);
    const stopped = new RegExp(`(retira|suspende|finaliza)[^.]{0,30}${drug}`, "i").test(segmentText);
    if (!started && !stopped) continue;

    const doseMatch = segmentText.match(new RegExp(`${drug}[^.]{0,6}?(\\d+\\s?mg)`, "i"));
    const scheduleMatch = segmentText.match(new RegExp(`${drug}[^.]{0,40}(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[^.]{0,30}`, "i"));
    const captured = captureFragment(segmentText, new RegExp(drug, "i"));
    const fragment = captured?.fragment ?? segmentText.trim();

    results.push({
      kind: started ? "started" : "stopped",
      isRespiratorySupport: (RESPIRATORY_SUPPORT_KEYWORDS as readonly string[]).includes(drug),
      drug,
      dose: started && doseMatch ? doseMatch[1] : null,
      schedule: started && scheduleMatch ? scheduleMatch[0].replace(drug, "").trim() : null,
      fragment,
    });
  }
  return results;
}
