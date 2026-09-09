/**
 * ExtractionEngine — SIMULADO.
 * ----------------------------------------------------------------------
 * Punto de entrada público del pipeline de extracción:
 *
 *   segmentClinicalText → classifySegment → extractores por categoría
 *   → ClinicalEvent[] (ver pipeline.ts para el detalle completo y
 *   segment.ts/classify.ts para las dos primeras capas).
 *
 * *** Punto de integración futuro: sustituir el cuerpo del pipeline por
 * una llamada a un LLM/NLP real que devuelva el mismo
 * ExtractionPipelineResult. ***
 *
 * `runExtractionEngine` y `buildCandidateEvents` son ahora la MISMA
 * función (antes `buildCandidateEvents` anteponía una Consulta calculada
 * sobre el documento completo; con el pipeline, la Consulta es una
 * categoría más que cada segmento resuelve por sí mismo, así que ya no
 * hace falta ese paso aparte) — se conservan los dos nombres por
 * compatibilidad con el código y los tests existentes que los usan.
 *
 * `buildClinicalCandidates` es la función nueva que además expone los
 * fragmentos sin clasificar (ver types de ExtractionPipelineResult en
 * pipeline.ts) para que la revisión pueda mostrarlos — AddClinicalInfoModal
 * y NewPatientModal deben usar esta en vez de buildCandidateEvents.
 *
 * Limitación conocida (no corregida — es del prototipo original): todos
 * los eventos detectados en un mismo texto se fechan con la fecha de la
 * consulta; no se interpretan fechas relativas ("en febrero", "en enero
 * de 2025") mencionadas dentro del propio texto.
 */
import { runExtractionPipeline } from "./pipeline";
import type { ExtractionPipelineResult } from "./pipeline";
import type { ClinicalEvent } from "@/types/clinicalEvent";

export { hasConsultationNarrative } from "./consultationNarrative";
export { segmentClinicalText } from "./segment";
export { classifySegment } from "./classify";
export type { SegmentCategory, TextSegment } from "./segmentPatterns";
export type { ExtractionPipelineResult } from "./pipeline";

/** Resultado completo del pipeline, incluidos los fragmentos sin clasificar — ver ExtractionPipelineResult. */
export function buildClinicalCandidates(text: string, date: string): ExtractionPipelineResult {
  return runExtractionPipeline(text, date);
}

export function runExtractionEngine(text: string, date: string): ClinicalEvent[] {
  return runExtractionPipeline(text, date).events;
}

export function buildCandidateEvents(text: string, date: string): ClinicalEvent[] {
  return runExtractionPipeline(text, date).events;
}
