/**
 * Captura de fragmento decimal-segura — mismo problema ya resuelto en
 * engines/extraction/labParameters.ts (un "." entre dos dígitos es
 * decimal, no fin de frase). El antiguo `captureSentence` de este motor
 * buscaba el primer "." sin esa comprobación, así que truncaba mal
 * cualquier valor con decimales ("z-score -1.9" → cortaba en "-1.").
 * Toda la extracción por segmento pasa ahora por aquí para que el
 * `rawText` de un evento sea SIEMPRE el fragmento real que lo justifica,
 * nunca el documento completo — ver engines/extraction/pipeline.ts.
 */

/** Índice del primer "." que cierra una frase real a partir de `from` — -1 si no hay ninguno. Salta los puntos decimales (dígito.dígito). */
export function indexOfSentenceEnd(text: string, from = 0): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] !== ".") continue;
    const prev = text[i - 1];
    const next = text[i + 1];
    if (prev != null && next != null && /\d/.test(prev) && /\d/.test(next)) continue;
    return i;
  }
  return -1;
}

/**
 * Captura desde la primera aparición de `trigger` hasta el siguiente
 * final de frase real (o el resto del texto si no hay ninguno) — nunca
 * el texto completo. `null` si `trigger` no aparece en `text`.
 */
export function captureFragment(text: string, trigger: RegExp): { label: string; fragment: string } | null {
  const m = text.match(trigger);
  if (m == null || m.index == null) return null;
  const rest = text.slice(m.index);
  const end = indexOfSentenceEnd(rest, 0);
  const fragment = (end === -1 ? rest : rest.slice(0, end + 1)).trim();
  return { label: m[0].trim(), fragment };
}

/**
 * Variante para datos que pueden repartirse en varias frases seguidas
 * dentro del mismo segmento (p. ej. función pulmonar: "FEV1 70%. FVC
 * 85%. DLCO 70%." son 3 frases distintas pero un único hallazgo) — capta
 * desde el primer marcador encontrado hasta el final de frase del
 * ÚLTIMO marcador, sin arrastrar prosa no relacionada antes o después.
 * `null` si ningún marcador aparece en el texto.
 */
export function captureFragmentSpanningMarkers(text: string, markers: RegExp[]): string | null {
  const indices = markers.map((r) => text.search(r)).filter((i) => i >= 0);
  if (!indices.length) return null;
  const start = Math.min(...indices);
  const lastMarkerPos = Math.max(...indices);
  const end = indexOfSentenceEnd(text, lastMarkerPos);
  return text.slice(start, end === -1 ? text.length : end + 1).trim();
}

/**
 * Como `captureFragmentSpanningMarkers`, pero para uno o varios
 * patrones que pueden aparecer VARIAS veces cada uno en el mismo
 * segmento (p. ej. narrativa de consulta repartida en dos frases:
 * "Refiere aumento de disnea. (...) Se mantiene estable."; o esa misma
 * narrativa seguida de constantes vitales sueltas — "SatO₂ 91%, FR 22
 * rpm" — que no llevan ningún verbo narrativo propio pero pertenecen al
 * mismo relato de consulta, ver extractors/consultation.ts). Capta
 * desde la primera aparición de cualquiera de los patrones hasta el
 * final de frase de la ÚLTIMA aparición de cualquiera de ellos — nunca
 * el segmento completo cuando solo una parte de él es realmente
 * narrativa. `null` si ningún patrón aparece.
 */
export function captureFragmentSpanningAllMatches(text: string, trigger: RegExp | RegExp[]): string | null {
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  const indices: number[] = [];
  for (const t of triggers) {
    const global = new RegExp(t.source, t.flags.includes("g") ? t.flags : `${t.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = global.exec(text))) {
      indices.push(m.index);
      if (global.lastIndex === m.index) global.lastIndex += 1;
    }
  }
  if (!indices.length) return null;
  const start = Math.min(...indices);
  const end = indexOfSentenceEnd(text, Math.max(...indices));
  return text.slice(start, end === -1 ? text.length : end + 1).trim();
}
