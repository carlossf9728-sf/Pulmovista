/**
 * Consulta/evolución — NUNCA el fallback general. Solo produce un
 * candidato cuando el segmento trae narrativa clínica real
 * (hasConsultationNarrative: motivo de consulta, síntomas, evolución,
 * impresión clínica...).
 *
 * Fragmento: un segmento con encabezado explícito ("Consulta:"/"Alta:")
 * usa el segmento completo — ya está delimitado por segmentClinicalText,
 * así que no puede traer analítica, microbiología, PFR, radiología ni
 * tratamientos de otra sección. Sin encabezado (narrativa mezclada con
 * datos objetivos en el mismo párrafo, el caso "texto sin encabezados"),
 * se acota a las frases que realmente contienen la narrativa O las
 * constantes vitales — captureFragmentSpanningAllMatches con ambos
 * disparadores, para no arrastrar el resto del párrafo cuando solo una
 * parte es narrativa real, pero SIN cortar antes de una frase de
 * constantes ("SatO₂ 91%, FR 22 rpm...") que no lleva ningún verbo
 * narrativo propio pero sigue perteneciendo al mismo relato de consulta.
 *
 * Las constantes vitales se extraen siempre del fragmento ya acotado
 * (nunca del segmento completo) y se devuelven como datos estructurados
 * además de quedar conservadas, tal cual, en ese mismo fragmento.
 */
import { captureFragmentSpanningAllMatches } from "../fragment";
import {
  AFEBRILE_PATTERN,
  BLOOD_PRESSURE_PATTERN,
  CONSULTATION_NARRATIVE_TRIGGER,
  HEART_RATE_PATTERN,
  HEMODYNAMICALLY_STABLE_PATTERN,
  OXYGEN_SATURATION_PATTERN,
  OXYGEN_THERAPY_PATTERN,
  RESPIRATORY_RATE_PATTERN,
  TEMPERATURE_PATTERN,
  VITAL_SIGNS_TRIGGERS,
} from "../keywords";
import { hasConsultationNarrative } from "../consultationNarrative";
import type { ClinicalEventPayload, ConsultationEvent } from "@/types/clinicalEvent";

export interface ConsultationExtraction {
  fragment: string;
  vitals: ClinicalEventPayload<ConsultationEvent>;
}

function extractVitalSigns(text: string): ClinicalEventPayload<ConsultationEvent> {
  const satO2 = text.match(OXYGEN_SATURATION_PATTERN);
  const fr = text.match(RESPIRATORY_RATE_PATTERN);
  const fc = text.match(HEART_RATE_PATTERN);
  const temperature = text.match(TEMPERATURE_PATTERN);
  const ta = text.match(BLOOD_PRESSURE_PATTERN);
  const oxygenTherapy = text.match(OXYGEN_THERAPY_PATTERN);

  return {
    oxygenSaturationPercent: satO2 ? parseInt(satO2[1], 10) : null,
    respiratoryRate: fr ? parseInt(fr[1], 10) : null,
    heartRate: fc ? parseInt(fc[1], 10) : null,
    temperatureCelsius: temperature ? parseFloat(temperature[1].replace(",", ".")) : null,
    bloodPressure: ta ? ta[1].trim() : null,
    oxygenTherapy: oxygenTherapy ? oxygenTherapy[0].trim() : null,
    afebrile: AFEBRILE_PATTERN.test(text) ? true : null,
    hemodynamicallyStable: HEMODYNAMICALLY_STABLE_PATTERN.test(text) ? true : null,
  };
}

export function extractConsultation(segmentText: string, isExplicitHeader: boolean): ConsultationExtraction | null {
  if (!hasConsultationNarrative(segmentText)) return null;
  if (isExplicitHeader) {
    return { fragment: segmentText.trim(), vitals: extractVitalSigns(segmentText) };
  }
  const fragment = captureFragmentSpanningAllMatches(segmentText, [CONSULTATION_NARRATIVE_TRIGGER, ...VITAL_SIGNS_TRIGGERS]) ?? segmentText.trim();
  return { fragment, vitals: extractVitalSigns(fragment) };
}
