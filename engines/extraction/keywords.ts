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

/** Menciona una prueba funcional de esfuerzo (marcha, ergometría, desaturación provocada) — dispara la detección de un ExerciseTestEvent candidato, distinto de la función pulmonar en reposo (PULMONARY_FUNCTION). */
export const EXERCISE_TEST_TRIGGER =
  /prueba\s*de\s*(esfuerzo|la\s*marcha|caminata)|test\s*de\s*(la\s*)?marcha|test\s*de\s*los?\s*6\s*minutos|6\s*mwt|6\s*minutos?\s*(de\s*)?marcha|ergometr[ií]a/i;

/**
 * Indica que el texto contiene narrativa clínica de consulta/evolución
 * (motivo de la visita, relato de síntomas, curso clínico) — no basta con
 * que el texto mencione un dato objetivo (cultivo, TC, FEV1...) para que
 * exista una "consulta": tiene que haber una frase que narre la visita o
 * la evolución del paciente. Deliberadamente léxico, como el resto de
 * disparadores de este archivo — no un analizador sintáctico.
 */
export const CONSULTATION_NARRATIVE_TRIGGER =
  /acude\s*(a\s*consulta|por)|consulta\s*de\s*(revisi[oó]n|seguimiento|control)|revisi[oó]n\s*(anual|cl[ií]nica|peri[oó]dica|de\s*\w+)|valoraci[oó]n\s*(inicial|en\s*la\s*unidad)|seguimiento\s*cl[ií]nico|primera\s*valoraci[oó]n|refiere|relata|manifiesta|cuenta\s*que|aumento\s*de\s*(disnea|expectoraci[oó]n|tos)|empeoramiento\s*(respiratorio|cl[ií]nico)|se\s*mantiene\s*(cl[ií]nicamente\s*)?estable|sin\s*cambios\s*cl[ií]nicos|evoluci[oó]n\s*(favorable|t[oó]rpida|cl[ií]nica)/i;
