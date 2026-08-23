/**
 * Etiquetas de presentación compartidas para mostrar contenido de guías
 * (GRADE, sociedad/año) en la UI. Traducción literal de las categorías
 * que las propias guías declaran (ver notas de fidelidad en
 * engines/guidelines/knowledge/ers2025.ts y separ2018.ts) — no añade
 * ninguna categoría nueva.
 */
export const STRENGTH_LABEL: Record<string, string> = { strong: "Fuerte", conditional: "Condicional" };
export const EVIDENCE_QUALITY_LABEL: Record<string, string> = { "very low": "Muy baja", low: "Baja", moderate: "Moderada", high: "Alta" };

/** "European Respiratory Society (ERS)" + 2025 → "ERS 2025". */
export function guidelineShortLabel(society: string, year: number): string {
  const abbrMatch = society.match(/\(([^)]+)\)/);
  return `${abbrMatch ? abbrMatch[1] : society} ${year}`;
}
