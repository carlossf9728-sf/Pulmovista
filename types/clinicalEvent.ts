/**
 * ClinicalEvent — unidad atómica del historial longitudinal de un paciente.
 *
 * Todo evento comparte los campos de `ClinicalEventBase` y añade campos
 * específicos según `type` (unión discriminada). Refleja 1:1 la forma que
 * ya producía `mkEvent()` en el prototipo original.
 */

export type EventSource = "seed_demo" | "extraction_simulated" | "manual";

/**
 * Cuán fiable es `date` como fecha clínica real — independiente de
 * `confidence` (que mide el dato clínico en sí, no cuándo ocurrió).
 *
 * - "documented": el propio texto la declara — una fecha explícita
 *   ("15/03/2027", "en marzo de 2027") o una fecha calculada con una
 *   fórmula sin ambigüedad a partir de otra fecha documentada.
 * - "derived": se ha calculado a partir de una expresión temporal
 *   relativa ("tres meses después", "al día siguiente", "al alta" con
 *   duración) aplicada sobre un ancla resoluble, o — cuando el texto no
 *   trae ninguna fecha — la fecha de importación usada como ancla
 *   operativa. Nunca se llama "documented": ninguna de las dos procede
 *   de una fecha que el texto declare para ESE evento en concreto.
 * - "unresolved": no hay ancla suficiente para resolver la expresión
 *   temporal (p. ej. "posteriormente" sin cantidad, o "al alta" sin
 *   duración ni ingreso previo). `date` conserva la última fecha
 *   resuelta conocida solo por compatibilidad técnica (ordenar listas,
 *   etc.) — ver domain/selectors.ts#isDateReliable: ningún motor de
 *   tendencia longitudinal (Argos, Turning Points, microbiología,
 *   PFR, comparaciones entre visitas) debe tratarla como si fuera una
 *   fecha real al decidir un antes/después.
 */
export type DatePrecision = "documented" | "derived" | "unresolved";

/**
 * De dónde procede `date` — complementa a `datePrecision` (cuánto nos
 * fiamos) con la procedencia concreta.
 *
 * - "explicit_date": una fecha de calendario tal cual aparece en el texto.
 * - "relative_offset": calculada aplicando una expresión temporal
 *   relativa a un ancla (otra fecha ya resuelta del mismo episodio).
 * - "import_anchor": el texto no traía ninguna fecha ni expresión
 *   temporal — se ha usado la fecha en la que se pegó el texto como
 *   ancla operativa. NUNCA implica que esa sea la fecha clínica real
 *   del evento — ver `datePrecision` ("derived", nunca "documented").
 */
export type DateSource = "explicit_date" | "relative_offset" | "import_anchor";

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
  EXERCISE_TEST: "exercise_test",
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
  /** Cuán fiable es `date` como fecha clínica real — ver DatePrecision. */
  datePrecision: DatePrecision;
  /** Procedencia concreta de `date` — ver DateSource. */
  dateSource: DateSource;
  /** Expresión temporal original tal cual aparece en el texto ("tres meses después", "al alta"...) — null si el evento no procede de una transición temporal relativa. Se conserva siempre, incluso cuando la resolución es exitosa, para trazabilidad. */
  temporalExpression: string | null;
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
  /**
   * Constantes vitales y hallazgos de la exploración mencionados
   * EXPLÍCITAMENTE en el texto de la consulta — null cuando el dato no
   * aparece, nunca inferido ni calculado a partir de otro campo (p. ej.
   * `afebrile` solo es true si el texto dice literalmente "afebril";
   * ausencia de mención de fiebre no implica afebril). Estructuran lo
   * que antes solo vivía como prosa suelta dentro de `rawText`, para
   * que Sentinel/Argos y futuros motores puedan leerlas sin volver a
   * analizar texto libre.
   */
  oxygenSaturationPercent?: number | null;
  respiratoryRate?: number | null;
  heartRate?: number | null;
  temperatureCelsius?: number | null;
  /** Tensión arterial tal cual aparece en el texto (p. ej. "120/80 mmHg") — no se separan sistólica/diastólica en campos propios. */
  bloodPressure?: string | null;
  /** Mención textual de oxigenoterapia durante la consulta (p. ej. "gafas nasales a 2 lpm") — no es un TreatmentStartedEvent: aquí solo se registra lo que la exploración describe, no se interpreta como un tratamiento iniciado. */
  oxygenTherapy?: string | null;
  afebrile?: boolean | null;
  hemodynamicallyStable?: boolean | null;
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
  /** Frecuencia expresada como intervalo ("cada 12 horas", "cada 8 h") — distinto de `schedule` (días concretos de la semana). */
  frequency?: string | null;
  /**
   * Duración prevista del tratamiento cuando el texto la menciona
   * explícitamente ("durante 14 días"). Nunca se deriva de aquí una
   * fecha de fin: el único cierre real de un tratamiento es un
   * TreatmentStoppedEvent, que solo existe cuando el texto describe una
   * retirada — una duración prevista no es una retirada confirmada.
   */
  duration?: string | null;
  /**
   * Cuando el fragmento describe un cambio sobre un tratamiento ya en
   * marcha (p. ej. "se intensifica fisioterapia respiratoria", "se
   * aumenta la dosis de azitromicina") en vez de un inicio nuevo — null
   * si es un inicio o no se menciona ningún cambio. Nunca se infiere:
   * solo se rellena cuando el texto lo dice explícitamente.
   */
  changeNote?: string | null;
}

