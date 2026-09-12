/**
 * resolveSegmentDates — capa de resolución temporal explícita, entre
 * segmentClinicalText() y el bucle de construcción de eventos de
 * pipeline.ts. Antes de esto, `runExtractionPipeline` usaba la MISMA
 * fecha de importación para cada evento de cada segmento — la
 * transición temporal detectada por segmentación (`temporalLabel`)
 * quedaba solo como texto de trazabilidad, nunca se convertía en una
 * fecha real. Esta capa hace exactamente eso: convierte una expresión
 * temporal relativa en una fecha distinta cuando hay ancla suficiente,
 * y nunca inventa una fecha absoluta cuando no la hay.
 *
 * Dos "relojes" en vez de uno, porque las transiciones del encargo no
 * son todas relativas a lo mismo:
 *   - `cursorDate` — la última fecha resuelta, base de las transiciones
 *     SECUENCIALES ("N después", "al día siguiente": relativas al
 *     segmento/episodio inmediatamente anterior).
 *   - `episodeAnchorDate` — la fecha del último segmento que abrió un
 *     ingreso (mismo criterio que ya usa classify.ts para la categoría
 *     "ingreso": encabezado "Ingreso:", o texto con HOSPITALIZATION_TRIGGER
 *     + señal de exacerbación — reutilizado, no reinventado). Es la base
 *     de "al alta" (con duración) y "durante el ingreso", que son
 *     relativas al INGRESO, no al segmento anterior.
 */
import { addToDate } from "@/utils/date";
import { ANTIBIOTIC_MENTION_TRIGGER, EXACERBATION_SOFT_SIGNS_TRIGGER } from "./keywords";
import { mentionsHospitalization } from "./negation";
import { hasGenuineExplicitExacerbation } from "./extractors/exacerbation";
import type { TextSegment } from "./segmentPatterns";
import type { DateOffset } from "@/utils/date";
import type { DatePrecision, DateSource } from "@/types/clinicalEvent";

export interface ResolvedSegmentDate {
  date: string;
  datePrecision: DatePrecision;
  dateSource: DateSource;
  /** La expresión temporal original ("tres meses después"...) — null si el segmento no venía de una transición temporal. */
  temporalExpression: string | null;
}

const SPANISH_NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3 };

const MONTH_INDEX: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

/** día/semana/mes/año — las cuatro unidades reconocidas empiezan por letras distintas, no hace falta un diccionario exhaustivo de formas acentuadas. */
function unitToOffsetKey(unit: string): keyof DateOffset {
  const u = unit.toLowerCase();
  if (u.startsWith("d")) return "days";
  if (u.startsWith("sem")) return "weeks";
  if (u.startsWith("mes")) return "months";
  return "years";
}

/** "tres meses después", "3 semanas después", "Control a las 3 semanas"... — cantidad en palabras (un/dos/tres) o en dígitos, la primera que aparezca en la expresión. null si no hay ninguna cantidad reconocible (p. ej. "posteriormente"). */
function parseQuantifiedOffset(label: string): DateOffset | null {
  const wordMatch = label.match(/\b(un|una|dos|tres)\s+(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)/i);
  if (wordMatch) {
    return { [unitToOffsetKey(wordMatch[2])]: SPANISH_NUMBER_WORDS[wordMatch[1].toLowerCase()] };
  }
  const digitMatch = label.match(/(\d+)\s*(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)/i);
  if (digitMatch) {
    return { [unitToOffsetKey(digitMatch[2])]: parseInt(digitMatch[1], 10) };
  }
  return null;
}

