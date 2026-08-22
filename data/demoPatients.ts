/**
 * Pacientes de demostración (event-based). Todos los pacientes son
 * ficticios/sintéticos. Prototype / research use only — no introducir
 * datos identificativos reales.
 */
import { mkEvent, CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import type {
  ConsultationEvent,
  ExacerbationEvent,
  ImagingEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
  TreatmentStartedEvent,
  TreatmentStoppedEvent,
} from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

export function buildDemoPatients(): Patient[] {
  const p1 = "p1";
  const p2 = "p2";
  const p3 = "p3";

  const events1 = [
    mkEvent<ConsultationEvent>(p1, CLINICAL_EVENT_TYPES.CONSULTATION, "2023-02-10", {}, {
      rawText:
        "Primera valoración en la unidad de bronquiectasias, diagnosticadas en 2019. Historia de 1 exacerbación al año tratada de forma ambulatoria. Función pulmonar estable, FEV1 82%. Cultivo de esputo con Haemophilus influenzae. Se inicia fisioterapia respiratoria diaria.",
    }),
    mkEvent<ConsultationEvent>(p1, CLINICAL_EVENT_TYPES.CONSULTATION, "2024-03-10", {}, {
      rawText:
        "Revisión anual. Refiere aumento leve de expectoración en los últimos meses. Cultivo de esputo positivo para Pseudomonas aeruginosa por primera vez, sensible a ciprofloxacino. FEV1 78%. Se mantiene actitud expectante y fisioterapia.",
    }),
    mkEvent<ConsultationEvent>(p1, CLINICAL_EVENT_TYPES.CONSULTATION, "2025-11-20", {}, {
      rawText:
        "Consulta de revisión. En el último año ha presentado 2 exacerbaciones, una de ellas atendida en urgencias. El cultivo repite Pseudomonas aeruginosa, ahora con menor sensibilidad (resistente a ciprofloxacino). FEV1 actual 71%. Dada la frecuencia de exacerbaciones se inicia azitromicina como tratamiento supresor a largo plazo.",
    }),
    mkEvent<ConsultationEvent>(p1, CLINICAL_EVENT_TYPES.CONSULTATION, "2026-06-25", {}, {
      rawText:
        "Desde la última revisión ha presentado dos agudizaciones adicionales, una de ellas con ingreso hospitalario en febrero de 2026. Nuevo cultivo de esputo con Pseudomonas aeruginosa multirresistente, sensible únicamente a colistina. FEV1 actual 68%. TC de control con mayor impactación mucosa. Se añade tobramicina inhalada al tratamiento.",
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-02-10", {
      FEV1Percent: 82,
      FEV1Liters: 2.1,
      FVCPercent: 88,
      FVCLiters: 2.72,
      DLCOPercent: 78,
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-08-15", {
      FEV1Percent: 80,
      FEV1Liters: 2.05,
      FVCPercent: 86,
      FVCLiters: 2.66,
      DLCOPercent: 76,
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-02-20", {
      FEV1Percent: 78,
      FEV1Liters: 2.0,
      FVCPercent: 85,
      FVCLiters: 2.63,
      DLCOPercent: 74,
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-09-05", {
      FEV1Percent: 74,
      FEV1Liters: 1.9,
      FVCPercent: 82,
      FVCLiters: 2.54,
      DLCOPercent: 71,
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2025-03-12", {
      FEV1Percent: 71,
      FEV1Liters: 1.82,
      FVCPercent: 80,
      FVCLiters: 2.48,
      DLCOPercent: 69,
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2026-01-14", {
      FEV1Percent: 69,
      FEV1Liters: 1.77,
      FVCPercent: 77,
      FVCLiters: 2.38,
      DLCOPercent: 66,
    }),
    mkEvent<PulmonaryFunctionEvent>(p1, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2026-06-20", {
      FEV1Percent: 68,
      FEV1Liters: 1.74,
      FVCPercent: 76,
      FVCLiters: 2.35,
      DLCOPercent: 65,
    }),
    mkEvent<MicrobiologyEvent>(p1, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-03-01", {
      sampleType: "Esputo",
      organism: "Haemophilus influenzae",
      sensitivity: ["amoxicilina-clavulánico"],
      resistance: [],
    }),
    mkEvent<MicrobiologyEvent>(p1, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-03-10", {
      sampleType: "Esputo",
      organism: "Pseudomonas aeruginosa",
      sensitivity: ["ciprofloxacino", "ceftazidima"],
      resistance: [],
    }),
    mkEvent<MicrobiologyEvent>(p1, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2025-11-05", {
      sampleType: "Esputo",
      organism: "Pseudomonas aeruginosa",
      sensitivity: ["ceftazidima"],
      resistance: ["ciprofloxacino"],
    }),
    mkEvent<MicrobiologyEvent>(p1, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2026-06-02", {
      sampleType: "Esputo",
      organism: "Pseudomonas aeruginosa",
      sensitivity: ["colistina inhalada"],
      resistance: ["multirresistente"],
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2023-07-01", {
      severity: "Leve",
      hospitalization: false,
      treatment: "Amoxicilina-clavulánico",
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2024-04-15", {
      severity: "Leve",
      hospitalization: false,
      treatment: "Ciprofloxacino",
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2025-01-20", {
      severity: "Moderada",
      hospitalization: false,
      treatment: "Ceftazidima (urgencias)",
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2025-09-10", {
      severity: "Leve",
      hospitalization: false,
      treatment: "Ciprofloxacino",
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2026-02-05", {
      severity: "Grave",
      hospitalization: true,
      treatment: "Ceftazidima IV",
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2026-05-18", {
      severity: "Leve",
      hospitalization: false,
      treatment: "Ciprofloxacino",
    }),
    mkEvent<ExacerbationEvent>(p1, CLINICAL_EVENT_TYPES.EXACERBATION, "2026-07-01", {
      severity: "Moderada",
      hospitalization: false,
      treatment: "Colistina inhalada (urgencias)",
    }),
    mkEvent<TreatmentStartedEvent>(p1, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2023-01-05", {
      drug: "fisioterapia respiratoria diaria",
    }),
    mkEvent<TreatmentStartedEvent>(p1, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2025-11-20", {
      drug: "azitromicina",
      dose: "250 mg",
      schedule: "lunes-miércoles-viernes",
    }),
    mkEvent<TreatmentStartedEvent>(p1, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2026-06-25", {
      drug: "tobramicina inhalada",
    }),
    mkEvent<ImagingEvent>(p1, CLINICAL_EVENT_TYPES.IMAGING, "2023-01-20", {
      label: "TC tórax",
      text: "Bronquiectasias cilíndricas bilaterales de predominio en lóbulos inferiores. Sin impactación mucosa relevante.",
    }),
    mkEvent<ImagingEvent>(p1, CLINICAL_EVENT_TYPES.IMAGING, "2024-06-10", {
      label: "TC tórax",
      text: "Sin cambios significativos respecto al estudio previo.",
    }),
    mkEvent<ImagingEvent>(p1, CLINICAL_EVENT_TYPES.IMAGING, "2026-01-30", {
      label: "TC tórax",
      text: "Aumento de impactación mucosa y engrosamiento de pared bronquial. Progresión leve de bronquiectasias en língula.",
    }),
  ];

  const events2 = [
    mkEvent<ConsultationEvent>(p2, CLINICAL_EVENT_TYPES.CONSULTATION, "2023-01-15", {}, {
      rawText:
        "Primera valoración. EPOC diagnosticado hace 6 años. FEV1 45%. Dos ingresos previos por agudización en los últimos 3 años según refiere el paciente (no documentados en este sistema). Se optimiza tratamiento inhalado a triple terapia.",
    }),
    mkEvent<ConsultationEvent>(p2, CLINICAL_EVENT_TYPES.CONSULTATION, "2024-09-18", {}, {
      rawText:
        "Revisión. En el último año, 1 ingreso hospitalario por agudización grave que precisó ventilación no invasiva. FEV1 actual 38%. Completa programa de rehabilitación respiratoria.",
    }),
    mkEvent<ConsultationEvent>(p2, CLINICAL_EVENT_TYPES.CONSULTATION, "2025-08-28", {}, {
      rawText:
        "Consulta tras nuevo ingreso por agudización grave. En los últimos 12 meses: 2 ingresos hospitalarios. FEV1 34%. Saturación basal 91%. Se inicia oxigenoterapia domiciliaria.",
    }),
    mkEvent<ConsultationEvent>(p2, CLINICAL_EVENT_TYPES.CONSULTATION, "2026-06-15", {}, {
      rawText:
        "Revisión de seguimiento. Desde la última consulta, un nuevo ingreso con ventilación no invasiva en enero y una agudización ambulatoria en mayo. FEV1 30%. Disnea mMRC 3. Cultivo de esputo con Haemophilus influenzae.",
    }),
    mkEvent<PulmonaryFunctionEvent>(p2, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-15", {
      FEV1Percent: 45,
      FEV1Liters: 1.35,
      FVCPercent: 68,
      FVCLiters: 2.6,
      DLCOPercent: 58,
    }),
    mkEvent<PulmonaryFunctionEvent>(p2, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-10-02", {
      FEV1Percent: 42,
      FEV1Liters: 1.26,
      FVCPercent: 65,
      FVCLiters: 2.49,
      DLCOPercent: 55,
    }),
    mkEvent<PulmonaryFunctionEvent>(p2, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-09-18", {
      FEV1Percent: 38,
      FEV1Liters: 1.14,
      FVCPercent: 61,
      FVCLiters: 2.34,
      DLCOPercent: 50,
    }),
    mkEvent<PulmonaryFunctionEvent>(p2, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2025-08-22", {
      FEV1Percent: 34,
      FEV1Liters: 1.02,
      FVCPercent: 57,
      FVCLiters: 2.18,
      DLCOPercent: 45,
    }),
    // Punto añadido deliberadamente en el prototipo original para demostrar
    // detección de contradicciones: % similar al anterior pero litros muy
    // superiores, a solo 24 días de distancia.
    mkEvent<PulmonaryFunctionEvent>(
      p2,
      CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION,
      "2025-09-15",
      { FEV1Percent: 33, FEV1Liters: 1.38, FVCPercent: 56, FVCLiters: 2.1, DLCOPercent: 44 },
      {
        confidence: "dato incompleto",
        confidenceReason: "Valor introducido en una revisión breve sin repetición de la prueba.",
      },
    ),
    mkEvent<PulmonaryFunctionEvent>(p2, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2026-06-10", {
      FEV1Percent: 30,
      FEV1Liters: 0.9,
      FVCPercent: 53,
      FVCLiters: 2.03,
      DLCOPercent: 41,
    }),
    mkEvent<MicrobiologyEvent>(p2, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-12", {
      sampleType: "Esputo",
      organism: "Haemophilus influenzae",
      sensitivity: ["amoxicilina-clavulánico"],
      resistance: [],
    }),
    mkEvent<MicrobiologyEvent>(p2, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2025-08-30", {
      sampleType: "Esputo",
      organism: "Moraxella catarrhalis",
      sensitivity: ["azitromicina"],
      resistance: [],
    }),
    mkEvent<MicrobiologyEvent>(p2, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2026-06-15", {
      sampleType: "Esputo",
      organism: "Haemophilus influenzae",
      sensitivity: ["levofloxacino"],
      resistance: [],
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2023-05-10", {
      severity: "Leve",
      hospitalization: false,
      treatment: "Corticoide oral + broncodilatador",
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2023-11-20", {
      severity: "Moderada",
      hospitalization: false,
      treatment: "Antibiótico + corticoide oral",
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2024-07-14", {
      severity: "Grave",
      hospitalization: true,
      treatment: "Ingreso, VMNI",
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2025-02-02", {
      severity: "Moderada",
      hospitalization: false,
      treatment: "Antibiótico + corticoide oral",
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2025-08-28", {
      severity: "Grave",
      hospitalization: true,
      treatment: "Ingreso",
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2026-01-19", {
      severity: "Grave",
      hospitalization: true,
      treatment: "Ingreso, VMNI",
    }),
    mkEvent<ExacerbationEvent>(p2, CLINICAL_EVENT_TYPES.EXACERBATION, "2026-05-30", {
      severity: "Moderada",
      hospitalization: false,
      treatment: "Antibiótico + corticoide oral",
    }),
    mkEvent<TreatmentStartedEvent>(p2, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2023-01-15", {
      drug: "triple terapia inhalada (LABA/LAMA/ICS)",
    }),
    mkEvent<TreatmentStartedEvent>(p2, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2024-09-01", {
      drug: "rehabilitación respiratoria",
    }),
    mkEvent<TreatmentStoppedEvent>(p2, CLINICAL_EVENT_TYPES.TREATMENT_STOPPED, "2025-02-01", {
      drug: "rehabilitación respiratoria",
    }),
    mkEvent<RespiratorySupportEvent>(p2, CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-09-05", {
      drug: "oxígeno domiciliario",
    }),
    mkEvent<ImagingEvent>(p2, CLINICAL_EVENT_TYPES.IMAGING, "2023-02-01", {
      label: "TC tórax",
      text: "Enfisema centrolobulillar de predominio en campos superiores. Sin condensaciones.",
    }),
    mkEvent<ImagingEvent>(p2, CLINICAL_EVENT_TYPES.IMAGING, "2025-09-10", {
      label: "TC tórax",
      text: "Progresión del patrón enfisematoso. Signos de atrapamiento aéreo más marcados.",
    }),
  ];

  const events3 = [
    mkEvent<ConsultationEvent>(p3, CLINICAL_EVENT_TYPES.CONSULTATION, "2023-04-05", {}, {
      rawText:
        "Primera valoración tras diagnóstico de fibrosis pulmonar idiopática. FVC 74%, DLCO 58%. Se inicia tratamiento antifibrótico con nintedanib y manejo del reflujo gastroesofágico.",
    }),
    mkEvent<ConsultationEvent>(p3, CLINICAL_EVENT_TYPES.CONSULTATION, "2024-10-15", {}, {
      rawText: "Revisión anual. FVC 65%, DLCO 47%. Refiere mayor disnea de esfuerzo. Tolera bien el antifibrótico.",
    }),
    mkEvent<ConsultationEvent>(p3, CLINICAL_EVENT_TYPES.CONSULTATION, "2025-09-30", {}, {
      rawText:
        "Revisión. Descenso relevante de función pulmonar en el último año: FVC 58%, DLCO 39%. Disnea mMRC 2-3. Se inicia oxígeno con el esfuerzo.",
    }),
    mkEvent<ConsultationEvent>(p3, CLINICAL_EVENT_TYPES.CONSULTATION, "2026-07-05", {}, {
      rawText:
        "Consulta de seguimiento. FVC 51%, DLCO 33%. Continúa con nintedanib y oxígeno con el esfuerzo. Sin exacerbaciones desde la última revisión.",
    }),
    mkEvent<PulmonaryFunctionEvent>(p3, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-04-05", {
      FEV1Percent: 78,
      FEV1Liters: 1.95,
      FVCPercent: 74,
      FVCLiters: 2.31,
      DLCOPercent: 58,
    }),
    mkEvent<PulmonaryFunctionEvent>(p3, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-10-20", {
      FEV1Percent: 76,
      FEV1Liters: 1.9,
      FVCPercent: 71,
      FVCLiters: 2.21,
      DLCOPercent: 54,
    }),
    mkEvent<PulmonaryFunctionEvent>(p3, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-10-15", {
      FEV1Percent: 72,
      FEV1Liters: 1.8,
      FVCPercent: 65,
      FVCLiters: 2.03,
      DLCOPercent: 47,
    }),
    mkEvent<PulmonaryFunctionEvent>(p3, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2025-09-30", {
      FEV1Percent: 68,
      FEV1Liters: 1.7,
      FVCPercent: 58,
      FVCLiters: 1.81,
      DLCOPercent: 39,
    }),
    mkEvent<PulmonaryFunctionEvent>(p3, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2026-07-05", {
      FEV1Percent: 64,
      FEV1Liters: 1.6,
      FVCPercent: 51,
      FVCLiters: 1.59,
      DLCOPercent: 33,
    }),
    mkEvent<ExacerbationEvent>(p3, CLINICAL_EVENT_TYPES.EXACERBATION, "2025-03-10", {
      severity: "Moderada",
      hospitalization: false,
      treatment: "Corticoide en pauta corta",
    }),
    mkEvent<TreatmentStartedEvent>(p3, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2023-05-01", { drug: "nintedanib" }),
    mkEvent<TreatmentStartedEvent>(p3, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2023-05-01", {
      drug: "tratamiento del reflujo gastroesofágico",
    }),
    mkEvent<RespiratorySupportEvent>(p3, CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-10-15", {
      drug: "oxígeno con el esfuerzo",
    }),
    mkEvent<ImagingEvent>(p3, CLINICAL_EVENT_TYPES.IMAGING, "2023-03-20", {
      label: "TC tórax de alta resolución",
      text: "Patrón de neumonía intersticial usual con panalización basal bilateral.",
    }),
    mkEvent<ImagingEvent>(p3, CLINICAL_EVENT_TYPES.IMAGING, "2024-10-01", {
      label: "TC tórax de alta resolución",
      text: "Progresión leve de la panalización, mayor extensión basal.",
    }),
    mkEvent<ImagingEvent>(p3, CLINICAL_EVENT_TYPES.IMAGING, "2025-09-15", {
      label: "TC tórax de alta resolución",
      text: "Progresión significativa de la fibrosis con pérdida de volumen pulmonar.",
    }),
  ];

  return [
    {
      id: p1,
      code: "PV-7K2F-Q9MX",
      sex: "Mujer",
      age: 58,
      primaryDiagnosis: "Bronquiectasias no fibrosis quística",
      secondaryDiagnoses: "Asma bronquial leve",
      createdAt: "2023-02-10",
      events: events1,
    },
    {
      id: p2,
      code: "PV-4M9D-L2QT",
      sex: "Hombre",
      age: 67,
      primaryDiagnosis: "EPOC (GOLD III)",
      secondaryDiagnoses: "Hipertensión arterial",
      createdAt: "2023-01-15",
      events: events2,
    },
    {
      id: p3,
      code: "PV-9R5K-B7NF",
      sex: "Mujer",
      age: 71,
      primaryDiagnosis: "Fibrosis pulmonar idiopática",
      secondaryDiagnoses: "Reflujo gastroesofágico",
      createdAt: "2023-04-05",
      events: events3,
    },
  ];
}
