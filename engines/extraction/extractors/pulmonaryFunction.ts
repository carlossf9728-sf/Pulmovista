/**
 * Extractor de función pulmonar — misma extracción numérica exacta que
 * tenía el motor monolítico (FEV1/FVC/DLCO/z-scores, con los mismos
 * lookahead/lookbehind para no confundir "FEV1/FVC" con "FEV1" o "FVC"
 * sueltos), ahora aplicada a UN SEGMENTO en vez de al documento
 * completo, y con un fragmento (`rawText`) acotado a las frases que
 * realmente traen estos datos — ver captureFragmentSpanningMarkers.
 */
import { captureFragmentSpanningMarkers } from "../fragment";
import type { PulmonaryFunctionEvent } from "@/types/clinicalEvent";
import type { ClinicalEventPayload } from "@/types/clinicalEvent";

export interface PftExtraction {
  payload: ClinicalEventPayload<PulmonaryFunctionEvent>;
  fragment: string;
}

const PFT_MARKERS = [/FEV1(?!\/FVC)/i, /(?<!FEV1\/)FVC\b/i, /FEV1\/FVC/i, /DLCO/i];

export function extractPulmonaryFunction(segmentText: string): PftExtraction | null {
  const fev1L = segmentText.match(/FEV1(?!\/FVC)[^\d]{0,10}(\d(?:[.,]\d+)?)\s?L/i);
  const fev1P = segmentText.match(/FEV1(?!\/FVC)[^\d%]{0,12}(\d{1,3})\s?%/i);
  const fvcP = segmentText.match(/(?<!FEV1\/)FVC[^\d%]{0,12}(\d{1,3})\s?%/i);
  const dlcoP = segmentText.match(/DLCO[^\d%]{0,12}(\d{1,3})\s?%/i);
  const fev1fvcRatio = segmentText.match(/FEV1\/FVC[^\d%]{0,12}(\d{1,3})\s?%/i);
  // z-score — dato longitudinal que se conserva y se muestra tal cual, nunca interpretado con un umbral nuevo (ver domain/pft.ts).
  const fev1Z = segmentText.match(/FEV1(?!\/FVC)[^\n]{0,20}z[-\s]?score[:\s]*(-?\d(?:[.,]\d+)?)/i);
  const fvcZ = segmentText.match(/(?<!FEV1\/)FVC[^\n]{0,20}z[-\s]?score[:\s]*(-?\d(?:[.,]\d+)?)/i);
  const fev1fvcZ = segmentText.match(/FEV1\/FVC[^\n]{0,20}z[-\s]?score[:\s]*(-?\d(?:[.,]\d+)?)/i);

  if (!fev1L && !fev1P && !fvcP && !dlcoP && !fev1fvcRatio && !fev1Z && !fvcZ && !fev1fvcZ) return null;

  const fragment = captureFragmentSpanningMarkers(segmentText, PFT_MARKERS) ?? segmentText.trim();

  return {
    fragment,
    payload: {
      FEV1Liters: fev1L ? parseFloat(fev1L[1].replace(",", ".")) : null,
      FEV1Percent: fev1P ? parseInt(fev1P[1], 10) : null,
      FEV1zScore: fev1Z ? parseFloat(fev1Z[1].replace(",", ".")) : null,
      FVCPercent: fvcP ? parseInt(fvcP[1], 10) : null,
      FVCzScore: fvcZ ? parseFloat(fvcZ[1].replace(",", ".")) : null,
      FEV1FVCRatio: fev1fvcRatio ? parseInt(fev1fvcRatio[1], 10) : null,
      FEV1FVCzScore: fev1fvcZ ? parseFloat(fev1fvcZ[1].replace(",", ".")) : null,
      DLCOPercent: dlcoP ? parseInt(dlcoP[1], 10) : null,
    },
  };
}
