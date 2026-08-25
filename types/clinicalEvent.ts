/**
 * ClinicalEvent — unidad atómica del historial longitudinal de un paciente.
 *
 * Todo evento comparte los campos de `ClinicalEventBase` y añade campos
 * específicos según `type` (unión discriminada). Refleja 1:1 la forma que
 * ya producía `mkEvent()` en el prototipo original.
 */

export type EventSource = "seed_demo" | "extraction_simulated" | "manual";

/**
 * Nivel de confianza del dato. NO es un juicio clínico: refleja cuánto se
 * apoya el dato en texto explícito frente a inferencia del motor de
 * extracción (hoy simulado).
 */
export type ConfidenceLevel =
  | "confirmado"
  | "probable"
  | "posible"
  | "dato incompleto"
  | "dato contradictorio";

export const CLINICAL_EVENT_TYPES = {
  CONSULTATION: "consultation",
  PULMONARY_FUNCTION: "pulmonary_function",
  MICROBIOLOGY: "microbiology",
  EXACERBATION: "exacerbation",
  HOSPITALIZATION: "hospitalization",
  TREATMENT_STARTED: "treatment_started",
  TREATMENT_STOPPED: "treatment_stopped",
  RESPIRATORY_SUPPORT: "respiratory_support",
  IMAGING: "imaging",
  LAB_RESULTS: "lab_results",
  DIAGNOSIS: "diagnosis",
} as const;

export interface ClinicalEventBase {
  id: string;
  /** null en eventos "borrador" producidos por ExtractionEngine antes de asociarse a un paciente. */
  patientId: string | null;
  /** Fecha ISO (yyyy-mm-dd). */
  date: string;
  source: EventSource;
  rawText: string | null;
  confidence: ConfidenceLevel;
  confidenceReason: string | null;
}

export interface ConsultationEvent extends ClinicalEventBase {
  type: "consultation";
}

export interface PulmonaryFunctionEvent extends ClinicalEventBase {
  type: "pulmonary_function";
  FEV1Liters?: number | null;
  FEV1Percent?: number | null;
  FVCPercent?: number | null;
  FVCLiters?: number | null;
  DLCOPercent?: number | null;
}

export interface MicrobiologyEvent extends ClinicalEventBase {
  type: "microbiology";
  sampleType: string;
  organism: string;
  sensitivity: string[];
  resistance: string[];
}

export interface ExacerbationEvent extends ClinicalEventBase {
  type: "exacerbation";
  severity: string;
  hospitalization: boolean;
  treatment?: string;
}

export interface HospitalizationEvent extends ClinicalEventBase {
  type: "hospitalization";
  /** Procedimiento asociado (p. ej. "broncoscopia", "toracocentesis"), cuando el texto lo menciona explícitamente. null en un ingreso sin procedimiento identificado. */
  procedureLabel?: string | null;
}

export interface TreatmentStartedEvent extends ClinicalEventBase {
  type: "treatment_started";
  drug: string;
  dose?: string | null;
  schedule?: string | null;
}

export interface RespiratorySupportEvent extends ClinicalEventBase {
  type: "respiratory_support";
  drug: string;
  dose?: string | null;
  schedule?: string | null;
}

export interface TreatmentStoppedEvent extends ClinicalEventBase {
  type: "treatment_stopped";
  drug: string;
}

export interface ImagingEvent extends ClinicalEventBase {
  type: "imaging";
  label: string;
  text: string;
}

/** Resultado de laboratorio (analítica) — mismo formato libre que ImagingEvent: un rótulo de la prueba y el fragmento de texto que la describe, sin inventar una estructura de panel analítico que el texto no da. */
export interface LabResultsEvent extends ClinicalEventBase {
  type: "lab_results";
  label: string;
  text: string;
}

/**
 * Declarado en el prototipo original pero nunca instanciado (ni por el
 * motor de extracción ni por los datos demo). Se conserva por paridad;
 * queda como tipo "vacío" hasta que se defina un uso real.
 */
export interface DiagnosisEvent extends ClinicalEventBase {
  type: "diagnosis";
}

export type ClinicalEvent =
  | ConsultationEvent
  | PulmonaryFunctionEvent
  | MicrobiologyEvent
  | ExacerbationEvent
  | HospitalizationEvent
  | TreatmentStartedEvent
  | RespiratorySupportEvent
  | TreatmentStoppedEvent
  | ImagingEvent
  | LabResultsEvent
  | DiagnosisEvent;

export type ClinicalEventType = ClinicalEvent["type"];

/** Payload específico de cada tipo de evento, sin los campos base. */
export type ClinicalEventPayload<T extends ClinicalEvent = ClinicalEvent> = Omit<
  T,
  keyof ClinicalEventBase | "type"
>;
