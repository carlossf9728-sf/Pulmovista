import { captureFragment, indexOfSentenceEnd } from "../fragment";
import { mentionsHospitalization } from "../negation";
import { AGGREGATE_EXACERBATION_HISTORY_TRIGGER, ANTIBIOTIC_MENTION_TRIGGER, EXACERBATION_EXPLICIT_TRIGGER, EXACERBATION_SOFT_SIGNS_TRIGGER } from "../keywords";

export interface ExacerbationExtraction {
  severity: string;
  hospitalization: boolean;
  fragment: string;
  confidence: "confirmado" | "posible";
  confidenceReason: string | null;
}

/** Frase completa (no solo desde `index` hasta el final: también hacia atrás, hasta el punto anterior) que contiene la posición `index` — misma noción de "fin de frase" que fragment.ts#indexOfSentenceEnd (un "." entre dígitos es decimal, no separador). */
function sentenceContaining(text: string, index: number): string {
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (text[i] !== ".") continue;
    const prev = text[i - 1];
    const next = text[i + 1];
    if (prev != null && next != null && /\d/.test(prev) && /\d/.test(next)) continue;
    start = i + 1;
    break;
  }
  const relEnd = indexOfSentenceEnd(text, index);
  return text.slice(start, relEnd === -1 ? text.length : relEnd + 1);
}

/**
 * Índice de la primera mención EXPLÍCITA de exacerbación cuya PROPIA
 * FRASE no sea un recuento histórico agregado ("2 exacerbaciones... en
 * el último año") — -1 si no hay ninguna. Comprueba la frase completa
 * que contiene cada aparición, no el segmento entero: un mismo segmento
 * puede combinar, en frases distintas, un antecedente agregado y un
 * episodio real ("Antecedentes: 3 agudizaciones el año previo... Ingreso
 * hospitalario por agudización grave...") — descartar el segmento
 * completo por la frase agregada perdería el episodio real que sí trae.
 */
function firstGenuineExplicitMatchIndex(text: string): number {
  const global = new RegExp(EXACERBATION_EXPLICIT_TRIGGER.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = global.exec(text))) {
    if (!AGGREGATE_EXACERBATION_HISTORY_TRIGGER.test(sentenceContaining(text, m.index))) return m.index;
    if (global.lastIndex === m.index) global.lastIndex += 1;
  }
  return -1;
}

/**
 * ¿El texto trae una mención EXPLÍCITA de exacerbación que no sea (en su
 * propia frase) un recuento histórico agregado? Compartida con
 * resolveDates.ts#opensHospitalizationEpisode: el mismo criterio que
 * decide si se crea el ExacerbationEvent decide si el segmento abre el
 * episodio de ingreso — nunca dos criterios distintos para la misma
 * pregunta.
 */
export function hasGenuineExplicitExacerbation(text: string): boolean {
  return firstGenuineExplicitMatchIndex(text) !== -1;
}

/**
 * null cuando el segmento no menciona una exacerbación explícita ni la
 * combinación de signos + antibiótico que la sugiere, O cuando la única
 * mención explícita es, en su propia frase, un recuento histórico
 * agregado ("2 exacerbaciones... en el último año" — ver
 * hasGenuineExplicitExacerbation): un antecedente agregado no tiene una
 * fecha propia que lo justifique como episodio nuevo, así que nunca se
 * convierte en un ExacerbationEvent — el texto se conserva igualmente en
 * el fragmento de la Consulta si el segmento también trae narrativa (ver
 * classify.ts).
 */
export function extractExacerbation(segmentText: string): ExacerbationExtraction | null {
  const hosp = mentionsHospitalization(segmentText);
  const genuineIndex = firstGenuineExplicitMatchIndex(segmentText);

  if (genuineIndex !== -1) {
    const rest = segmentText.slice(genuineIndex);
    const end = indexOfSentenceEnd(rest, 0);
    const fragment = (end === -1 ? rest : rest.slice(0, end + 1)).trim();
    return { severity: hosp ? "Grave" : "No especificada", hospitalization: hosp, fragment, confidence: "confirmado", confidenceReason: null };
  }

  const softMatch = captureFragment(segmentText, EXACERBATION_SOFT_SIGNS_TRIGGER);
  if (softMatch && ANTIBIOTIC_MENTION_TRIGGER.test(segmentText)) {
    return {
      severity: "No especificada",
      hospitalization: hosp,
      fragment: softMatch.fragment,
      confidence: "posible",
      confidenceReason: 'El texto menciona signos de empeoramiento y tratamiento antibiótico, pero no utiliza explícitamente el término "exacerbación".',
    };
  }

  return null;
}
