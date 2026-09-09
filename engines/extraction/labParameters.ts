/**
 * Parser de bloques de analítica pegados tal cual desde IANUS (u otro
 * sistema con el mismo formato de línea: prefijo de muestra + nombre +
 * valor + unidad + rango de referencia entre corchetes + posible `*` de
 * fuera de rango), no de ejemplos limpios escritos a mano. Cada línea se
 * interpreta de forma AISLADA y conservadora:
 *
 *   - si la línea encaja con seguridad en el patrón "nombre valor [unidad]
 *     [rango] [*]", se estructura en un LabParameter;
 *   - si no (encabezados, comentarios, fechas, valores cualitativos,
 *     texto narrativo, formato irregular no reconocido...), la línea se
 *     conserva tal cual en `unparsedLines` — NUNCA se descarta ni se
 *     fuerza una interpretación dudosa.
 *
 * No es un parser de lenguaje natural: es un conjunto de reglas
 * sintácticas explícitas, deliberadamente estrecho, para no inventar
 * estructura que la línea no da con claridad. Ver tests/engines/
 * labParameters.test.ts, incluyendo bloques completos con líneas
 * ruidosas mezcladas, para el comportamiento exacto caso a caso.
 */
import type { LabParameter, LabParameterCategory, LabReferenceRange } from "@/types/clinicalEvent";

/**
 * Prefijos de tipo de muestra que IANUS antepone al nombre del parámetro
 * ("Srm-" = suero, "San-" = sangre, "Pla-" = plasma...). Se exige el
 * guion para no confundir con un nombre de parámetro que empiece por las
 * mismas letras (p. ej. no recortar "Sangre oculta" como si "San-" fuera
 * el prefijo).
 */
const SAMPLE_PREFIX_RE = /^(Srm|San|Pla|Ori|Liq|LCR)-/i;

/**
 * FEV1/FVC/DLCO ya los extrae el bloque de función pulmonar más arriba en
 * runExtractionEngine (con su propio regex, z-scores incluidos) — si
 * aparecen en formato de línea suelta ("FEV1 78%") no deben duplicarse
 * aquí como si fueran un parámetro de analítica.
 */
const PFT_NAME_DENYLIST = /^(fev1\/fvc|fev1|fvc|dlco|pef|fef2575?)$/i;

interface LabParameterSynonym {
  canonical: string;
  category: LabParameterCategory;
  /** Nombres reconocidos, en minúsculas y sin acentos — comparación exacta, nunca por subcadena (ver stripAccents/lookupSynonym). */
  names: string[];
}

/**
 * Capa de normalización de nombres — CONSERVADORA a propósito: solo
 * fusiona variantes que son inequívocamente el mismo parámetro (siglas y
 * abreviaturas estándar de laboratorio). Un nombre que no aparece aquí
 * NUNCA se fuerza a encajar en uno de estos — se conserva tal cual (sin
 * prefijo de muestra) como su propio parámetro, con categoría "general"
 * por defecto (ver resolveNameAndCategory). No se amplía esta lista para
 * cubrir "todo lo posible": cada entrada es una equivalencia realmente
 * inequívoca en el contexto de un informe de laboratorio.
 */
