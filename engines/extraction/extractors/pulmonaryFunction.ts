/**
 * Extractor de función pulmonar — aplicado a UN SEGMENTO (nunca al
 * documento completo), con un fragmento (`rawText`) acotado a las
 * frases que realmente traen estos datos (ver
 * captureFragmentSpanningMarkers).
 *
 * Extracción por CLÁUSULA: en vez de buscar cada dato (litros, %,
 * z-score) con un único regex sobre todo el segmento — lo que fallaba
 * en cuanto el valor absoluto se interponía entre la etiqueta y su %
 * predicho, p. ej. "FEV1 1,58 L (62%)" — primero se localizan las
 * etiquetas (FEV1, FVC, FEV1/FVC, DLCO) y se recorta el texto entre
 * cada etiqueta y la siguiente (o el fin de línea/segmento) como su
 * propia cláusula. Dentro de esa cláusula, ya acotada a un único
 * parámetro, litros/%/z-score se buscan sin restricción de huecos —
 * el orden valor→% o %→valor deja de importar, y "FEV1" nunca puede
 * leer accidentalmente el % de "FVC" ni viceversa.
 */
import { captureFragmentSpanningMarkers } from "../fragment";
import type { PulmonaryFunctionEvent } from "@/types/clinicalEvent";
import type { ClinicalEventPayload } from "@/types/clinicalEvent";

export interface PftExtraction {
  payload: ClinicalEventPayload<PulmonaryFunctionEvent>;
  fragment: string;
}

const PFT_MARKERS = [/FEV1(?!\s*\/\s*FVC)/i, /(?<!FEV1\s*\/\s*)FVC\b/i, /FEV1\s*\/\s*FVC/i, /DLCO/i];

type LabelType = "fev1" | "fvc" | "ratio" | "dlco";

interface LabelMatch {
  type: LabelType;
  start: number;
  end: number;
}

/**
 * Localiza las etiquetas del segmento en orden de aparición. El
 * cociente ("FEV1/FVC", "FEV1 / FVC", "Cociente FEV1/FVC") se busca
 * primero para poder excluir su rango: sin eso, el propio "FEV1" (y el
 * "FVC") dentro de "FEV1/FVC" se detectarían también como etiquetas
 * sueltas.
 */
function findLabelMatches(text: string): LabelMatch[] {
  const matches: LabelMatch[] = [];
  const ratioRanges: Array<[number, number]> = [];

  const ratioRe = /(?:cociente\s+)?FEV1\s*\/\s*FVC/gi;
  let m: RegExpExecArray | null;
  while ((m = ratioRe.exec(text))) {
    matches.push({ type: "ratio", start: m.index, end: m.index + m[0].length });
    ratioRanges.push([m.index, m.index + m[0].length]);
  }
  const insideRatio = (i: number) => ratioRanges.some(([s, e]) => i >= s && i < e);

  const fev1Re = /FEV1\b/gi;
  while ((m = fev1Re.exec(text))) {
    if (insideRatio(m.index)) continue;
    matches.push({ type: "fev1", start: m.index, end: m.index + m[0].length });
  }
  const fvcRe = /FVC\b/gi;
  while ((m = fvcRe.exec(text))) {
    if (insideRatio(m.index)) continue;
    matches.push({ type: "fvc", start: m.index, end: m.index + m[0].length });
  }
  const dlcoRe = /DLCO\b/gi;
  while ((m = dlcoRe.exec(text))) {
    matches.push({ type: "dlco", start: m.index, end: m.index + m[0].length });
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

/** Texto entre el final de una etiqueta y la siguiente etiqueta, un salto de línea, o el fin del segmento — lo que llegue antes. */
function clauseFor(text: string, matches: LabelMatch[], idx: number): string {
  const current = matches[idx];
  const next = matches[idx + 1];
  let end = next ? next.start : text.length;
  const newline = text.indexOf("\n", current.end);
  if (newline !== -1 && newline < end) end = newline;
  return text.slice(current.end, end);
}

function extractLiters(clause: string): number | null {
  const m = clause.match(/(\d+(?:[.,]\d+)?)\s*L\b/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

function extractPercent(clause: string): number | null {
  const m = clause.match(/(\d{1,3})\s*%/);
  return m ? parseInt(m[1], 10) : null;
}

// z-score — dato longitudinal que se conserva y se muestra tal cual, nunca interpretado con un umbral nuevo (ver domain/pft.ts).
function extractZScore(clause: string): number | null {
  const m = clause.match(/z[-\s]?score[:\s]*(-?\d+(?:[.,]\d+)?)/i);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

export function extractPulmonaryFunction(segmentText: string): PftExtraction | null {
  const matches = findLabelMatches(segmentText);
  if (!matches.length) return null;

  let fev1L: number | null = null;
  let fev1P: number | null = null;
  let fev1Z: number | null = null;
  let fvcL: number | null = null;
  let fvcP: number | null = null;
  let fvcZ: number | null = null;
  let ratioP: number | null = null;
  let ratioZ: number | null = null;
  let dlcoP: number | null = null;

  matches.forEach((match, idx) => {
    const clause = clauseFor(segmentText, matches, idx);
    switch (match.type) {
      case "fev1":
        fev1L ??= extractLiters(clause);
        fev1P ??= extractPercent(clause);
        fev1Z ??= extractZScore(clause);
        break;
      case "fvc":
        fvcL ??= extractLiters(clause);
        fvcP ??= extractPercent(clause);
        fvcZ ??= extractZScore(clause);
        break;
      case "ratio":
        ratioP ??= extractPercent(clause);
        ratioZ ??= extractZScore(clause);
        break;
      case "dlco":
        dlcoP ??= extractPercent(clause);
        break;
    }
  });

  if (fev1L == null && fev1P == null && fev1Z == null && fvcL == null && fvcP == null && fvcZ == null && ratioP == null && ratioZ == null && dlcoP == null) {
    return null;
  }

  const fragment = captureFragmentSpanningMarkers(segmentText, PFT_MARKERS) ?? segmentText.trim();

  return {
    fragment,
    payload: {
      FEV1Liters: fev1L,
      FEV1Percent: fev1P,
      FEV1zScore: fev1Z,
      FVCLiters: fvcL,
      FVCPercent: fvcP,
      FVCzScore: fvcZ,
      FEV1FVCRatio: ratioP,
      FEV1FVCzScore: ratioZ,
      DLCOPercent: dlcoP,
    },
  };
}
