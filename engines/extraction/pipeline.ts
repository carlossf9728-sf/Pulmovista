/**
 * Pipeline de extracción — capas 3 y 4 del encargo (ver segment.ts y
 * classify.ts para las capas 1 y 2):
 *
 *   segmentClinicalText → classifySegment → (extractores por categoría,
 *   uno por archivo en ./extractors/) → ClinicalEvent[] con su
 *   `rawText` acotado al fragmento real que lo justifica.
 *
 * Vinculación de episodios (episodeId): cuando un segmento produce una
 * ExacerbationEvent con `hospitalization: true`, esa es la única forma
 * de contenedor de episodio que reconoce domain/episode.ts — se
 * convierte en el episodio activo y su propio `id` se usa como
 * `episodeId` compartido. Todo evento de los segmentos siguientes
 * (microbiología, analítica, radiología, tratamientos, soporte
 * respiratorio...) se enlaza a ese mismo `episodeId` SIN copiar
 * contenido — hasta que una transición temporal que cierra episodio
 * (ver TEMPORAL_TRANSITIONS `resetsEpisode` en segmentPatterns.ts)
 * indica que el texto ha pasado a un encuentro distinto.
 *
 * Un episodio clínico real = un único ExacerbationEvent principal:
 * mientras `currentEpisodeId` siga abierto (`continuesOpenEpisode`, ver
 * más abajo), ningún segmento posterior puede generar OTRO
 * ExacerbationEvent ni un HospitalizationEvent de respaldo, por mucho
 * que su texto vuelva a mencionar la agudización o el ingreso ("durante
 * el ingreso...", "al alta... tras N días de ingreso") — solo un
 * procedimiento explícito (broncoscopia, toracocentesis...) sigue
 * generando su propio HospitalizationEvent dentro del episodio, porque
 * es un dato distinto, no una repetición del ingreso en sí.
 *
 * Antecedentes agregados ("2 exacerbaciones... en el último año", "sin
 * ingresos previos") nunca abren ni cierran episodio ni generan un
 * ExacerbationEvent fechado — ver AGGREGATE_EXACERBATION_HISTORY_TRIGGER
 * en keywords.ts y la negación en negation.ts.
 *
 * Contenido sin clasificar: un segmento sin encabezado cuyo texto no
 * activa ningún disparador conocido (`classifySegment` devuelve [])
 * NUNCA se convierte en una Consulta de relleno — se conserva tal cual
 * en `unclassifiedSegments` para que la revisión lo muestre como
 * "Contenido no clasificado" en vez de descartarlo.
 */
