/**
 * ExtractionEngine — SIMULADO.
 * ----------------------------------------------------------------------
 * Reglas simples (regex) sobre texto libre → ClinicalEvent[] candidatos.
 * *** Punto de integración futuro: sustituir el cuerpo de esta función
 * por una llamada a un LLM/NLP real que devuelva el mismo tipo de
 * objetos (ClinicalEvent[]). ***
 *
 * Limitación conocida (no corregida — es del prototipo original): todos
 * los eventos detectados en un mismo texto se fechan con la fecha de la
 * consulta; no se interpretan fechas relativas ("en febrero", "en enero
 * de 2025") mencionadas dentro del propio texto.
 *
 * Bug técnico corregido tras la migración (no clínico — ver
 * tests/engines/extraction.test.ts): el regex de dosis
 * `${drug}[^.]{0,6}(\d+\s?mg)` truncaba dosis de dos o más dígitos a su
 * último dígito ("azitromicina 250 mg" → dose="0 mg"). El backtracking
 * voraz de `[^.]{0,6}` consumía todos los dígitos de la dosis salvo el
 * último antes de que el grupo `(\d+...)` intentara capturar. Se
 * corrige haciendo perezoso el cuantificador (`[^.]{0,6}?`): así el
 * motor prueba primero el consumo mínimo de comodín, y `\d+` queda
 * alineado con el inicio real de la cifra. No cambia ninguna regla de
 * interpretación clínica, solo la extracción sintáctica del texto.
 */
