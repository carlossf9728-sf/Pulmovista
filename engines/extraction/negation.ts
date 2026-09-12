/**
 * Menciones de hospitalización/exacerbación con negación — "sin ingresos
 * previos", "no requirió ingreso", "sin ingreso hospitalario". Sin este
 * chequeo, HOSPITALIZATION_TRIGGER (keywords.ts) lee "ingresos" dentro de
 * "sin ingresos previos" como si describiera un ingreso real: corrompe
 * tanto el flag `hospitalization` de un ExacerbationEvent como el
 * recuento de hospitalizaciones y la apertura de episodio en
 * resolveDates.ts. Deliberadamente estrecho (negación PEGADA a la propia
 * mención, no cualquier "no"/"sin" de la frase) para no descartar por
 * error una mención real solo porque la frase niegue otra cosa distinta
 * ("sin fiebre, ingreso por agudización" debe seguir contando el ingreso).
 */
import { indexOfSentenceEnd } from "./fragment";

/** "ingres" (ingreso/ingresa/ingresó/ingresado/reingreso) + "hospitali" (hospitalización/hospitalizado) — cubre sustantivo y formas verbales, no solo el sustantivo "ingreso". */
const HOSPITALIZATION_MENTION = /ingres\w*|hospitali\w*/gi;

/** "sin", "no" (+ opcionalmente un verbo de negación pegado, en cualquier conjugación: "requirió"/"requerir", "precisó"/"precisar", "necesitó"/"necesitar") inmediatamente antes de la mención, sin nada más entre medias. */
const NEGATION_IMMEDIATELY_BEFORE = /\b(sin|no)\s+(?:requ(?:iri[oó]|erir|iere)|precis[oaó]r?|necesit(?:[oó]|ar|a))?\s*$/i;

/** Índice de la primera mención de `pattern` en `text` que NO está negada justo antes — -1 si todas están negadas o no hay ninguna. `pattern` debe llevar el flag "g". */
function firstUnnegatedMatchIndex(text: string, pattern: RegExp): number {
  const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = global.exec(text))) {
    const before = text.slice(0, m.index);
    if (!NEGATION_IMMEDIATELY_BEFORE.test(before)) return m.index;
    if (global.lastIndex === m.index) global.lastIndex += 1;
  }
  return -1;
}

/** ¿El texto menciona una hospitalización REAL, no solo su negación? "sin ingresos previos... ingresa por agudización" cuenta (la segunda mención no está negada); "sin ingresos previos" a secas no cuenta. "Manejo ambulatorio"/"tratamiento ambulatorio" nunca activan esto en primer lugar: no contienen "ingres"/"hospitali", así que no hace falta negarlos aparte. */
export function mentionsHospitalization(text: string): boolean {
  return firstUnnegatedMatchIndex(text, HOSPITALIZATION_MENTION) !== -1;
}

/** ¿El texto menciona la PALABRA ingreso/hospitalización, negada o no? Distingue "no se menciona en absoluto" (esta función devuelve false) de "se menciona y está negada" (mentionsHospitalization sería false, pero esto es true) — necesario para no confundir "0 ingresos previos" (negación explícita) con "no consta si hubo ingresos" (ausencia de mención) al construir un recuento agregado. */
export function containsHospitalizationWord(text: string): boolean {
  return new RegExp(HOSPITALIZATION_MENTION.source, "i").test(text);
}

/** Frase completa (no solo desde `index` hasta el final: también hacia atrás, hasta el punto anterior) que contiene la posición `index` — misma noción de "fin de frase" que fragment.ts#indexOfSentenceEnd (un "." entre dígitos es decimal, no separador). Compartida por exacerbation.ts para distinguir, DENTRO de un mismo segmento, una frase de antecedente agregado de una frase que describe un episodio real. */
export function sentenceContaining(text: string, index: number): string {
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

/** Como captureFragment (ver fragment.ts) pero arrancando en la primera mención de hospitalización NO negada — nunca captura "sin ingresos previos" como si fuera el fragmento que justifica el evento cuando existe una mención real más adelante. `null` si ninguna mención real existe. */
export function captureHospitalizationFragment(text: string): { label: string; fragment: string } | null {
  const idx = firstUnnegatedMatchIndex(text, HOSPITALIZATION_MENTION);
  if (idx === -1) return null;
  const rest = text.slice(idx);
  const end = indexOfSentenceEnd(rest, 0);
  const fragment = (end === -1 ? rest : rest.slice(0, end + 1)).trim();
  const label = (rest.match(/ingres\w*|hospitali\w*/i)?.[0] ?? "").trim();
  return { label, fragment };
}
