import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { computeChangesSinceLastVisit, detectContradictions } from "@/engines/longitudinal";
import type { MicrobiologyEvent, PulmonaryFunctionEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function patientWithTwoConsultations(): Patient {
  const id = "p1";
  return {
    id,
    code: "PV-TEST-0002",
    sex: "Hombre",
    age: 60,
    primaryDiagnosis: "EPOC",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events: [
      mkEvent(id, CLINICAL_EVENT_TYPES.CONSULTATION, "2023-01-01"),
      mkEvent(id, CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01"),
      mkEvent<PulmonaryFunctionEvent>(id, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 60, FVCPercent: 70 }),
      mkEvent<PulmonaryFunctionEvent>(id, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 50, FVCPercent: 65 }),
      mkEvent<MicrobiologyEvent>(id, CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-12-01", {
        sampleType: "Esputo",
        organism: "Pseudomonas aeruginosa",
        sensitivity: [],
        resistance: [],
      }),
    ],
  };
}

describe("computeChangesSinceLastVisit", () => {
  it("devuelve null si hay menos de dos consultas", () => {
    const patient = patientWithTwoConsultations();
    patient.events = patient.events.filter((e) => e.type !== CLINICAL_EVENT_TYPES.CONSULTATION);
    expect(computeChangesSinceLastVisit(patient)).toBeNull();
  });

  it("detecta el descenso de FEV1 y el nuevo aislamiento microbiológico entre las dos últimas consultas", () => {
    const result = computeChangesSinceLastVisit(patientWithTwoConsultations());
    expect(result).not.toBeNull();
    const fev1Change = result?.changes.find((c) => c.label === "FEV1");
    expect(fev1Change).toMatchObject({ from: "60%", to: "50%", kind: "disminuido" });
    const microChange = result?.changes.find((c) => c.label === "Microbiología");
    expect(microChange?.to).toContain("Pseudomonas aeruginosa");
  });
});

describe("detectContradictions", () => {
  it("no detecta nada si no hay pruebas de función pulmonar próximas en el tiempo", () => {
    expect(detectContradictions(patientWithTwoConsultations())).toEqual([]);
  });

  it("detecta una discrepancia entre litros y porcentaje de FEV1 en un intervalo corto", () => {
    const id = "p2";
    const patient: Patient = {
      id,
      code: "PV-TEST-0003",
      sex: "Mujer",
      age: 55,
      primaryDiagnosis: "EPOC",
      secondaryDiagnoses: "",
      createdAt: "2025-08-01",
      events: [
        mkEvent<PulmonaryFunctionEvent>(id, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2025-08-01", {
          FEV1Liters: 1.02,
          FEV1Percent: 34,
        }),
        mkEvent<PulmonaryFunctionEvent>(id, CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2025-09-15", {
          FEV1Liters: 1.38,
          FEV1Percent: 33,
        }),
      ],
    };
    const findings = detectContradictions(patient);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("1.02");
    expect(findings[0].message).toContain("1.38");
  });
});
