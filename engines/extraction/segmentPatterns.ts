/**
 * Patrones de SEGMENTACIÓN — distintos de los "disparadores de
 * contenido" de keywords.ts (que confirman "este trozo de texto es de la
 * categoría X"). Estos deciden DÓNDE empieza y termina un segmento:
 * encabezados explícitos ("Analítica:") y transiciones temporales
 * ("Tres meses después:"). Ver engines/extraction/segment.ts.
 */

export type SegmentCategory =
  | "consulta"
  | "funcion_pulmonar"
  | "microbiologia"
  | "analitica"
  | "radiologia"
  | "tratamiento"
  | "procedimiento"
  | "prueba_esfuerzo"
  | "ingreso"
  | "alta"
  | "exacerbacion"
  | "otro";

export interface TextSegment {
  text: string;
  /** Categoría que declaraba un encabezado explícito al inicio del segmento ("Analítica:") — null si el segmento no tenía encabezado propio. */
  headerCategory: SegmentCategory | null;
  /** true si este segmento arranca justo tras una transición temporal que cierra el episodio anterior (ver TEMPORAL_TRANSITIONS `resetsEpisode`). */
  startsNewEpisode: boolean;
  /** Frase de transición temporal detectada al inicio del segmento, tal cual aparece en el texto — null si no la hay. Solo para trazabilidad, nunca se interpreta como fecha real. */
  temporalLabel: string | null;
}

/**
 * Encabezados reconocidos SOLO cuando ocupan toda la línea (con o sin
 * contenido tras ":") — nunca por aparecer sueltos en medio de una
 * frase, para no confundir "Tratamiento" como palabra normal ("continúa
 * el mismo tratamiento") con un encabezado real de sección.
 */
export const SEGMENT_HEADER_WORDS: { category: SegmentCategory; words: string }[] = [
  { category: "consulta", words: "consulta(\\s*/\\s*evoluci[oó]n)?|evoluci[oó]n" },
  { category: "funcion_pulmonar", words: "funci[oó]n pulmonar|pfr|espirometr[ií]a" },
  { category: "microbiologia", words: "microbiolog[ií]a|cultivo" },
  { category: "analitica", words: "anal[ií]tica|laboratorio" },
  { category: "radiologia", words: "radiolog[ií]a|tc\\s*(de\\s*)?t[oó]rax|tac(\\s*tor[aá]cico)?|rx(\\s*(de\\s*)?t[oó]rax)?" },
  { category: "tratamiento", words: "tratamiento(s)?" },
  { category: "procedimiento", words: "procedimiento(s)?" },
  { category: "ingreso", words: "ingreso|hospitalizaci[oó]n" },
  { category: "alta", words: "alta( hospitalaria| m[eé]dica)?" },
  { category: "prueba_esfuerzo", words: "prueba de esfuerzo" },
];

/**
 * Transiciones temporales (ver keywords del encargo). `resetsEpisode`
 * distingue dos casos: "tres meses después"/"posteriormente"/fechas
 * explícitas cierran el episodio anterior (es un encuentro nuevo,
 * separado); "durante el ingreso"/"al alta"/"al día siguiente" son
 * marcadores DENTRO del mismo episodio de hospitalización, no abren uno
 * nuevo. Es una decisión de SEGMENTACIÓN (dónde cortar el texto y cómo
 * enlazar `episodeId`), no un criterio clínico.
 */
export const TEMPORAL_TRANSITIONS: { pattern: RegExp; resetsEpisode: boolean }[] = [
  { pattern: /tres meses despu[eé]s/i, resetsEpisode: true },
  { pattern: /dos meses despu[eé]s/i, resetsEpisode: true },
  { pattern: /un mes despu[eé]s/i, resetsEpisode: true },
  { pattern: /\d+\s*(meses|semanas|d[ií]as|a[ñn]os)\s*despu[eé]s/i, resetsEpisode: true },
  { pattern: /(?:control|revisi[oó]n)\s+a\s+las?\s+\d+\s*(?:semanas|meses|d[ií]as|a[ñn]os)/i, resetsEpisode: true },
  { pattern: /posteriormente/i, resetsEpisode: true },
  { pattern: /en la siguiente revisi[oó]n/i, resetsEpisode: true },
  {
    pattern: /en\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+\d{4}/i,
    resetsEpisode: true,
  },
  { pattern: /al d[ií]a siguiente/i, resetsEpisode: false },
  { pattern: /durante el ingreso/i, resetsEpisode: false },
  { pattern: /al alta/i, resetsEpisode: false },
];
