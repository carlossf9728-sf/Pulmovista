/**
 * classifySegment — capa 2 del pipeline (ver pipeline.ts). Decide qué
 * categoría(s) contiene un TextSegment ya delimitado por
 * segmentClinicalText.
 *
 * Un segmento con encabezado explícito (`headerCategory`) confía en ese
 * encabezado — es la señal más fuerte posible, no se vuelve a comprobar
 * con disparadores léxicos. Un segmento SIN encabezado (transición
 * temporal o texto sin estructura) se examina con los mismos
 * disparadores léxicos que ya usaba el motor antiguo (keywords.ts),
 * ahora acotados a este segmento — puede devolver VARIAS categorías
 * cuando el propio texto las mezcla de forma inseparable (p. ej. "Refiere
 * mayor disnea y se pauta ciprofloxacino" es a la vez narrativa de
 * consulta y una posible exacerbación). [] si no encaja en ninguna
 * (contenido sin clasificar, ver pipeline.ts).
 */
import { parseLabBlock } from "./labParameters";
import { hasConsultationNarrative } from "./consultationNarrative";
import { mentionsHospitalization } from "./negation";
import {
  EXACERBATION_EXPLICIT_TRIGGER,
  EXACERBATION_SOFT_SIGNS_TRIGGER,
  ANTIBIOTIC_MENTION_TRIGGER,
  EXERCISE_TEST_TRIGGER,
  IMAGING_TRIGGER,
  LAB_TRIGGER,
  NON_PHARMACOLOGICAL_TREATMENTS,
  ORGANISM_TRIGGER,
  PFT_TRIGGER,
  PROCEDURE_TRIGGER,
  TREATMENT_KEYWORDS,
} from "./keywords";
import type { SegmentCategory, TextSegment } from "./segmentPatterns";

/**
 * hasConsultationNarrative(text), pero cuando el propio segmento ya se
 * clasifica como exacerbación, ignora el solapamiento léxico entre
 * CONSULTATION_NARRATIVE_TRIGGER y EXACERBATION_SOFT_SIGNS_TRIGGER
 * ("aumento de expectoración", "empeoramiento respiratorio"...): esas
 * frases son la propia narrativa de la exacerbación, no una consulta
 * distinta, así que no deben por sí solas generar un segundo evento de
 * Consulta casi vacío con el mismo fragmento. Si tras descartarlas queda
 * alguna señal genuina de consulta (refiere, relata, revisión, se
 * mantiene estable...), sí se añade — el criterio del encargo sigue
 * siendo "Consulta nunca es el fallback genérico".
 */
function hasDistinctConsultationNarrative(text: string, exacerbationDetected: boolean): boolean {
  if (!hasConsultationNarrative(text)) return false;
  if (!exacerbationDetected) return true;
  const stripped = text
    .replace(new RegExp(EXACERBATION_EXPLICIT_TRIGGER.source, "gi"), " ")
    .replace(new RegExp(EXACERBATION_SOFT_SIGNS_TRIGGER.source, "gi"), " ");
  return hasConsultationNarrative(stripped);
}

function fallbackCategories(text: string): SegmentCategory[] {
  const categories: SegmentCategory[] = [];

  const explicitExac = EXACERBATION_EXPLICIT_TRIGGER.test(text);
  const softExac = EXACERBATION_SOFT_SIGNS_TRIGGER.test(text) && ANTIBIOTIC_MENTION_TRIGGER.test(text);
  const exacerbationDetected = explicitExac || softExac;

  if (hasDistinctConsultationNarrative(text, exacerbationDetected)) categories.push("consulta");
  if (PFT_TRIGGER.test(text)) categories.push("funcion_pulmonar");
  if (ORGANISM_TRIGGER.test(text) || /cultivo/i.test(text)) categories.push("microbiologia");
  if (parseLabBlock(text).parameters.length || LAB_TRIGGER.test(text)) categories.push("analitica");
  if (IMAGING_TRIGGER.test(text)) categories.push("radiologia");
  if (EXERCISE_TEST_TRIGGER.test(text)) categories.push("prueba_esfuerzo");
  if (PROCEDURE_TRIGGER.test(text)) categories.push("procedimiento");
  if (mentionsHospitalization(text)) categories.push("ingreso");
  if (TREATMENT_KEYWORDS.some((t) => new RegExp(t, "i").test(text)) || NON_PHARMACOLOGICAL_TREATMENTS.some((t) => t.pattern.test(text))) {
    categories.push("tratamiento");
  }

  if (exacerbationDetected) categories.push("exacerbacion");

  return categories;
}

