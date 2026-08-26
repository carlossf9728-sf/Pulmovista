/**
 * Interpretación clínica del cambio longitudinal en radiología —
 * clasifica el propio texto del informe (`ImagingEvent.text`), no una
 * comparación de datos numéricos: se apoya en que el informe suele
 * describir explícitamente el cambio respecto al estudio previo
 * ("progresión...", "sin cambios...", "resolución de..."). Es un
 * reconocimiento de palabras clave sobre texto libre — la misma técnica
 * ya usada en engines/extraction (regex sobre texto dictado) y
 * engines/privacy — no una comprensión del informe ni un umbral clínico.
 *
 * Maneja negaciones ("sin progresión", "no se observa aumento") para no
 * convertir la ausencia de cambio en un falso "Empeoramiento" — es
 * justo el caso que más se repite en radiología torácica de control
 * ("sin cambios significativos", "sin progresión de las lesiones").
 *
 * Si el mismo informe contiene términos de ambas direcciones (p. ej.
 * progresión de un hallazgo y resolución de otro), o ningún término
 * reconocido, no se etiqueta — más vale no interpretar que interpretar
 * mal un informe mixto.
 */
import type { ClinicalTrend } from "@/types/clinicalTrend";

const WORSENING_TERMS =
  /progresi[oó]n|progresa(n)?|aumento de|aumenta(n)?|empeora(miento|n)?|nueva(s)? lesi[oó]n(es)?|nuevo(s)? (foco|n[oó]dulo|infiltrado|derrame)|mayor (extensi[oó]n|afectaci[oó]n)|extensi[oó]n de/gi;

const IMPROVING_TERMS =
  /resoluci[oó]n de|resuelve(n)?|regresi[oó]n de|regresa(n)?|mejor[ií]a|mejora(n)?|disminuci[oó]n de|disminuye(n)?|reducci[oó]n de|reduce(n)?/gi;

const NEGATORS = [
  "sin",
  "no",
  "ausencia de",
  "descarta",
  "descartan",
  "niega",
  "no se observa",
  "no se objetiva",
  "no hay",
  "no existe",
  "sin evidencia de",
  "sin datos de",
  "sin signos de",
];

const NEGATION_WINDOW = 45;

/** ¿La aparición del término en `matchIndex` está negada por una palabra de negación en la ventana inmediatamente anterior? */
function isNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex).toLowerCase();
  return NEGATORS.some((neg) => new RegExp(`\\b${neg}\\b[^.;]{0,30}$`, "i").test(before));
}

/** Primera aparición NO negada del patrón, o null si no hay ninguna (todas las apariciones están negadas, o no hay ninguna). */
function firstUnnegatedMatch(text: string, pattern: RegExp): string | null {
  for (const m of text.matchAll(pattern)) {
    if (m.index != null && !isNegated(text, m.index)) return m[0];
  }
  return null;
}

export interface RadiologyTrendResult {
  trend: ClinicalTrend;
  /** Término que motivó la clasificación, para trazabilidad (p. ej. en el tooltip de la etiqueta). null si trend es null. */
  matchedTerm: string | null;
}

export function classifyRadiologyTrend(text: string): RadiologyTrendResult {
  const worsening = firstUnnegatedMatch(text, WORSENING_TERMS);
  const improving = firstUnnegatedMatch(text, IMPROVING_TERMS);

  // Señales de ambas direcciones en el mismo informe: no hay una dirección clara global, no se etiqueta.
  if (worsening && improving) return { trend: null, matchedTerm: null };
  if (worsening) return { trend: "Empeoramiento", matchedTerm: worsening };
  if (improving) return { trend: "Mejoría", matchedTerm: improving };
  return { trend: null, matchedTerm: null };
}