import { mkEvent, CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { segmentClinicalText } from "./segment";
import { classifySegment } from "./classify";
import { resolveSegmentDates } from "./resolveDates";
import { extractConsultation } from "./extractors/consultation";
import { extractPulmonaryFunction } from "./extractors/pulmonaryFunction";
import { extractMicrobiology } from "./extractors/microbiology";
import { extractLabResults } from "./extractors/labResults";
import { extractImaging } from "./extractors/imaging";
import { extractExerciseTest } from "./extractors/exerciseTest";
import { extractExacerbation } from "./extractors/exacerbation";
import { extractProcedure, extractHospitalizationFallback } from "./extractors/hospitalization";
import { extractTreatments } from "./extractors/treatments";
import type { SegmentCategory, TextSegment } from "./segmentPatterns";
import type {
  ClinicalEvent,
  ConsultationEvent,
  ExacerbationEvent,
  ExerciseTestEvent,
  HospitalizationEvent,
  ImagingEvent,
  LabResultsEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
  TreatmentStartedEvent,
  TreatmentStoppedEvent,
} from "@/types/clinicalEvent";
import type { ConfidenceLevel } from "@/types/clinicalEvent";

export interface ExtractionPipelineResult {
  events: ClinicalEvent[];
  /** Fragmentos que no pudieron clasificarse en ninguna categoría reconocida — se conservan tal cual para revisión, nunca se descartan ni se convierten en una Consulta de relleno. */
  unclassifiedSegments: string[];
}

/** Orden de procesamiento DENTRO de un mismo segmento — exacerbación/ingreso van primero para que el episodio quede abierto antes de que el resto de categorías del mismo segmento se enlacen a él. */
const CATEGORY_PRIORITY: SegmentCategory[] = [
  "exacerbacion",
  "ingreso",
  "procedimiento",
  "consulta",
  "funcion_pulmonar",
  "microbiologia",
  "analitica",
  "radiologia",
  "prueba_esfuerzo",
  "tratamiento",
  "alta",
  "otro",
];

function sortByPriority(categories: SegmentCategory[]): SegmentCategory[] {
  return [...categories].sort((a, b) => CATEGORY_PRIORITY.indexOf(a) - CATEGORY_PRIORITY.indexOf(b));
}

type ConfidenceFields = { confidence: ConfidenceLevel; confidenceReason: string | null };

/** Combina dos motivos de revisión sin que uno tape al otro: si ambos rebajan la confianza, se quedan los dos motivos concatenados; "confirmado" nunca gana sobre una rebaja real. */
function combineConfidence(primary: ConfidenceFields, extra: ConfidenceFields | null): ConfidenceFields {
  if (!extra) return primary;
  if (primary.confidence === "confirmado") return extra;
  if (extra.confidence === "confirmado") return primary;
  return { confidence: primary.confidence, confidenceReason: [primary.confidenceReason, extra.confidenceReason].filter(Boolean).join(" ") };
}

export function runExtractionPipeline(text: string, date: string): ExtractionPipelineResult {
  const segments = segmentClinicalText(text);
  const resolvedDates = resolveSegmentDates(segments, date);
  const events: ClinicalEvent[] = [];
  const unclassifiedSegments: string[] = [];
  let currentEpisodeId: string | null = null;

  segments.forEach((segment, segmentIndex) => {
    // Una transición temporal que cierra episodio siempre lo cierra, aunque este segmento en concreto no abra uno nuevo.
    if (segment.startsNewEpisode) currentEpisodeId = null;
    // Ya hay un episodio de ingreso abierto (ver arriba) Y este segmento no lo cierra: cualquier
    // frase posterior que vuelva a mencionar la agudización ("durante el ingreso...", una recaída
    // repetida en la nota de alta) sigue perteneciendo al MISMO episodio — un episodio clínico
    // real es un único ExacerbationEvent, nunca uno nuevo por cada frase que lo menciona de nuevo.
    const continuesOpenEpisode = currentEpisodeId != null;

    const categories = classifySegment(segment);
    if (!categories.length) {
      unclassifiedSegments.push(segment.text);
      return;
    }

    const resolved = resolvedDates[segmentIndex];
    const segmentDate = resolved.date;

    const isHeader = segment.headerCategory != null;
    // Sin encabezado ni transición que delimite el segmento, y mezclando varias categorías a la vez:
    // la frontera entre lo que pertenece a cada evento es menos segura — se marca para revisión.
    const uncertain = !isHeader && !segment.temporalLabel && categories.length > 1;
    const baseConfidence: ConfidenceFields = uncertain
      ? {
          confidence: "probable",
          confidenceReason: "Este fragmento mezcla varias categorías sin un encabezado o transición temporal que las delimite con claridad — revisar antes de guardar.",
        }
      : { confidence: "confirmado", confidenceReason: null };
    // Una fecha "unresolved" nunca debe parecer una fecha clínica fiable — se marca para revisión igual que
    // cualquier otro motivo de baja confianza, sin tapar un motivo ya existente (ver combineConfidence).
    const dateConfidence: ConfidenceFields | null =
      resolved.datePrecision === "unresolved"
        ? {
            confidence: "probable",
            confidenceReason: `No se ha podido resolver con seguridad la fecha de la expresión temporal "${resolved.temporalExpression}" — se conserva la última fecha conocida como referencia técnica, revisar antes de confirmar.`,
          }
        : null;
    const fallbackConfidence = combineConfidence(baseConfidence, dateConfidence);

    let exacerbationHandledHospitalization = false;
    const common = {
      source: "extraction_simulated" as const,
      datePrecision: resolved.datePrecision,
      dateSource: resolved.dateSource,
      temporalExpression: resolved.temporalExpression,
    };

    for (const category of sortByPriority(categories)) {
      switch (category) {
        case "exacerbacion": {
          const r = extractExacerbation(segment.text);
          if (!r) break;
          if (continuesOpenEpisode) break; // ver continuesOpenEpisode arriba: mismo episodio ya abierto, nunca un segundo ExacerbationEvent
          const specific = r.confidence === "posible" ? combineConfidence({ confidence: "posible", confidenceReason: r.confidenceReason }, dateConfidence) : fallbackConfidence;
          const exac: ExacerbationEvent = mkEvent<ExacerbationEvent>(
            null,
            CLINICAL_EVENT_TYPES.EXACERBATION,
            segmentDate,
            { severity: r.severity, hospitalization: r.hospitalization },
            { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...specific },
          );
          if (r.hospitalization) {
            currentEpisodeId = exac.id;
            exac.episodeId = exac.id;
            exacerbationHandledHospitalization = true;
          }
          events.push(exac);
          break;
        }
        case "ingreso": {
          const proc = extractProcedure(segment.text);
          if (proc) {
            events.push(mkEvent<HospitalizationEvent>(null, CLINICAL_EVENT_TYPES.HOSPITALIZATION, segmentDate, { procedureLabel: proc.procedureLabel }, { ...common, rawText: proc.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
          }
          // continuesOpenEpisode: una mención de ingreso en una frase posterior del MISMO episodio
          // ya abierto (p. ej. "al alta... tras 7 días de ingreso") no es un segundo ingreso — nunca
          // genera un HospitalizationEvent duplicado del contenedor que ya existe.
          if (!exacerbationHandledHospitalization && !continuesOpenEpisode) {
            const hosp = extractHospitalizationFallback(segment.text);
            if (hosp) {
              events.push(mkEvent<HospitalizationEvent>(null, CLINICAL_EVENT_TYPES.HOSPITALIZATION, segmentDate, {}, { ...common, rawText: hosp.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
            }
          }
          break;
        }
        case "procedimiento": {
          const r = extractProcedure(segment.text);
          if (r) events.push(mkEvent<HospitalizationEvent>(null, CLINICAL_EVENT_TYPES.HOSPITALIZATION, segmentDate, { procedureLabel: r.procedureLabel }, { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
          break;
        }
        case "consulta":
        case "alta": {
          const r = extractConsultation(segment.text, isHeader);
          if (r) events.push(mkEvent<ConsultationEvent>(null, CLINICAL_EVENT_TYPES.CONSULTATION, segmentDate, r.vitals, { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
          break;
        }
        case "funcion_pulmonar": {
          const r = extractPulmonaryFunction(segment.text);
          if (r) events.push(mkEvent<PulmonaryFunctionEvent>(null, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, segmentDate, r.payload, { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
          break;
        }
        case "microbiologia": {
          for (const r of extractMicrobiology(segment.text)) {
            events.push(
              mkEvent<MicrobiologyEvent>(
                null,
                CLINICAL_EVENT_TYPES.MICROBIOLOGY,
                segmentDate,
                { sampleType: r.sampleType, organism: r.organism, sensitivity: r.sensitivity, resistance: r.resistance },
                { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence },
              ),
            );
          }
          break;
        }
        case "analitica": {
          const r = extractLabResults(segment.text, isHeader);
          if (r) {
            const specific = r.unparsedLines.length
              ? combineConfidence(
                  {
                    confidence: "dato incompleto",
                    confidenceReason: `${r.unparsedLines.length} línea(s) del bloque no se pudieron interpretar con seguridad y se conservan en texto libre para revisión.`,
                  },
                  dateConfidence,
                )
              : fallbackConfidence;
            events.push(
              mkEvent<LabResultsEvent>(
                null,
                CLINICAL_EVENT_TYPES.LAB_RESULTS,
                segmentDate,
                { label: "Analítica", text: r.fragment, parameters: r.parameters.length ? r.parameters : null, unparsedLines: r.unparsedLines.length ? r.unparsedLines : null },
                { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...specific },
              ),
            );
          }
          break;
        }
        case "radiologia": {
          const r = extractImaging(segment.text, isHeader);
          if (r) events.push(mkEvent<ImagingEvent>(null, CLINICAL_EVENT_TYPES.IMAGING, segmentDate, { label: r.label, text: r.fragment }, { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
          break;
        }
        case "prueba_esfuerzo": {
          const r = extractExerciseTest(segment.text, isHeader);
          if (r) events.push(mkEvent<ExerciseTestEvent>(null, CLINICAL_EVENT_TYPES.EXERCISE_TEST, segmentDate, { label: r.label, text: r.fragment }, { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
          break;
        }
        case "tratamiento": {
          for (const r of extractTreatments(segment.text)) {
            if (r.kind === "started") {
              events.push(
                mkEvent<TreatmentStartedEvent | RespiratorySupportEvent>(
                  null,
                  r.isRespiratorySupport ? CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT : CLINICAL_EVENT_TYPES.TREATMENT_STARTED,
                  segmentDate,
                  { drug: r.drug, dose: r.dose, schedule: r.schedule, frequency: r.frequency, duration: r.duration, changeNote: r.changeNote },
                  { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence },
                ),
              );
            } else {
              events.push(mkEvent<TreatmentStoppedEvent>(null, CLINICAL_EVENT_TYPES.TREATMENT_STOPPED, segmentDate, { drug: r.drug }, { ...common, rawText: r.fragment, episodeId: currentEpisodeId, ...fallbackConfidence }));
            }
          }
          break;
        }
        case "otro":
          break;
      }
    }
  });

  return { events, unclassifiedSegments };
}

export type { SegmentCategory, TextSegment };
