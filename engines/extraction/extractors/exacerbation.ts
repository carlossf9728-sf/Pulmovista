import { captureFragment, indexOfSentenceEnd } from "../fragment";
import { containsHospitalizationWord, mentionsHospitalization, sentenceContaining } from "../negation";
import {
  AGGREGATE_EXACERBATION_HISTORY_TRIGGER,
  ANTIBIOTIC_MENTION_TRIGGER,
  EXACERBATION_EXPLICIT_TRIGGER,
  EXACERBATION_SOFT_SIGNS_TRIGGER,
  SPANISH_NUMBER_WORDS,
} from "../keywords";

export interface ExacerbationExtraction {
  severity: string;
  hospitalization: boolean;
  fragment: string;
  confidence: "confirmado" | "posible";
  confidenceReason: string | null;
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
 *
 * `headerDeclaresHospitalization` — true cuando el propio segmento vino
 * de un encabezado "Ingreso:"/"Hospitalización:" (ver
 * segmentPatterns.ts#SEGMENT_HEADER_WORDS). Necesario porque la
 * segmentación (segment.ts) separa la palabra del encabezado del resto
 * del texto en la misma línea ("Ingreso: agudización grave..." deja el
 * segmento como solo "agudización grave...", sin "ingres" ni
 * "hospitali"): sin esta señal, `mentionsHospitalization` no encontraría
 * nada que buscar y una hospitalización real, declarada por el propio
 * encabezado, se perdería en silencio. El encabezado es la señal más
 * fuerte posible (mismo criterio que ya aplica classify.ts), así que
 * basta con que esté presente para que cuente como hospitalización, sin
 * necesitar además la palabra suelta en el cuerpo del segmento.
 */
export function extractExacerbation(segmentText: string, headerDeclaresHospitalization = false): ExacerbationExtraction | null {
  const hosp = headerDeclaresHospitalization || mentionsHospitalization(segmentText);
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

export interface AggregateExacerbationHistory {
  /** null cuando el disparador es "varias"/"múltiples" (sin cifra concreta) — nunca se inventa un número que el texto no da. */
  priorExacerbationCount: number | null;
  /** 0 solo cuando el texto niega explícitamente ingresos previos en la MISMA frase ("sin ingresos previos"); null cuando no se menciona en absoluto — nunca 0 por defecto. */
  priorHospitalizationCount: number | null;
  fragment: string;
}

/** "2 exacerbaciones", "tres agudizaciones"... — la cifra que acompaña al recuento agregado (ver AGGREGATE_EXACERBATION_HISTORY_TRIGGER). null para "varias"/"múltiples" (no dan cifra) o si el patrón no aparece. Usa el mismo vocabulario de cantidades en palabra que TEMPORAL_TRANSITIONS/resolveDates.ts (ver keywords.ts#SPANISH_NUMBER_WORDS) — "un/una/uno" nunca aparece aquí en la práctica porque el propio patrón exige el sustantivo en plural ("exacerbaciones"/"agudizaciones"). */
function parseAggregateCount(sentence: string): number | null {
  const m = sentence.match(/\b(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|varias|m[uú]ltiples)\s+(exacerbaciones|agudizaciones)\b/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return SPANISH_NUMBER_WORDS[raw] ?? null;
}

/**
 * Antecedente AGREGADO de exacerbaciones ("Refiere 2 exacerbaciones
 * tratadas con antibiótico en el último año, sin ingresos previos") —
 * el dato que extractExacerbation deliberadamente NO convierte en un
 * ExacerbationEvent fechado (ver hasGenuineExplicitExacerbation). Se
 * conserva aquí como recuento histórico estructurado (ver
 * ConsultationEvent#priorExacerbationCount/priorHospitalizationCount en
 * types/clinicalEvent.ts) para que pipeline.ts nunca lo descarte en
 * silencio: episodios clínicos fechados y antecedentes agregados sin
 * fecha individual son datos DISTINTOS, ambos con representación propia.
 * Busca la primera frase agregada del segmento (nunca el segmento
 * completo: el mismo segmento puede combinar, en frases distintas, un
 * antecedente agregado y un episodio real). `null` si ninguna frase del
 * segmento es un recuento agregado.
 */
export function extractAggregateExacerbationHistory(segmentText: string): AggregateExacerbationHistory | null {
  const global = new RegExp(EXACERBATION_EXPLICIT_TRIGGER.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = global.exec(segmentText))) {
    const sentence = sentenceContaining(segmentText, m.index);
    if (AGGREGATE_EXACERBATION_HISTORY_TRIGGER.test(sentence)) {
      const priorHospitalizationCount = containsHospitalizationWord(sentence) && !mentionsHospitalization(sentence) ? 0 : null;
      return { priorExacerbationCount: parseAggregateCount(sentence), priorHospitalizationCount, fragment: sentence.trim() };
    }
    if (global.lastIndex === m.index) global.lastIndex += 1;
  }
  return null;
}
