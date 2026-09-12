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
  "ceftazidima",
  "prednisona",
  "corticoide oral",
  "oxígeno",
  "ventilación no invasiva",
  "nintedanib",
  "pirfenidona",
] as const;

export const RESPIRATORY_SUPPORT_KEYWORDS = ["oxígeno", "ventilación no invasiva"] as const;

/**
 * Terapias NO farmacológicas que el extractor de tratamientos reconoce
 * como su propio "fármaco" (drug) — mismo evento (TreatmentStartedEvent)
 * que un antibiótico, nunca confundido con uno: no se le busca dosis en
 * mg, y domain/selectors.ts (NON_PHARMACOLOGICAL_KEYWORDS) ya la
 * clasifica como "No farmacológico" en la pestaña Tratamientos por el
 * mismo criterio léxico. Cada entrada trae su propio patrón (no una
 * palabra suelta de TREATMENT_KEYWORDS) porque "fisioterapia" debe
 * reconocerse con o sin el calificativo "respiratoria".
 */
export const NON_PHARMACOLOGICAL_TREATMENTS = [{ pattern: /fisioterapia(\s+respiratoria)?/i }] as const;

/** Menciona una prueba de imagen torácica — dispara la detección de un ImagingEvent candidato. */
export const IMAGING_TRIGGER = /TC\s*(de\s*)?t[oó]rax|TAC(\s*tor[aá]cico)?|radiograf[ií]a(\s*(simple|de))?\s*(de\s*)?t[oó]rax|Rx\s*(de\s*)?t[oó]rax|ecograf[ií]a\s*tor[aá]cica/i;

/** Menciona una prueba de laboratorio — dispara la detección de un LabResultsEvent candidato. No enumera parámetros analíticos concretos como umbral clínico, solo como disparador léxico de que el texto contiene una analítica. */
export const LAB_TRIGGER = /anal[ií]tica|hemograma|bioqu[ií]mica|gasometr[ií]a|procalcitonina|\bPCR\b|leucocitos|creatinina|\bVSG\b/i;

/** Procedimiento respiratorio explícito — independiente de "ingreso"/"hospitalización", para no perder un procedimiento ambulatorio. */
export const PROCEDURE_TRIGGER = /broncoscopia|toracocentesis|biopsia(\s*(pulmonar|transbronquial))?|drenaje\s*pleural|colocaci[oó]n\s*de\s*(cat[eé]ter|drenaje)/i;

/** Menciona una prueba funcional de esfuerzo (marcha, ergometría, desaturación provocada) — dispara la detección de un ExerciseTestEvent candidato, distinto de la función pulmonar en reposo (PULMONARY_FUNCTION). */
export const EXERCISE_TEST_TRIGGER =
  /prueba\s*de\s*(esfuerzo|la\s*marcha|caminata)|test\s*de\s*(la\s*)?marcha|test\s*de\s*los?\s*6\s*minutos|6\s*mwt|6\s*minutos?\s*(de\s*)?marcha|ergometr[ií]a/i;

/** Menciona algún dato de función pulmonar en reposo (FEV1/FVC/DLCO) — disparador léxico para classifySegment, no repite los regex de extracción exacta (ver engines/extraction/extractors/pulmonaryFunction.ts). */
export const PFT_TRIGGER = /FEV1|FVC|DLCO/i;

/** Combina ORGANISM_PATTERNS en un único regex para classifySegment — la extracción real sigue recorriendo la lista completa (ver extractors/microbiology.ts) para no perder qué organismo concreto es. */
export const ORGANISM_TRIGGER = new RegExp(ORGANISM_PATTERNS.map((o) => o.split(" ")[0]).join("|"), "i");

export const EXACERBATION_EXPLICIT_TRIGGER = /exacerbaci[oó]n(es)?|agudizaci[oó]n(es)?/i;
export const EXACERBATION_SOFT_SIGNS_TRIGGER = /(aumento de expectoraci[oó]n|mayor disnea|empeoramiento respiratorio)/i;
export const ANTIBIOTIC_MENTION_TRIGGER = /(antibi[oó]tico|ciprofloxacino|azitromicina|amoxicilina|ceftazidima|tobramicina|colistina)/i;
export const HOSPITALIZATION_TRIGGER = /ingreso|hospitali/i;

