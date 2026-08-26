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
  /**
   * Identificador de episodio/visita, para agrupar en la Cronología
   * varios ClinicalEvent que pertenecen al mismo encuentro clínico —
   * ver domain/timeline.ts#episodeKeyForEvent, que cae a `date` cuando
   * falta, en vez de asumir que "mismo día" siempre significa "misma
   * visita". Ningún motor de extracción lo asigna todavía; el único uso
   * real hoy es manual, en datos demo, para vincular los subeventos de
   * un episodio de ingreso a su ExacerbationEvent contenedor (ver
   * domain/episode.ts) — un evento vinculado sigue siendo independiente
   * en su propio dominio (Microbiología, Radiología...), nunca una copia.
   */
  episodeId?: string | null;
}

export interface ConsultationEvent extends ClinicalEventBase {
  type: "consultation";
}

export interface PulmonaryFunctionEvent extends ClinicalEventBase {
  type: "pulmonary_function";
  FEV1Liters?: number | null;
  FEV1Percent?: number | null;
  /** Z-score de FEV1 (referencia GLI), cuando la prueba lo informa. No sustituye a FEV1Percent — se muestra junto a él, nunca en su lugar. */
  FEV1zScore?: number | null;
  FVCPercent?: number | null;
  FVCLiters?: number | null;
  /** Z-score de FVC, cuando la prueba lo informa. */
  FVCzScore?: number | null;
  /** Cociente FEV1/FVC medido, en %. Distinto de FEV1Percent/FVCPercent (que son cada volumen sobre su propio predicho). */
  FEV1FVCRatio?: number | null;
  /** Z-score del cociente FEV1/FVC, cuando la prueba lo informa. */
  FEV1FVCzScore?: number | null;
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
  /**
   * Campos de episodio de ingreso — solo tienen sentido cuando
   * `hospitalization` es true. Esta misma ExacerbationEvent actúa como
   * el episodio clínico contenedor (ver domain/episode.ts); se decidió
   * no usar el tipo `HospitalizationEvent` independiente para este rol
   * mientras no exista una estrategia de reconciliación con el conteo
   * potencialmente duplicado ya documentado en domain/selectors.ts.
   * Los subeventos del episodio (soporte respiratorio, pruebas,
   * tratamientos, diagnósticos) NO se guardan aquí — siguen siendo
   * ClinicalEvent independientes en su propio dominio, asociados solo
   * mediante el `episodeId` compartido (ClinicalEventBase), nunca
   * duplicados.
   */
  dischargeDate?: string | null;
  /** Destino al alta (domicilio, traslado, media estancia…), en texto libre y solo si consta explícitamente. */
  dischargeDisposition?: string | null;
  /** Motivo de ingreso, en texto libre. */
  admissionReason?: string | null;
  /** Evolución clínica durante el ingreso, en texto libre — no se categoriza (favorable/tórpida...) para no inventar un juicio clínico que el dato no autoriza. */
  clinicalCourse?: string | null;
  /** Situación clínica en el momento del alta, en texto libre. */
  dischargeStatus?: string | null;
  /** Recomendaciones / plan de seguimiento acordado al alta, en texto libre. */
  followUpPlan?: string | null;
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
 * Diagnóstico asociado a un momento/episodio concreto del historial —
 * distinto de `Patient.primaryDiagnosis`/`secondaryDiagnoses`, que son
 * el diagnóstico de base del paciente, no de un episodio. Mismo shape
 * mínimo que ImagingEvent/LabResultsEvent: un rótulo corto, sin inventar
 * una codificación (CIE-10 o similar) que el dato no trae.
 */
export interface DiagnosisEvent extends ClinicalEventBase {
  type: "diagnosis";
  label: string;
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