/**
 * Un segmento con encabezado confía en él como categoría principal —
 * nunca se re-escanea con TODOS los disparadores léxicos (eso volvería
 * a mezclar categorías, justo lo que la segmentación evita). Tres
 * excepciones deliberadas y acotadas, porque el propio encargo las
 * describe como parte del mismo episodio de ingreso:
 *   - "Ingreso:" también puede traer la narrativa de la exacerbación que
 *     lo motiva (para poder abrir el episodio como ExacerbationEvent,
 *     el único contenedor que reconoce domain/episode.ts);
 *   - "Consulta:" puede traer esa misma narrativa cuando el texto real no
 *     usa un encabezado "Ingreso:" explícito (la segmentación fusiona la
 *     admisión con la consulta que la precede) — sin este chequeo, el
 *     episodio de ingreso real desaparece por completo dentro de una
 *     Consulta, en vez de duplicarse (ver hasDistinctConsultationNarrative
 *     para evitar el problema inverso: una Consulta casi vacía además de
 *     la exacerbación, cuando la única narrativa era la propia agudización);
 *   - "Alta:" también suele traer la medicación domiciliaria pautada —
 *     deliberadamente NUNCA se comprueba exacerbación aquí: "al alta"
 *     nunca abre un segundo episodio, solo cierra el que ya existe.
 * Ninguna otra combinación de encabezado + disparador se comprueba.
 */
export function classifySegment(segment: TextSegment): SegmentCategory[] {
  if (segment.headerCategory === "ingreso") {
    const categories: SegmentCategory[] = ["ingreso"];
    const explicitExac = EXACERBATION_EXPLICIT_TRIGGER.test(segment.text);
    const softExac = EXACERBATION_SOFT_SIGNS_TRIGGER.test(segment.text) && ANTIBIOTIC_MENTION_TRIGGER.test(segment.text);
    if (explicitExac || softExac) categories.push("exacerbacion");
    return categories;
  }
  if (segment.headerCategory === "consulta") {
    const explicitExac = EXACERBATION_EXPLICIT_TRIGGER.test(segment.text);
    const softExac = EXACERBATION_SOFT_SIGNS_TRIGGER.test(segment.text) && ANTIBIOTIC_MENTION_TRIGGER.test(segment.text);
    const exacerbationDetected = explicitExac || softExac;
    const categories: SegmentCategory[] = [];
    // Sin señal de exacerbación, un encabezado "Consulta:" confía en su propia categoría sin más
    // comprobación, igual que cualquier otro encabezado (nunca pierde, p. ej., una consulta de
    // solo constantes vitales sin verbo narrativo propio). Solo cuando SÍ hay señal de
    // exacerbación se aplica el mismo criterio de "narrativa distinta" que ya usa
    // fallbackCategories, para no generar una Consulta casi vacía además de la exacerbación.
    if (!exacerbationDetected || hasDistinctConsultationNarrative(segment.text, true)) categories.push("consulta");
    if (exacerbationDetected) categories.push("exacerbacion");
    return categories;
  }
  if (segment.headerCategory === "alta") {
    const categories: SegmentCategory[] = ["alta"];
    if (TREATMENT_KEYWORDS.some((t) => new RegExp(t, "i").test(segment.text))) categories.push("tratamiento");
    return categories;
  }
  if (segment.headerCategory) return [segment.headerCategory];
  return fallbackCategories(segment.text);
}
