/**
 * segmentClinicalText — capa 1 del pipeline de extracción (ver
 * engines/extraction/pipeline.ts): divide un bloque clínico largo en
 * segmentos ANTES de clasificar o extraer nada, para que cada evento
 * final solo pueda construirse a partir de SU fragmento, nunca del
 * documento completo.
 *
 * Dos señales de corte, ambas ancladas al inicio de línea (nunca en
 * medio de una frase, para no fragmentar de más un texto sin estructura
 * clara — ver "Texto sin encabezados" en tests/engines/extraction/pipeline.test.ts):
 *
 *   1. Encabezados explícitos ("Analítica:", "Tratamiento") — ver
 *      SEGMENT_HEADER_WORDS. El segmento se etiqueta con esa categoría
 *      y arranca ahí; termina en el siguiente encabezado, transición
 *      temporal o fin del texto.
 *   2. Transiciones temporales ("Tres meses después:", "Al alta") — ver
 *      TEMPORAL_TRANSITIONS. Cierran el segmento anterior y arrancan uno
 *      nuevo SIN encabezado propio (headerCategory null); el pipeline
 *      decide su categoría con classifySegment.
 *
 * Sin ninguna de las dos señales en todo el texto, se devuelve un único
 * segmento con todo el contenido — el mismo texto sin estructura que ya
 * manejaban los extractores heredados (captureFragment/parseLabBlock
 * siguen acotando cada hallazgo dentro de ese segmento, ver
 * engines/extraction/extractors/).
 */
import { SEGMENT_HEADER_WORDS, TEMPORAL_TRANSITIONS } from "./segmentPatterns";
import type { SegmentCategory, TextSegment } from "./segmentPatterns";

interface LineMatch {
  category: SegmentCategory | null;
  isTemporal: boolean;
  resetsEpisode: boolean;
  temporalLabel: string | null;
  sameLineContent: string;
}

function matchHeaderLine(trimmedLine: string): LineMatch | null {
  for (const { category, words } of SEGMENT_HEADER_WORDS) {
    const re = new RegExp(`^(${words})\\s*:?\\s*(.*)$`, "i");
    const m = trimmedLine.match(re);
    // Exige ":" cuando hay contenido tras el encabezado en la misma línea — así "Tratamiento habitual sin cambios"
    // no se confunde con un encabezado de sección seguido de su contenido.
    if (m && (!m[m.length - 1] || trimmedLine.includes(":"))) {
      return { category, isTemporal: false, resetsEpisode: false, temporalLabel: null, sameLineContent: m[m.length - 1]?.trim() ?? "" };
    }
  }
  return null;
}

function matchTemporalLine(trimmedLine: string): LineMatch | null {
  for (const { pattern, resetsEpisode } of TEMPORAL_TRANSITIONS) {
    const re = new RegExp(`^(${pattern.source})\\s*:?\\s*(.*)$`, "i");
    const m = trimmedLine.match(re);
    if (m) {
      return { category: null, isTemporal: true, resetsEpisode, temporalLabel: m[1].trim(), sameLineContent: m[m.length - 1]?.trim() ?? "" };
    }
  }
  return null;
}

export function segmentClinicalText(text: string): TextSegment[] {
  const lines = text.split(/\r?\n/);
  const segments: TextSegment[] = [];

  let current: { lines: string[]; headerCategory: SegmentCategory | null; startsNewEpisode: boolean; temporalLabel: string | null } | null = null;

  function flush() {
    if (!current) return;
    const segText = current.lines.join("\n").trim();
    if (segText) segments.push({ text: segText, headerCategory: current.headerCategory, startsNewEpisode: current.startsNewEpisode, temporalLabel: current.temporalLabel });
    current = null;
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      current?.lines.push(rawLine);
      continue;
    }

    // La transición temporal se comprueba antes que el encabezado: "Al alta" es a la vez transición y
    // palabra de encabezado — como marcador temporal decide si continúa o cierra el episodio, que un
    // encabezado de sección normal no puede hacer.
    const temporal = matchTemporalLine(trimmed);
    const header = temporal ? null : matchHeaderLine(trimmed);

    if (temporal) {
      flush();
      current = {
        lines: temporal.sameLineContent ? [temporal.sameLineContent] : [],
        headerCategory: null,
        startsNewEpisode: temporal.resetsEpisode,
        temporalLabel: temporal.temporalLabel,
      };
      continue;
    }
    if (header) {
      flush();
      current = { lines: header.sameLineContent ? [header.sameLineContent] : [], headerCategory: header.category, startsNewEpisode: false, temporalLabel: null };
      continue;
    }
    if (!current) current = { lines: [], headerCategory: null, startsNewEpisode: false, temporalLabel: null };
    current.lines.push(rawLine);
  }
  flush();

  return segments;
}
