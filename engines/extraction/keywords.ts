export const ORGANISM_PATTERNS = [
  "Pseudomonas aeruginosa",
  "Staphylococcus aureus",
  "Haemophilus influenzae",
  "Stenotrophomonas maltophilia",
  "Moraxella catarrhalis",
  "Achromobacter xylosoxidans",
  "Aspergillus fumigatus",
] as const;

export const TREATMENT_KEYWORDS = [
  "azitromicina",
  "tobramicina",
  "ciprofloxacino",
  "colistina",
  "prednisona",
  "corticoide oral",
  "oxígeno",
  "ventilación no invasiva",
  "nintedanib",
  "pirfenidona",
] as const;

export const RESPIRATORY_SUPPORT_KEYWORDS = ["oxígeno", "ventilación no invasiva"] as const;

/** Menciona una prueba de imagen torácica — dispara la detección de un ImagingEvent candidato. */
export const IMAGING_TRIGGER = /TC\s*(de\s*)?t[oó]rax|TAC(\s*tor[aá]cico)?|radiograf[ií]a(\s*(simple|de))?\s*(de\s*)?t[oó]rax|Rx\s*(de\s*)?t[oó]rax|ecograf[ií]a\s*tor[aá]cica/i;

/** Menciona una prueba de laboratorio — dispara la detección de un LabResultsEvent candidato. No enumera parámetros analíticos concretos como umbral clínico, solo como disparador léxico de que el texto contiene una analítica. */
export const LAB_TRIGGER = /anal[ií]tica|hemograma|bioqu[ií]mica|gasometr[ií]a|procalcitonina|\bPCR\b|leucocitos|creatinina|\bVSG\b/i;

/** Procedimiento respiratorio explícito — independiente de "ingreso"/"hospitalización", para no perder un procedimiento ambulatorio. */
export const PROCEDURE_TRIGGER = /broncoscopia|toracocentesis|biopsia(\s*(pulmonar|transbronquial))?|drenaje\s*pleural|colocaci[oó]n\s*de\s*(cat[eé]ter|drenaje)/i;
