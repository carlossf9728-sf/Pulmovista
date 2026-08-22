import type { ConfidenceLevel } from "./clinicalEvent";

/**
 * LongitudinalEngine — tipos de DETECCIÓN OBJETIVA (comparación de estado
 * entre dos fechas, contradicciones de datos). Deliberadamente no incluyen
 * interpretación ni recomendación clínica: esa capa vive en Sentinel /
 * Turning Points (hoy legacy) y, en el futuro, en GuidelineEngine.
 */

export type ChangeKind = "aumentado" | "disminuido" | "nuevo" | "desaparecido";

export interface ClinicalChange {
  label: string;
  from: string;
  to: string;
  kind: ChangeKind;
}

export interface ChangesSinceLastVisit {
  fromDate: string;
  toDate: string;
  changes: ClinicalChange[];
  unchanged: string[];
}

/** Detección objetiva de una discrepancia entre dos mediciones próximas en el tiempo. */
export interface DataContradiction {
  id: string;
  message: string;
  note: string;
}

/** Estado reconstruido de un paciente a una fecha dada (ver domain/selectors.ts#getStateAsOf). */
export interface PatientStateAsOf {
  fev1: number | null;
  fvc: number | null;
  dlco: number | null;
  organisms: Set<string>;
  exacCount: number;
  hospCumulative: number;
  activeTreatments: Set<string>;
}

export interface ExacerbationYearCount {
  year: number;
  count: number;
}

export interface TreatmentSummary {
  id: string;
  name: string;
  start: string;
  end: string | null;
  status: "Activo" | "Finalizado";
  category: "Soporte respiratorio" | "Farmacológico";
  confidence: ConfidenceLevel;
}