export interface RespiratorySupportEvent extends ClinicalEventBase {
  type: "respiratory_support";
  drug: string;
  dose?: string | null;
  schedule?: string | null;
  frequency?: string | null;
  duration?: string | null;
  changeNote?: string | null;
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

/**
 * A qué bloque de laboratorio pertenece un LabParameter — puramente
 * ORGANIZATIVO (controla en qué sección de la pestaña "Analíticas" se
 * agrupa un parámetro), nunca un juicio clínico: no se usa para inferir
 * diagnósticos, gravedad ni recomendaciones. Cada parámetro pertenece a
 * una única categoría (ver engines/extraction/labParameters.ts para la
 * normalización conservadora que la asigna). "otros" es el cajón de
 * parámetros reconocidos pero sin un bloque de laboratorio claro — nunca
 * se fuerza un parámetro a una categoría más específica por defecto.
 */
export type LabPanelCategory =
  | "hemograma"
  | "bioquimica"
  | "funcion_renal"
  | "perfil_hepatico"
  | "inflamacion"
  | "coagulacion"
  | "inmunologia"
  | "aspergillus_abpa"
  | "alfa1_antitripsina"
  | "autoinmunidad"
  | "otros";

/**
 * Solo "normal"/"alterado" cuando el propio informe lo indica de forma
 * explícita (el texto lo dice, o el valor cae fuera de un rango de
 * referencia que el propio informe trae) — null en cualquier otro caso.
 * Nunca se infiere a partir de un umbral que PulmoVista decida por su
 * cuenta: eso sería inventar normalidad/alteración que el dato no da.
 */
export type LabParameterStatus = "normal" | "alterado" | null;

/** Rango de referencia tal y como lo trae el informe — ambos extremos opcionales porque muchos informes solo dan uno (p. ej. "<5 mg/dL"). */
export interface LabReferenceRange {
  low?: number | null;
  high?: number | null;
}

/**
 * Un parámetro analítico individual dentro de un LabResultsEvent.
 * `valueText` es la fuente de verdad (tal como consta en el informe:
 * "620 mg/dL", "Positivo", "<5 mg/dL") — `numericValue`/`unit` son una
 * lectura estructurada de ese mismo texto SOLO cuando es inequívoca,
 * nunca un valor inventado o forzado cuando el texto no es un número
 * simple (p. ej. "Positivo" no tiene numericValue).
 */
export interface LabParameter {
  name: string;
  /**
   * Nombre EXACTO tal como aparecía en el informe original, antes de
   * normalizar (p. ej. "Srm-Leucocitos", "Hb") — se conserva para
   * trazabilidad cuando `name` es el resultado de una normalización (ver
   * engines/extraction/labParameters.ts). null cuando el parámetro se
   * introdujo manualmente y no hay un nombre "crudo" distinto que guardar.
   */
  rawName?: string | null;
  valueText: string;
  numericValue?: number | null;
  unit?: string | null;
  referenceRange?: LabReferenceRange | null;
  status?: LabParameterStatus;
  category: LabPanelCategory;
}

/**
 * Resultado de laboratorio (analítica) — mismo formato libre que
 * ImagingEvent: un rótulo de la prueba y el fragmento de texto completo
 * que la describe, siempre conservado tal cual. `parameters` es un
 * desglose estructurado OPCIONAL de ese mismo texto — cuando no consta
 * (analíticas antiguas, o texto que no permite aislar parámetros
 * individuales) el evento se sigue mostrando por `label`/`text`, como
 * siempre: no es obligatorio estructurar para que una analítica exista.
 */
export interface LabResultsEvent extends ClinicalEventBase {
  type: "lab_results";
  label: string;
  text: string;
  parameters?: LabParameter[] | null;
  /**
   * Líneas del bloque original que ExtractionEngine no pudo interpretar
   * con seguridad como un parámetro estructurado (ver
   * engines/extraction/labParameters.ts) — se conservan tal cual, nunca
   * se descartan, para que el médico las revise. `text` ya contiene el
   * bloque completo; este campo solo señala qué fragmentos de ese mismo
   * texto quedaron sin estructurar.
   */
  unparsedLines?: string[] | null;
}

/** Prueba funcional/de esfuerzo (test de la marcha, prueba de esfuerzo con desaturación…) — mismo formato libre que ImagingEvent/LabResultsEvent, categoría propia porque no es ni función pulmonar en reposo (PulmonaryFunctionEvent) ni una analítica. */
export interface ExerciseTestEvent extends ClinicalEventBase {
  type: "exercise_test";
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
  | ExerciseTestEvent
  | DiagnosisEvent;

export type ClinicalEventType = ClinicalEvent["type"];

/** Payload específico de cada tipo de evento, sin los campos base. */
export type ClinicalEventPayload<T extends ClinicalEvent = ClinicalEvent> = Omit<
  T,
  keyof ClinicalEventBase | "type"
>;