import { mkEvent, CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import {
  CONSULTATION_NARRATIVE_TRIGGER,
  EXERCISE_TEST_TRIGGER,
  IMAGING_TRIGGER,
  LAB_TRIGGER,
  ORGANISM_PATTERNS,
  PROCEDURE_TRIGGER,
  RESPIRATORY_SUPPORT_KEYWORDS,
  TREATMENT_KEYWORDS,
} from "./keywords";
import { parseLabBlock } from "./labParameters";
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

/**
 * ¿El texto contiene narrativa clínica de consulta/evolución (motivo de
 * la visita, relato de síntomas, curso clínico)? Un texto que solo trae
 * datos objetivos (cultivo, TC, FEV1, analítica...) sin ninguna frase de
 * este tipo NO debe producir un evento de Consulta — ver
 * CONSULTATION_NARRATIVE_TRIGGER.
 */
export function hasConsultationNarrative(text: string): boolean {
  return CONSULTATION_NARRATIVE_TRIGGER.test(text);
}

/**
 * Punto único de decisión de "qué eventos candidatos produce este
 * texto" — usado tanto por AddClinicalInfoModal (añadir información a
 * un paciente existente) como por NewPatientModal (alta inicial), para
 * que los dos compartan exactamente el mismo criterio en vez de cada
 * uno decidir por su cuenta cuándo existe una Consulta. Regla única:
 * solo existe un evento clínico si el contenido permite identificarlo
 * — un texto vacío o sin ninguna categoría reconocible no produce
 * ningún evento, ni siquiera una Consulta de relleno. El motor nunca
 * inventa un evento "vacío" solo porque se está dando de alta un
 * expediente: la demografía del paciente (NewPatientModal) es
 * independiente de que haya ocurrido o no una consulta.
 */
export function buildCandidateEvents(text: string, date: string): ClinicalEvent[] {
  const extracted = runExtractionEngine(text, date);
  if (!hasConsultationNarrative(text)) return extracted;
  const consultation = mkEvent<ConsultationEvent>(null, CLINICAL_EVENT_TYPES.CONSULTATION, date, {}, { source: "manual", rawText: text });
  return [consultation, ...extracted];
}

/**
 * Captura la frase (hasta el siguiente punto, o el resto del texto si no
 * hay ninguno) que contiene la primera aparición de `trigger` — usada
 * para separar un informe de imagen o de laboratorio embebido en un
 * texto más largo, sin inventar contenido que el texto no tenga.
 */
function captureSentence(text: string, trigger: RegExp): { label: string; sentence: string } | null {
  const m = text.match(trigger);
  if (m == null || m.index == null) return null;
  const rest = text.slice(m.index);
  const end = rest.indexOf(".");
  const sentence = (end === -1 ? rest : rest.slice(0, end + 1)).trim();
  return { label: m[0].trim(), sentence };
}

export function runExtractionEngine(text: string, date: string): ClinicalEvent[] {
  const events: ClinicalEvent[] = [];
  const common = { source: "extraction_simulated" as const, rawText: text };

  // Negative lookahead/lookbehind evitan que "FEV1/FVC ..." se confunda con "FEV1 ..." o "FVC ..." sueltos (ver notas de fidelidad del regex de dosis, mismo principio).
  const fev1L = text.match(/FEV1(?!\/FVC)[^\d]{0,10}(\d(?:[.,]\d+)?)\s?L/i);
  const fev1P = text.match(/FEV1(?!\/FVC)[^\d%]{0,12}(\d{1,3})\s?%/i);
  const fvcP = text.match(/(?<!FEV1\/)FVC[^\d%]{0,12}(\d{1,3})\s?%/i);
  const dlcoP = text.match(/DLCO[^\d%]{0,12}(\d{1,3})\s?%/i);
  const fev1fvcRatio = text.match(/FEV1\/FVC[^\d%]{0,12}(\d{1,3})\s?%/i);
  // z-score — dato longitudinal que se conserva y se muestra tal cual, nunca interpretado con un umbral nuevo (ver domain/pft.ts).
  const fev1Z = text.match(/FEV1(?!\/FVC)[^\n]{0,20}z[-\s]?score[:\s]*(-?\d(?:[.,]\d+)?)/i);
  const fvcZ = text.match(/(?<!FEV1\/)FVC[^\n]{0,20}z[-\s]?score[:\s]*(-?\d(?:[.,]\d+)?)/i);
  const fev1fvcZ = text.match(/FEV1\/FVC[^\n]{0,20}z[-\s]?score[:\s]*(-?\d(?:[.,]\d+)?)/i);
  if (fev1L || fev1P || fvcP || dlcoP || fev1fvcRatio || fev1Z || fvcZ || fev1fvcZ) {
    events.push(
      mkEvent<PulmonaryFunctionEvent>(
        null,
        CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION,
        date,
        {
          FEV1Liters: fev1L ? parseFloat(fev1L[1].replace(",", ".")) : null,
          FEV1Percent: fev1P ? parseInt(fev1P[1], 10) : null,
          FEV1zScore: fev1Z ? parseFloat(fev1Z[1].replace(",", ".")) : null,
          FVCPercent: fvcP ? parseInt(fvcP[1], 10) : null,
          FVCzScore: fvcZ ? parseFloat(fvcZ[1].replace(",", ".")) : null,
          FEV1FVCRatio: fev1fvcRatio ? parseInt(fev1fvcRatio[1], 10) : null,
          FEV1FVCzScore: fev1fvcZ ? parseFloat(fev1fvcZ[1].replace(",", ".")) : null,
          DLCOPercent: dlcoP ? parseInt(dlcoP[1], 10) : null,
        },
        { ...common, confidence: "confirmado" },
      ),
    );
  }

  const imaging = captureSentence(text, IMAGING_TRIGGER);
  if (imaging) {
    events.push(
      mkEvent<ImagingEvent>(null, CLINICAL_EVENT_TYPES.IMAGING, date, { label: imaging.label, text: imaging.sentence }, { ...common, confidence: "confirmado" }),
    );
  }

  // Bloque de analítica pegado tal cual desde IANUS (líneas "Prefijo-Nombre valor unidad [rango] *") —
  // se prueba ANTES que la captura por frase de abajo, porque un bloque así no tiene puntos de frase
  // reales (los puntos son decimales) y captureSentence lo truncaría mal en el primer "11.1". Si el
  // bloque no aporta ningún parámetro estructurado (texto en prosa, sin líneas reconocibles), se cae
  // al comportamiento antiguo de capturar solo la frase que menciona la analítica.
  const labBlock = parseLabBlock(text);
  if (labBlock.parameters.length) {
    events.push(
      mkEvent<LabResultsEvent>(
        null,
        CLINICAL_EVENT_TYPES.LAB_RESULTS,
        date,
        { label: "Analítica", text, parameters: labBlock.parameters, unparsedLines: labBlock.unparsedLines.length ? labBlock.unparsedLines : null },
        {
          ...common,
          confidence: labBlock.unparsedLines.length ? "dato incompleto" : "confirmado",
          confidenceReason: labBlock.unparsedLines.length
            ? `${labBlock.unparsedLines.length} línea(s) del bloque no se pudieron interpretar con seguridad y se conservan en texto libre para revisión.`
            : null,
        },
      ),
    );
  } else {
    const lab = captureSentence(text, LAB_TRIGGER);
    if (lab) {
      events.push(
        mkEvent<LabResultsEvent>(null, CLINICAL_EVENT_TYPES.LAB_RESULTS, date, { label: "Analítica", text: lab.sentence }, { ...common, confidence: "confirmado" }),
      );
    }
  }

  const exerciseTest = captureSentence(text, EXERCISE_TEST_TRIGGER);
  if (exerciseTest) {
    events.push(
      mkEvent<ExerciseTestEvent>(
        null,
        CLINICAL_EVENT_TYPES.EXERCISE_TEST,
        date,
        { label: exerciseTest.label, text: exerciseTest.sentence },
        { ...common, confidence: "confirmado" },
      ),
    );
  }

  const procedure = text.match(PROCEDURE_TRIGGER);
  if (procedure) {
    events.push(
      mkEvent<HospitalizationEvent>(null, CLINICAL_EVENT_TYPES.HOSPITALIZATION, date, { procedureLabel: procedure[0] }, { ...common, confidence: "confirmado" }),
    );
  }

  ORGANISM_PATTERNS.forEach((o) => {
    const key = o.split(" ")[0];
    if (new RegExp(key, "i").test(text)) {
      const sensMatch = text.match(/sensible[^.]{0,80}/i);
      const resMatch = text.match(/resistente[^.]{0,80}/i);
      events.push(
        mkEvent<MicrobiologyEvent>(
          null,
          CLINICAL_EVENT_TYPES.MICROBIOLOGY,
          date,
          {
            sampleType: "Esputo",
            organism: o,
            sensitivity: sensMatch ? [sensMatch[0].replace(/sensible( a| únicamente a)?/i, "").trim()] : [],
            resistance: resMatch ? [resMatch[0].replace(/resistente( a)?/i, "").trim()] : [],
          },
          { ...common, confidence: "confirmado" },
        ),
      );
    }
  });

  const explicitExac = /exacerbaci[oó]n(es)?|agudizaci[oó]n(es)?/i.test(text);
  const softSigns = /(aumento de expectoraci[oó]n|mayor disnea|empeoramiento respiratorio)/i.test(text);
  const antibioticMention = /(antibi[oó]tico|ciprofloxacino|azitromicina|amoxicilina|ceftazidima|tobramicina|colistina)/i.test(
    text,
  );
  const hosp = /ingreso|hospitali/i.test(text);

  if (explicitExac) {
    events.push(
      mkEvent<ExacerbationEvent>(
        null,
        CLINICAL_EVENT_TYPES.EXACERBATION,
        date,
        { severity: hosp ? "Grave" : "No especificada", hospitalization: hosp },
        { ...common, confidence: "confirmado" },
      ),
    );
  } else if (softSigns && antibioticMention) {
    events.push(
      mkEvent<ExacerbationEvent>(
        null,
        CLINICAL_EVENT_TYPES.EXACERBATION,
        date,
        { severity: "No especificada", hospitalization: hosp },
        {
          ...common,
          confidence: "posible",
          confidenceReason:
            'El texto menciona signos de empeoramiento y tratamiento antibiótico, pero no utiliza explícitamente el término "exacerbación".',
        },
      ),
    );
  } else if (hosp) {
    events.push(
      mkEvent<HospitalizationEvent>(null, CLINICAL_EVENT_TYPES.HOSPITALIZATION, date, {}, { ...common, confidence: "confirmado" }),
    );
  }

  TREATMENT_KEYWORDS.forEach((t) => {
    if (new RegExp(t, "i").test(text)) {
      const started = new RegExp(`(inicia|se inicia|añade|comienza)[^.]{0,30}${t}`, "i").test(text);
      const stopped = new RegExp(`(retira|suspende|finaliza)[^.]{0,30}${t}`, "i").test(text);
      const doseMatch = text.match(new RegExp(`${t}[^.]{0,6}?(\\d+\\s?mg)`, "i"));
      const scheduleMatch = text.match(
        new RegExp(`${t}[^.]{0,40}(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)[^.]{0,30}`, "i"),
      );
      const isSupport = (RESPIRATORY_SUPPORT_KEYWORDS as readonly string[]).includes(t);
      if (started) {
        events.push(
          mkEvent<TreatmentStartedEvent | RespiratorySupportEvent>(
            null,
            isSupport ? CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT : CLINICAL_EVENT_TYPES.TREATMENT_STARTED,
            date,
            {
              drug: t,
              dose: doseMatch ? doseMatch[1] : null,
              schedule: scheduleMatch ? scheduleMatch[0].replace(t, "").trim() : null,
            },
            { ...common, confidence: "confirmado" },
          ),
        );
      } else if (stopped) {
        events.push(
          mkEvent<TreatmentStoppedEvent>(null, CLINICAL_EVENT_TYPES.TREATMENT_STOPPED, date, { drug: t }, { ...common, confidence: "confirmado" }),
        );
      }
    }
  });

  return events;
}
