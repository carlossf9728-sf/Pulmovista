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
 * Bug detectado durante la migración (heredado del prototipo original,
 * NO corregido aquí — ver instrucción de no inventar correcciones
 * clínicas por cuenta propia): el regex de dosis
 * `${drug}[^.]{0,6}(\d+\s?mg)` trunca dosis de dos o más dígitos a su
 * último dígito. El backtracking voraz de `[^.]{0,6}` consume todos los
 * dígitos de la dosis salvo el último antes de que el grupo `(\d+...)`
 * intente capturar, así que "azitromicina 250 mg" produce dose="0 mg" en
 * vez de "250 mg" (con dosis de 1 dígito, p. ej. "5 mg", sí funciona).
 * Ver tests/engines/extraction.test.ts, que fija este comportamiento
 * actual como regresión. Pendiente de revisión en la fase de guías.
 */
import { mkEvent, CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { ORGANISM_PATTERNS, RESPIRATORY_SUPPORT_KEYWORDS, TREATMENT_KEYWORDS } from "./keywords";
import type {
  ClinicalEvent,
  ExacerbationEvent,
  HospitalizationEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
  TreatmentStartedEvent,
  TreatmentStoppedEvent,
} from "@/types/clinicalEvent";

export function runExtractionEngine(text: string, date: string): ClinicalEvent[] {
  const events: ClinicalEvent[] = [];
  const common = { source: "extraction_simulated" as const, rawText: text };

  const fev1L = text.match(/FEV1[^\d]{0,10}(\d(?:[.,]\d+)?)\s?L/i);
  const fev1P = text.match(/FEV1[^\d%]{0,12}(\d{1,3})\s?%/i);
  const fvcP = text.match(/FVC[^\d%]{0,12}(\d{1,3})\s?%/i);
  const dlcoP = text.match(/DLCO[^\d%]{0,12}(\d{1,3})\s?%/i);
  if (fev1L || fev1P || fvcP || dlcoP) {
    events.push(
      mkEvent<PulmonaryFunctionEvent>(
        null,
        CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION,
        date,
        {
          FEV1Liters: fev1L ? parseFloat(fev1L[1].replace(",", ".")) : null,
          FEV1Percent: fev1P ? parseInt(fev1P[1], 10) : null,
          FVCPercent: fvcP ? parseInt(fvcP[1], 10) : null,
          DLCOPercent: dlcoP ? parseInt(dlcoP[1], 10) : null,
        },
        { ...common, confidence: "confirmado" },
      ),
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
      const doseMatch = text.match(new RegExp(`${t}[^.]{0,6}(\\d+\\s?mg)`, "i"));
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
