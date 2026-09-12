import { captureFragment } from "../fragment";
import { captureHospitalizationFragment } from "../negation";
import { PROCEDURE_TRIGGER } from "../keywords";

export interface HospitalizationExtraction {
  procedureLabel: string | null;
  fragment: string;
}

/** Procedimiento respiratorio explícito (broncoscopia, toracocentesis...) — independiente de si el segmento también menciona "ingreso"/exacerbación, igual que en el motor monolítico. */
export function extractProcedure(segmentText: string): HospitalizationExtraction | null {
  const procedure = captureFragment(segmentText, PROCEDURE_TRIGGER);
  if (!procedure) return null;
  return { procedureLabel: procedure.label, fragment: procedure.fragment };
}

/**
 * Ingreso sin procedimiento identificado — solo se llama cuando el
 * segmento NO produjo ya una ExacerbationEvent y no continúa un episodio
 * de ingreso ya abierto (ver pipeline.ts): un ingreso mencionado junto a
 * una exacerbación explícita, o repetido en una frase posterior del
 * MISMO episodio ("al alta... tras N días de ingreso"), se cuenta una
 * sola vez. Negación-consciente (ver negation.ts): "sin ingresos
 * previos" nunca produce un HospitalizationEvent.
 */
export function extractHospitalizationFallback(segmentText: string): HospitalizationExtraction | null {
  const hosp = captureHospitalizationFragment(segmentText);
  if (!hosp) return null;
  return { procedureLabel: null, fragment: hosp.fragment };
}
