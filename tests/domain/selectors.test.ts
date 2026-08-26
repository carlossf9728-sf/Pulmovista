import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import {
  exacerbationsByYear,
  getStateAsOf,
  selectConsultations,
  selectExacerbations,
  selectHospitalizationCount,
  selectImaging,
  selectMicrobiology,
  selectPFT,
  selectTreatments,
} from "@/domain/selectors";
import type {
  ExacerbationEvent,
  ImagingEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  TreatmentStartedEvent,
  TreatmentStoppedEvent,
} from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function buildPatient(): Patient {
  const id = "p1";
  const events = [
    mkEvent(id, CLINICAL_EVENT_TYPES.CONSULTATION, "2023-01-01"),
    mkEvent<PulmonaryFunctionEvent>(id, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-06-01", {
      FEV1Percent: 80,
      FVCPercent: 85,
      DLCOPercent: 70,
    }),
    mkEvent<PulmonaryFunctionEvent>(id, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-06-01", {
      FEV1Percent: 70,
      FVCPercent: 75,
      DLCOPercent: 60,
    }),
    mkEvent<MicrobiologyEvent>(id, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-07-01", {
      sampleType: "Esputo",
      organism: "Pseudomonas aeruginosa",
      sensitivity: ["ciprofloxacino"],
      resistance: [],
    }),
    mkEvent<ExacerbationEvent>(id, CLINICAL_EVENT_TYPES.EXACERBATION, "2023-08-01", {
      severity: "Grave",
      hospitalization: true,
    }),
    mkEvent<ExacerbationEvent>(id, CLINICAL_EVENT_TYPES.EXACERBATION, "2024-02-01", {
      severity: "Leve",
      hospitalization: false,
    }),
    mkEvent<TreatmentStartedEvent>(id, CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2023-01-15", {
      drug: "azitromicina",
      dose: "250 mg",
    }),
    mkEvent<TreatmentStoppedEvent>(id, CLINICAL_EVENT_TYPES.TREATMENT_STOPPED, "2024-01-15", {
      drug: "azitromicina",
    }),
    mkEvent<ImagingEvent>(id, CLINICAL_EVENT_TYPES.IMAGING, "2023-03-01", {
      label: "TC tórax",
      text: "Sin hallazgos relevantes.",
    }),
  ];
  return {
    id,
    code: "PV-TEST-0001",
    sex: "Mujer",
    age: 50,
    primaryDiagnosis: "Bronquiectasias",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
  };
}

describe("selectores derivados", () => {
  const patient = buildPatient();

  it("selectConsultations filtra y ordena por fecha", () => {
    expect(selectConsultations(patient.events)).toHaveLength(1);
  });

  it("selectPFT devuelve las pruebas de función pulmonar ordenadas", () => {
    const pfts = selectPFT(patient.events);
    expect(pfts.map((p) => p.date)).toEqual(["2023-06-01", "2024-06-01"]);
  });

  it("selectMicrobiology filtra por tipo", () => {
    expect(selectMicrobiology(patient.events)).toHaveLength(1);
  });

  it("selectExacerbations filtra por tipo", () => {
    expect(selectExacerbations(patient.events)).toHaveLength(2);
  });

  it("selectImaging filtra por tipo", () => {
    expect(selectImaging(patient.events)).toHaveLength(1);
  });

  it("selectHospitalizationCount cuenta exacerbaciones con hospitalization=true", () => {
    expect(selectHospitalizationCount(patient.events, null)).toBe(1);
  });

  it("selectHospitalizationCount respeta el límite de fecha", () => {
    expect(selectHospitalizationCount(patient.events, "2023-01-01")).toBe(0);
    expect(selectHospitalizationCount(patient.events, "2023-12-31")).toBe(1);
  });

  it("selectTreatments empareja inicio y fin por nombre de fármaco", () => {
    const treatments = selectTreatments(patient.events);
    expect(treatments).toHaveLength(1);
    expect(treatments[0].status).toBe("Finalizado");
    expect(treatments[0].end).toBe("2024-01-15");
    expect(treatments[0].name).toBe("Azitromicina 250 mg");
  });

  it("selectTreatments muestra schedule entre paréntesis aunque no haya dose, en vez de descartarlo en silencio", () => {
    const ev = mkEvent<TreatmentStartedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2024-01-01", { drug: "prednisona oral", schedule: "pauta descendente, 5 días" });
    const [treatment] = selectTreatments([ev]);
    expect(treatment.name).toBe("Prednisona oral (pauta descendente, 5 días)");
  });

  it("exacerbationsByYear agrupa por año", () => {
    expect(exacerbationsByYear(patient)).toEqual([
      { year: 2023, count: 1 },
      { year: 2024, count: 1 },
    ]);
  });

  it("getStateAsOf reconstruye el estado del paciente a una fecha dada", () => {
    const state = getStateAsOf(patient, "2023-12-31");
    expect(state.fev1).toBe(80);
    expect(state.fvc).toBe(85);
    expect(state.dlco).toBe(70);
    expect(state.organisms.has("Pseudomonas aeruginosa")).toBe(true);
    expect(state.hospCumulative).toBe(1);
    expect(state.activeTreatments.has("Azitromicina 250 mg")).toBe(true);
  });

  it("getStateAsOf a una fecha posterior refleja el tratamiento ya finalizado", () => {
    const state = getStateAsOf(patient, "2024-06-01");
    expect(state.fev1).toBe(70);
    expect(state.activeTreatments.size).toBe(0);
  });
});
