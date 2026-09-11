/**
 * Tratamientos — reconoce tanto tratamiento FARMACOLÓGICO (fármacos de
 * TREATMENT_KEYWORDS, con dosis/frecuencia/duración en mg/horas/días)
 * como tratamiento NO FARMACOLÓGICO (fisioterapia respiratoria — sin
 * dosis, pero con su propio verbo de cambio: "se intensifica", "se
 * refuerza"). Nunca se procesan igual: a la terapia no farmacológica no
 * se le busca dosis en mg, y ambas producen SIEMPRE eventos separados
 * aunque aparezcan en la misma frase.
 *
 * Cada mención detectada en el segmento (un fármaco o una terapia no
 * farmacológica) obtiene su propia REGIÓN de texto — acotada por la
 * mención anterior y la siguiente (o los límites de la frase) — para
 * que la extracción de verbo/dosis/frecuencia/duración de UNA mención
 * nunca lea datos que en realidad pertenecen a otra mención de la misma
 * frase. El límite entre dos menciones se busca primero en el propio
 * verbo de la siguiente mención (p. ej. "... durante 14 días Y SE
 * INTENSIFICA fisioterapia respiratoria" — el límite cae justo antes de
 * "se intensifica", no a mitad de frase), y si no hay ninguno, en el
 * conector ("y", "e", ",") entre ambas.
 */
import { indexOfSentenceEnd } from "../fragment";
import { NON_PHARMACOLOGICAL_TREATMENTS, RESPIRATORY_SUPPORT_KEYWORDS, TREATMENT_KEYWORDS } from "../keywords";

export interface TreatmentExtraction {
  kind: "started" | "stopped";
  isRespiratorySupport: boolean;
  drug: string;
  dose: string | null;
  schedule: string | null;
  frequency: string | null;
  duration: string | null;
  changeNote: string | null;
  fragment: string;
}

const STARTED_VERBS = /(se\s+inicia|inicia|añade|comienza|se\s+pauta|pauta|prescribe|reinicia)/i;
const STOPPED_VERBS = /(retira|suspende|finaliza|discontin[uú]a)/i;

/** Cambios sobre un tratamiento ya en marcha — nunca un inicio nuevo, nunca una retirada. Solo se comprueban cuando ni STARTED_VERBS ni STOPPED_VERBS coinciden con la región, para no duplicar la señal. */
const CHANGE_PATTERNS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /(aumenta|incrementa)\s+(la\s+)?dosis/i, note: "aumento de dosis" },
  { pattern: /(reduce|disminuye)\s+(la\s+)?dosis/i, note: "reducción de dosis" },
  { pattern: /ajusta\s+(la\s+)?dosis/i, note: "ajuste de dosis" },
  { pattern: /(se\s+)?intensifica|(se\s+)?refuerza/i, note: "intensificación" },
];
const ALL_VERB_PATTERNS = [STARTED_VERBS, STOPPED_VERBS, ...CHANGE_PATTERNS.map((c) => c.pattern)];

const DOSE_PATTERN = /\d+(?:[.,]\d+)?\s?mg\b/i;
const FREQUENCY_PATTERN = /cada\s*\d+\s*(horas?|h\b|d[ií]as?)/i;
const DURATION_PATTERN = /durante\s*\d+\s*(d[ií]as?|semanas?|meses?)/i;
const SCHEDULE_PATTERN = /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[^.]{0,30}/i;

interface Mention {
  isPharma: boolean;
  drug: string;
  start: number;
  end: number;
}

function findMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  for (const drug of TREATMENT_KEYWORDS) {
    const m = text.match(new RegExp(drug, "i"));
    if (m && m.index != null) mentions.push({ isPharma: true, drug, start: m.index, end: m.index + m[0].length });
  }
  for (const nonPharma of NON_PHARMACOLOGICAL_TREATMENTS) {
    const m = text.match(nonPharma.pattern);
    if (m && m.index != null) mentions.push({ isPharma: false, drug: m[0].trim(), start: m.index, end: m.index + m[0].length });
  }
  return mentions.sort((a, b) => a.start - b.start);
}

