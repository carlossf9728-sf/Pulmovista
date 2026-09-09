import { captureFragment } from "../fragment";
import {
  ANTIBIOTIC_MENTION_TRIGGER,
  EXACERBATION_EXPLICIT_TRIGGER,
  EXACERBATION_SOFT_SIGNS_TRIGGER,
  HOSPITALIZATION_TRIGGER,
} from "../keywords";

export interface ExacerbationExtraction {
  severity: string;
  hospitalization: boolean;
  fragment: string;
  confidence: "confirmado" | "posible";
  confidenceReason: string | null;
}

/** null cuando el segmento no menciona una exacerbación explícita ni la combinación de signos + antibiótico que la sugiere. */
export function extractExacerbation(segmentText: string): ExacerbationExtraction | null {
  const explicit = captureFragment(segmentText, EXACERBATION_EXPLICIT_TRIGGER);
  const hosp = HOSPITALIZATION_TRIGGER.test(segmentText);

  if (explicit) {
    return { severity: hosp ? "Grave" : "No especificada", hospitalization: hosp, fragment: explicit.fragment, confidence: "confirmado", confidenceReason: null };
  }

  const softMatch = captureFragment(segmentText, EXACERBATION_SOFT_SIGNS_TRIGGER);
  if (softMatch && ANTIBIOTIC_MENTION_TRIGGER.test(segmentText)) {
    return {
      severity: "No especificada",
      hospitalization: hosp,
      fragment: softMatch.fragment,
      confidence: "posible",
      confidenceReason: 'El texto menciona signos de empeoramiento y tratamiento antibiótico, pero no utiliza explícitamente el término "exacerbación".',
    };
  }

  return null;
}