/**
 * "2 exacerbaciones", "tres agudizaciones previas"... — un NÚMERO o
 * cuantificador ≥2 delante de exacerbación(es)/agudización(es) en PLURAL
 * es la señal de que la frase resume un histórico agregado de varios
 * episodios pasados, no describe un episodio nuevo y concreto ocurriendo
 * ahora (que se narraría como "una exacerbación"/"la exacerbación
 * actual", nunca como un recuento). "una exacerbación" (singular) nunca
 * coincide aquí a propósito: sigue pudiendo ser un episodio real. Ver
 * engines/extraction/extractors/exacerbation.ts — nunca genera un
 * ExacerbationEvent fechado a partir de una frase que coincide con esto.
 */
export const AGGREGATE_EXACERBATION_HISTORY_TRIGGER = /\b(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|varias|m[uú]ltiples)\s+(exacerbaciones|agudizaciones)\b/i;

/**
 * Cantidades en palabra (uno → ocho) — vocabulario ÚNICO compartido por
 * los módulos que necesitan reconocer un número escrito en letra, para
 * no mantener listas parciales y desincronizadas: antes, segmentPatterns.ts
 * solo reconocía "un/dos/tres meses después" como transición temporal
 * (una nota real con "seis meses después" ni siquiera se segmentaba como
 * un encuentro nuevo, fusionando en silencio dos episodios reales
 * distintos en un mismo segmento), mientras que extractAggregateExacerbationHistory
 * ya reconocía hasta "ocho" para el recuento agregado. Fuente única de
 * verdad para segmentPatterns.ts#TEMPORAL_TRANSITIONS, resolveDates.ts y
 * extractors/exacerbation.ts.
 */
export const SPANISH_NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8 };

/** Alternancia regex de las claves de SPANISH_NUMBER_WORDS, lista para insertar en un patrón mayor (ver TEMPORAL_TRANSITIONS/resolveDates.ts) — nunca se construye por separado en cada módulo. */
export const SPANISH_NUMBER_WORD_PATTERN = Object.keys(SPANISH_NUMBER_WORDS).join("|");

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

/**
 * Constantes vitales explícitas en la exploración de una consulta —
 * cada patrón exige su propia etiqueta (SatO2/FR/FC/Tª/TA) pegada a un
 * valor con forma plausible, nunca se infiere ninguna a partir de otro
 * dato. Se usan tanto para decidir hasta dónde llega el fragmento de la
 * consulta (una frase de constantes sin ningún verbo narrativo propio
 * no debe cortarse del resto del relato — ver extractors/consultation.ts)
 * como para la extracción estructurada en sí.
 */
export const OXYGEN_SATURATION_PATTERN = /sat\s*o[₂2]\s*[:\s]*(\d{1,3})\s*%/i;
export const RESPIRATORY_RATE_PATTERN = /(?:\bFR\b|frecuencia\s+respiratoria)\s*[:\s]*(\d{1,3})\s*(?:rpm|resp)?/i;
export const HEART_RATE_PATTERN = /(?:\bFC\b|frecuencia\s+card[ií]aca)\s*[:\s]*(\d{1,3})\s*(?:lpm|ppm)?/i;
/** Requiere "temperatura" o "Tª"/"Tº" (con el símbolo ordinal) — nunca "TA" sola, para no confundirse con tensión arterial. */
export const TEMPERATURE_PATTERN = /(?:temperatura|t[ªº])\s*[:\s]*(\d{2}(?:[.,]\d)?)\s*°?\s*c?\b/i;
export const BLOOD_PRESSURE_PATTERN = /\bTA\b\s*[:\s]*(\d{2,3}\s*\/\s*\d{2,3}(?:\s*mmHg)?)/i;
export const OXYGEN_THERAPY_PATTERN = /oxigenoterapia[^.,;]{0,40}|gafas\s*nasales[^.,;]{0,40}|mascarilla\s*(?:de\s*)?(?:reservorio|venturi)[^.,;]{0,40}/i;
export const AFEBRILE_PATTERN = /\bafebril\b/i;
export const HEMODYNAMICALLY_STABLE_PATTERN = /hemodin[aá]micamente\s*estable/i;

export const VITAL_SIGNS_TRIGGERS = [
  OXYGEN_SATURATION_PATTERN,
  RESPIRATORY_RATE_PATTERN,
  HEART_RATE_PATTERN,
  TEMPERATURE_PATTERN,
  BLOOD_PRESSURE_PATTERN,
  OXYGEN_THERAPY_PATTERN,
  AFEBRILE_PATTERN,
  HEMODYNAMICALLY_STABLE_PATTERN,
];