/** Primer "." que cierra frase real ANTES de `pos` (mismo criterio decimal-seguro que indexOfSentenceEnd), o 0 si no hay ninguno — con espacio/salto de línea inicial ya descartado. */
function sentenceStartBefore(text: string, pos: number): number {
  let start = 0;
  let cursor = 0;
  while (cursor < pos) {
    const end = indexOfSentenceEnd(text, cursor);
    if (end === -1 || end >= pos) break;
    start = end + 1;
    cursor = end + 1;
  }
  while (start < text.length && /\s/.test(text[start])) start++;
  return start;
}

function sentenceEndAfter(text: string, pos: number): number {
  const end = indexOfSentenceEnd(text, pos);
  return end === -1 ? text.length : end + 1;
}

/** Punto de corte entre dos menciones consecutivas DENTRO de la misma frase: el verbo propio de la siguiente mención si aparece en el hueco, si no el conector ("y"/"e"/","), si no el propio inicio de la siguiente mención. */
function findGapSplit(text: string, from: number, to: number): number {
  const gap = text.slice(from, to);
  let bestIndex = -1;
  for (const pattern of ALL_VERB_PATTERNS) {
    const m = gap.match(pattern);
    if (m && m.index != null && (bestIndex === -1 || m.index < bestIndex)) bestIndex = m.index;
  }
  if (bestIndex !== -1) return from + bestIndex;
  const connector = gap.match(/\s+[ye]\s+|,\s*/i);
  if (connector && connector.index != null) return from + connector.index;
  return to;
}

/** Límite compartido entre la mención `a` (que termina en `aEnd`) y la mención `b` (que empieza en `bStart`) — nunca cruza un final de frase real. */
function boundaryBetween(text: string, aEnd: number, bStart: number): number {
  const naturalEnd = sentenceEndAfter(text, aEnd);
  if (naturalEnd <= bStart) return naturalEnd;
  return findGapSplit(text, aEnd, bStart);
}

export function extractTreatments(segmentText: string): TreatmentExtraction[] {
  const mentions = findMentions(segmentText);
  if (!mentions.length) return [];

  const boundaries: number[] = [];
  for (let i = 0; i < mentions.length - 1; i++) {
    boundaries.push(boundaryBetween(segmentText, mentions[i].end, mentions[i + 1].start));
  }

  const results: TreatmentExtraction[] = [];

  mentions.forEach((mention, idx) => {
    const regionStart = idx === 0 ? sentenceStartBefore(segmentText, mention.start) : boundaries[idx - 1];
    const regionEnd = idx === mentions.length - 1 ? sentenceEndAfter(segmentText, mention.start) : boundaries[idx];
    const region = segmentText.slice(regionStart, regionEnd);

    const started = STARTED_VERBS.test(region);
    const stopped = !started && STOPPED_VERBS.test(region);
    const change = !started && !stopped ? CHANGE_PATTERNS.find((c) => c.pattern.test(region)) : undefined;
    if (!started && !stopped && !change) return;

    const kind: "started" | "stopped" = stopped ? "stopped" : "started";
    const doseMatch = kind === "started" ? region.match(DOSE_PATTERN) : null;
    const frequencyMatch = kind === "started" ? region.match(FREQUENCY_PATTERN) : null;
    const durationMatch = kind === "started" ? region.match(DURATION_PATTERN) : null;
    const scheduleMatch = kind === "started" ? region.match(SCHEDULE_PATTERN) : null;

    const fragment = segmentText
      .slice(mention.start, regionEnd)
      .trim()
      .replace(/\s+[ye]\s*$/i, "");

    results.push({
      kind,
      isRespiratorySupport: mention.isPharma && (RESPIRATORY_SUPPORT_KEYWORDS as readonly string[]).includes(mention.drug),
      drug: mention.drug,
      dose: doseMatch ? doseMatch[0].trim() : null,
      schedule: scheduleMatch ? scheduleMatch[0].trim() : null,
      frequency: frequencyMatch ? frequencyMatch[0].trim() : null,
      duration: durationMatch ? durationMatch[0].trim() : null,
      changeNote: change?.note ?? null,
      fragment,
    });
  });

  return results;
}
