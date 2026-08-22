import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { computeSentinelFindings, patientStatus } from "@/engines/sentinel";
import type { MicrobiologyEvent, PulmonaryFunctionEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function basePatient(events: Patient["events"]): Patient {
  return {
    id: "p1",
    code: "PV-TEST-0004",
    sex: "Mujer",
    age: 58,
    primaryDiagnosis: "Bronquiectasias",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
  };
}

describe("computeSentinelFindings — fev1-trend-decline (LEGACY)", () => {
  it("no dispara con menos de 3 determinaciones", () => {
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-06-01", { FEV1Percent: 70 }),
    ]);
    expect(computeSentinelFindings(patient).find((f) => f.ruleId === "fev1-trend-decline")).toBeUndefined();
  });

  it("dispara con 3 determinaciones consecutivas descendentes y marca la fuente como legacy_heuristic", () => {
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-06-01", { FEV1Percent: 72 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 65 }),
    ]);
    const finding = computeSentinelFindings(patient).find((f) => f.ruleId === "fev1-trend-decline");
    expect(finding).toBeDefined();
    expect(finding?.source).toEqual({ kind: "legacy_heuristic", ruleId: "fev1-trend-decline", label: "Tendencia descendente de FEV1" });
    expect(finding?.confidence).toBe("Alta"); // caída relativa (80-65)/80 = 18.75% >= 15%
    expect(finding?.explanation.sections.map((s) => s.label)).toEqual(["Dato", "Interpretación", "Recomendación"]);
  });
});

describe("computeSentinelFindings — persistent-organism (LEGACY)", () => {
  it("dispara cuando el mismo organismo se aísla 2 o más veces", () => {
    const patient = basePatient([
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-01-01", {
        sampleType: "Esputo",
        organism: "Pseudomonas aeruginosa",
        sensitivity: [],
        resistance: [],
      }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-06-01", {
        sampleType: "Esputo",
        organism: "Pseudomonas aeruginosa",
        sensitivity: [],
        resistance: [],
      }),
    ]);
    expect(computeSentinelFindings(patient).find((f) => f.ruleId === "persistent-organism")).toBeDefined();
  });
});

describe("computeSentinelFindings — new-respiratory-support (LEGACY)", () => {
  it("dispara al detectar el primer evento de soporte respiratorio", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2024-01-01", { drug: "oxígeno domiciliario" }),
    ]);
    const finding = computeSentinelFindings(patient).find((f) => f.ruleId === "new-respiratory-support");
    expect(finding?.datum).toContain("Oxígeno domiciliario");
  });
});

describe("patientStatus", () => {
  it("es 'estable' sin hallazgos Sentinel", () => {
    expect(patientStatus(basePatient([]))).toBe("estable");
  });

  it("es 'deterioro' si hay algún hallazgo de confianza Alta", () => {
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-06-01", { FEV1Percent: 72 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 65 }),
    ]);
    expect(patientStatus(patient)).toBe("deterioro");
  });

  it("es 'revision' si solo hay hallazgos de confianza Moderada", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2024-01-01", { drug: "oxígeno domiciliario" }),
    ]);
    expect(patientStatus(patient)).toBe("revision");
  });
});
