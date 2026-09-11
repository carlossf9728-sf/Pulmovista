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
import {
  EXACERBATION_EXPLICIT_TRIGGER,
  EXACERBATION_SOFT_SIGNS_TRIGGER,
  ANTIBIOTIC_MENTION_TRIGGER,
  EXERCISE_TEST_TRIGGER,
  HOSPITALIZATION_TRIGGER,
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
  if (HOSPITALIZATION_TRIGGER.test(text)) categories.push("ingreso");
  if (TREATMENT_KEYWORDS.some((t) => new RegExp(t, "i").test(text)) || NON_PHARMACOLOGICAL_TREATMENTS.some((t) => t.pattern.test(text))) {
    categories.push("tratamiento");
  }

  if (exacerbationDetected) categories.push("exacerbacion");

  return categories;
}

/**
 * Un segmento con encabezado confía en él como categoría principal —
 * nunca se re-escanea con TODOS los disparadores léxicos (eso volvería
 * a mezclar categorías, justo lo que la segmentación evita). Solo dos
 * excepciones deliberadas y acotadas, porque el propio encargo las
 * describe como parte del mismo episodio de ingreso:
 *   - "Ingreso:" también puede traer la narrativa de la exacerbación que
 *     lo motiva (para poder abrir el episodio como ExacerbationEvent,
 *     el único contenedor que reconoce domain/episode.ts);
 *   - "Alta:" también suele traer la medicación domiciliaria pautada.
 * Ninguna otra combinación de encabezado + disparador se comprueba.
 */
export function classifySegment(segment: TextSegment): SegmentCategory[] {
  if (segment.headerCategory) {
    const categories: SegmentCategory[] = [segment.headerCategory];
    if (segment.headerCategory === "ingreso") {
      const explicitExac = EXACERBATION_EXPLICIT_TRIGGER.test(segment.text);
      const softExac = EXACERBATION_SOFT_SIGNS_TRIGGER.test(segment.text) && ANTIBIOTIC_MENTION_TRIGGER.test(segment.text);
      if (explicitExac || softExac) categories.push("exacerbacion");
    }
    if (segment.headerCategory === "alta" && TREATMENT_KEYWORDS.some((t) => new RegExp(t, "i").test(segment.text))) {
      categories.push("tratamiento");
    }
    return categories;
  }
  return fallbackCategories(segment.text);
}
