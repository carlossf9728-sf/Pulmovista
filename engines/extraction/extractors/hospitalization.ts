import { captureFragment } from "../fragment";
import { HOSPITALIZATION_TRIGGER, PROCEDURE_TRIGGER } from "../keywords";

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
 * segmento NO produjo ya una ExacerbationEvent (ver pipeline.ts): un
 * ingreso mencionado junto a una exacerbación explícita se cuenta una
 * sola vez, como exacerbación grave con `hospitalization: true`.
 */
export function extractHospitalizationFallback(segmentText: string): HospitalizationExtraction | null {
  const hosp = captureFragment(segmentText, HOSPITALIZATION_TRIGGER);
  if (!hosp) return null;
  return { procedureLabel: null, fragment: hosp.fragment };
}