/** "en marzo de 2027" — año y mes documentados, día no especificado por el texto: se fija al día 1, con datePrecision "documented" igualmente (la ambigüedad es solo de día, no de si el dato viene o no del texto). */
function parseExplicitMonthYear(label: string): string | null {
  const m = label.match(/en\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
  if (!m) return null;
  const month = MONTH_INDEX[m[1].toLowerCase()];
  return `${m[2]}-${String(month + 1).padStart(2, "0")}-01`;
}

/** "Alta hospitalaria tras 7 días" — busca la duración DENTRO del propio segmento de alta, nunca en otro sitio: sin esta frase explícita, "al alta" queda unresolved en vez de inventar cuántos días duró el ingreso. */
function parseDischargeDuration(segmentText: string): DateOffset | null {
  const m = segmentText.match(/tras\s+(\d+)\s*(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)/i);
  if (!m) return null;
  return { [unitToOffsetKey(m[2])]: parseInt(m[1], 10) };
}

/**
 * ¿Este segmento abre un episodio de ingreso? Mismo criterio que ya usa
 * classify.ts para ampliar un encabezado "ingreso" o "consulta" con la
 * categoría "exacerbacion" (ver classifySegment) — reutilizado tal cual,
 * no una regla nueva: encabezado "Ingreso:" explícito; encabezado
 * "Consulta:" o sin encabezado, con mención de hospitalización (negación
 * consciente, ver negation.ts) acompañada de una exacerbación explícita
 * y no agregada (ver hasGenuineExplicitExacerbation) o de signos +
 * antibiótico. Un antecedente agregado ("2 exacerbaciones... en el
 * último año, sin ingresos previos") nunca abre episodio.
 */
function opensHospitalizationEpisode(segment: TextSegment): boolean {
  if (segment.headerCategory === "ingreso") return true;
  if (segment.headerCategory != null && segment.headerCategory !== "consulta") return false;
  const text = segment.text;
  if (!mentionsHospitalization(text)) return false;
  if (hasGenuineExplicitExacerbation(text)) return true;
  return EXACERBATION_SOFT_SIGNS_TRIGGER.test(text) && ANTIBIOTIC_MENTION_TRIGGER.test(text);
}

function unresolved(cursorDate: string, temporalExpression: string): ResolvedSegmentDate {
  return { date: cursorDate, datePrecision: "unresolved", dateSource: "relative_offset", temporalExpression };
}

function derived(date: string, temporalExpression: string): ResolvedSegmentDate {
  return { date, datePrecision: "derived", dateSource: "relative_offset", temporalExpression };
}

/**
 * Resuelve, para cada TextSegment en orden, la fecha con la que debe
 * fecharse cada evento que salga de él. Regla fundamental: nunca inventa
 * una fecha absoluta sin base suficiente — cuando no la hay, conserva
 * `cursorDate` (la última fecha resuelta) marcado `datePrecision:
 * "unresolved"`, nunca "documented" ni "derived", y nunca salta a
 * `anchorDate` como si fuera un valor por defecto seguro.
 */
export function resolveSegmentDates(segments: TextSegment[], anchorDate: string): ResolvedSegmentDate[] {
  const results: ResolvedSegmentDate[] = [];
  let cursorDate = anchorDate;
  let cursorPrecision: DatePrecision = "derived";
  let cursorSource: DateSource = "import_anchor";
  let episodeAnchorDate: string | null = null;

  segments.forEach((segment, index) => {
    if (segment.startsNewEpisode) episodeAnchorDate = null;

    let resolved: ResolvedSegmentDate;
    const label = segment.temporalLabel;
    // "Alta hospitalaria tras 7 días:" llega como ENCABEZADO (headerCategory "alta"), no como transición
    // temporal — matchHeaderLine no deja nada de "alta" en `temporalLabel` (queda null, igual que cualquier
    // otro encabezado). Semánticamente es el mismo caso que "Al alta:" en mitad de la narrativa: sin este
    // chequeo aparte, un encabezado de alta heredaría sin más la fecha del segmento anterior (el ingreso),
    // como si el alta hubiera ocurrido el mismo día — peor que marcarla unresolved.
    const isAltaHeader = segment.headerCategory === "alta";

    if (!label && isAltaHeader) {
      const duration = parseDischargeDuration(segment.text);
      resolved = duration && episodeAnchorDate ? derived(addToDate(episodeAnchorDate, duration), "Alta") : unresolved(cursorDate, "Alta");
    } else if (!label) {
      resolved =
        index === 0
          ? { date: anchorDate, datePrecision: "derived", dateSource: "import_anchor", temporalExpression: null }
          : { date: cursorDate, datePrecision: cursorPrecision, dateSource: cursorSource, temporalExpression: null };
    } else {
      const explicitMonth = parseExplicitMonthYear(label);
      if (explicitMonth) {
        resolved = { date: explicitMonth, datePrecision: "documented", dateSource: "explicit_date", temporalExpression: label };
      } else if (/al d[ií]a siguiente/i.test(label)) {
        resolved = derived(addToDate(cursorDate, { days: 1 }), label);
      } else if (/durante el ingreso/i.test(label)) {
        resolved = episodeAnchorDate ? derived(episodeAnchorDate, label) : unresolved(cursorDate, label);
      } else if (/al alta/i.test(label)) {
        const duration = parseDischargeDuration(segment.text);
        resolved = duration && episodeAnchorDate ? derived(addToDate(episodeAnchorDate, duration), label) : unresolved(cursorDate, label);
      } else {
        const offset = parseQuantifiedOffset(label);
        resolved = offset ? derived(addToDate(cursorDate, offset), label) : unresolved(cursorDate, label);
      }
    }

    if (opensHospitalizationEpisode(segment)) episodeAnchorDate = resolved.date;

    cursorDate = resolved.date;
    cursorPrecision = resolved.datePrecision;
    cursorSource = resolved.dateSource;
    results.push(resolved);
  });

  return results;
}