const LAB_PARAMETER_SYNONYMS: LabParameterSynonym[] = [
  { canonical: "Leucocitos", category: "general", names: ["leucocitos", "leucos", "leu", "wbc"] },
  { canonical: "Hemoglobina", category: "general", names: ["hemoglobina", "hb"] },
  { canonical: "Hematocrito", category: "general", names: ["hematocrito", "hto", "hct"] },
  { canonical: "Plaquetas", category: "general", names: ["plaquetas", "plt"] },
  { canonical: "Neutrófilos", category: "general", names: ["neutrofilos", "neutrófilos", "neu"] },
  { canonical: "Linfocitos", category: "general", names: ["linfocitos", "linf", "lym"] },
  { canonical: "Eosinófilos", category: "general", names: ["eosinofilos", "eosinófilos", "eos"] },
  { canonical: "PCR", category: "general", names: ["pcr", "proteina c reactiva", "proteína c reactiva"] },
  { canonical: "Procalcitonina", category: "general", names: ["procalcitonina", "pct"] },
  { canonical: "VSG", category: "general", names: ["vsg"] },
  { canonical: "Creatinina", category: "general", names: ["creatinina", "cr"] },
  { canonical: "Urea", category: "general", names: ["urea"] },
  { canonical: "Sodio", category: "general", names: ["sodio", "na"] },
  { canonical: "Potasio", category: "general", names: ["potasio", "k"] },
  { canonical: "Glucosa", category: "general", names: ["glucosa", "glu"] },
  { canonical: "ALT (GPT)", category: "general", names: ["alt", "gpt", "alt (gpt)"] },
  { canonical: "AST (GOT)", category: "general", names: ["ast", "got", "ast (got)"] },
  { canonical: "Bilirrubina total", category: "general", names: ["bilirrubina total", "bilirrubina"] },
  { canonical: "IgG", category: "etiologico", names: ["igg", "inmunoglobulina g"] },
  { canonical: "IgA", category: "etiologico", names: ["iga", "inmunoglobulina a"] },
  { canonical: "IgM", category: "etiologico", names: ["igm", "inmunoglobulina m"] },
  { canonical: "Alfa-1-antitripsina", category: "etiologico", names: ["alfa-1-antitripsina", "alfa 1 antitripsina", "aat"] },
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function lookupSynonym(name: string): LabParameterSynonym | null {
  const norm = stripAccents(name.trim().toLowerCase());
  return LAB_PARAMETER_SYNONYMS.find((s) => s.names.some((n) => stripAccents(n) === norm)) ?? null;
}

/**
 * Línea IANUS típica: `[Prefijo-]Nombre valor[ unidad][ [rango]][ *]`.
 * Grupos posicionales (no con nombre: el `target` de tsconfig es ES2017,
 * anterior al soporte de grupos con nombre) — [1] nombre, [2] valor,
 * [3] unidad, [4] contenido crudo del rango (se interpreta aparte en
 * parseRangeContent, porque IANUS usa varias formas: "4 - 10", "<4.5",
 * ">15"), [5] asterisco. El ancla final `$` es deliberada: cualquier
 * resto de texto que no encaje en esta forma hace fallar la línea
 * entera, en vez de aceptar una coincidencia parcial.
 */
const LINE_RE = /^(.+?)\s+(-?\d+(?:[.,]\d+)?)\s*([^[*]*?)\s*(?:\[([^\]]*)\])?\s*(\*)?\s*$/;

/** Un "." que no está entre dos dígitos delata una frase en prosa (punto y seguido), no una línea de analítica — ver el ejemplo de "Prosa" en los tests. */
function hasStrayPeriod(line: string): boolean {
  return /(?<!\d)\.|\.(?!\d)/.test(line);
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const UNIT_CHARSET_RE = /^[A-Za-zµ%°/^.\-0-9·]*$/;

/**
 * Una unidad real casi siempre trae al menos una letra (mg/dL, x10^3/µL,
 * U/L...) — "%" y "°" son las únicas excepciones sin letra. Una cadena
 * solo numérica/con barras (p. ej. "/03/2026", resto de una fecha) no es
 * una unidad real: rechazar la línea en vez de aceptar una unidad
 * inventada.
 */
function looksLikeUnit(u: string): boolean {
  if (!u) return true;
  if (u === "%" || u === "°") return true;
  return /[A-Za-zµ]/.test(u);
}

/**
 * Interpreta el contenido de "[...]" en sus formas reales de IANUS:
 * "low - high", "<high"/"≤high", ">low"/"≥low". Corchetes vacíos o con
 * contenido que no encaja en ninguna forma → ok:false, y la línea
 * completa se rechaza (no se inventa un rango a partir de algo ambiguo).
 */
function parseRangeContent(raw: string | undefined): { range: LabReferenceRange | null; ok: boolean } {
  if (raw == null) return { range: null, ok: true };
  const s = raw.trim();
  if (!s) return { range: null, ok: false };

  const numPair = s.match(/^(-?\d+(?:[.,]\d+)?)?\s*-\s*(-?\d+(?:[.,]\d+)?)?$/);
  if (numPair && (numPair[1] != null || numPair[2] != null)) {
    return {
      range: {
        low: numPair[1] != null ? parseFloat(numPair[1].replace(",", ".")) : null,
        high: numPair[2] != null ? parseFloat(numPair[2].replace(",", ".")) : null,
      },
      ok: true,
    };
  }
  const upper = s.match(/^[<≤]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (upper) return { range: { low: null, high: parseFloat(upper[1].replace(",", ".")) }, ok: true };

  const lower = s.match(/^[>≥]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (lower) return { range: { low: parseFloat(lower[1].replace(",", ".")), high: null }, ok: true };

  return { range: null, ok: false };
}

/**
 * Estado solo cuando puede calcularse con seguridad a partir del propio
 * dato: valor numérico + al menos un extremo del rango que el informe
 * trae. El asterisco de IANUS ("*", posible indicador de fuera de rango)
 * solo se usa como respaldo cuando no hay rango numérico con el que
 * calcular — nunca sustituye al cálculo cuando este es posible, y nunca
 * es la única fuente si hay un dato más objetivo disponible.
 */
function resolveStatus(numericValue: number | null, range: LabReferenceRange | null, flag: boolean): LabParameter["status"] {
  if (range && numericValue != null) {
    const { low, high } = range;
    if (low != null && high != null) return numericValue < low || numericValue > high ? "alterado" : "normal";
    if (low != null) return numericValue < low ? "alterado" : "normal";
    if (high != null) return numericValue > high ? "alterado" : "normal";
  }
  return flag ? "alterado" : null;
}

/**
 * Intenta interpretar UNA línea como parámetro analítico estructurado.
 * Devuelve null cuando la línea no encaja con seguridad — nunca fuerza
 * una interpretación parcial o dudosa.
 */
export function parseLabParameterLine(rawLine: string): LabParameter | null {
  const line = rawLine.trim();
  if (!line || hasStrayPeriod(line)) return null;

  const m = line.match(LINE_RE);
  if (!m) return null;
  const [, nameRaw, value, unit, rangeRaw, flag] = m;

  if (wordCount(nameRaw) > 5) return null;

  const unitTrim = (unit ?? "").trim();
  if (!UNIT_CHARSET_RE.test(unitTrim) || !looksLikeUnit(unitTrim)) return null;

  const rangeParsed = parseRangeContent(rangeRaw);
  if (!rangeParsed.ok) return null;

  const prefixMatch = nameRaw.match(SAMPLE_PREFIX_RE);
  let nameNoPrefix = prefixMatch ? nameRaw.slice(prefixMatch[0].length).trim() : nameRaw.trim();
  nameNoPrefix = nameNoPrefix.replace(/:$/, "").trim();
  if (!nameNoPrefix) return null;
  if (PFT_NAME_DENYLIST.test(nameNoPrefix.replace(/\s+/g, ""))) return null;

  const synonym = lookupSynonym(nameNoPrefix);
  const canonicalName = synonym ? synonym.canonical : nameNoPrefix;
  const category: LabParameterCategory = synonym ? synonym.category : "general";

  const numericValue = parseFloat(value.replace(",", "."));
  if (Number.isNaN(numericValue)) return null;

  return {
    name: canonicalName,
    rawName: nameRaw.trim(),
    valueText: `${value}${unitTrim ? ` ${unitTrim}` : ""}`.trim(),
    numericValue,
    unit: unitTrim || null,
    referenceRange: rangeParsed.range,
    status: resolveStatus(numericValue, rangeParsed.range, !!flag),
    category,
  };
}

export interface LabBlockParseResult {
  parameters: LabParameter[];
  /** Líneas no vacías que no se pudieron interpretar con seguridad — se conservan tal cual, nunca se descartan. */
  unparsedLines: string[];
}

/** Divide un bloque de texto en líneas e intenta estructurar cada una por separado — ver parseLabParameterLine. Las líneas vacías se ignoran (no cuentan como "sin interpretar"). */
export function parseLabBlock(text: string): LabBlockParseResult {
  const parameters: LabParameter[] = [];
  const unparsedLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseLabParameterLine(trimmed);
    if (parsed) parameters.push(parsed);
    else unparsedLines.push(trimmed);
  }
  return { parameters, unparsedLines };
}
