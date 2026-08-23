/**
 * Tipos de trazabilidad clínica ("¿Por qué?").
 *
 * Objetivo de diseño (ver plan de migración, ajuste #6): cualquier mensaje
 * clínico —hoy producido por heurísticas legacy, mañana por
 * GuidelineEngine— debe poder enlazarse con:
 *
 *   dato del paciente → interpretación → recomendación → fuente
 *
 * Por eso ningún componente de UI debería aceptar solo texto plano para
 * estos mensajes: siempre se envuelven en `ClinicalExplanation`, con un
 * `source` tipado que indica de dónde viene la afirmación.
 */

export interface EvidenceItem {
  /** Línea legible que respalda un hallazgo, p. ej. "12/03/2024 — FEV1 78%". */
  label: string;
  /** Fecha ISO asociada, si la evidencia proviene de un evento fechado. */
  date?: string | null;
}

/**
 * Procedencia de una interpretación o recomendación clínica.
 *
 * - "legacy_heuristic": regla local del prototipo (Sentinel, Turning
 *   Points, Missing Info...), marcada explícitamente como experimental y
 *   pendiente de sustitución.
 * - "guideline": recomendación respaldada por una guía clínica real a
 *   través de GuidelineEngine. No se usa todavía en esta fase (GUIDELINES
 *   sigue siendo contenido simulado), pero el tipo ya está preparado.
 */
export type ClinicalSource =
  | { kind: "legacy_heuristic"; ruleId: string; label: string }
  | {
      kind: "guideline";
      guidelineId: string;
      recommendationId: string;
      society: string;
      year: number;
      section?: string | null;
      page?: number | null;
    };

export interface ClinicalExplanationSection {
  /** p. ej. "Dato", "Interpretación", "Recomendación", "Antes / Después". */
  label: string;
  /** Estilo visual de énfasis (primera sección del modal "¿Por qué?"). */
  emphasis?: boolean;
  text: string;
}

/**
 * Cita estructurada de guía (sociedad, año, sección, página, fragmento
 * textual original). Se muestra en WhyModal como un bloque de "Fuente"
 * visualmente diferenciado de las secciones de prosa — nunca como una
 * sección más — para que quede claro que ese texto es una cita literal
 * de la guía, no una síntesis de PulmoVista. `section`/`page` son null
 * cuando la guía no los declara con claridad (nunca se inventan).
 */
export interface ClinicalExplanationCitation {
  society: string;
  year: number;
  section: string | null;
  page: number | null;
  sourceText: string;
}

/** Contenido estructurado del modal "¿Por qué?". */
export interface ClinicalExplanation {
  kindLabel: "heurística experimental" | "guideline";
  source: ClinicalSource;
  sections: ClinicalExplanationSection[];
  evidence: EvidenceItem[];
  /** Presente solo cuando `source.kind === "guideline"` y hay una cita real que mostrar. */
  citation?: ClinicalExplanationCitation;
}
