import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { computeTurningPoints } from "@/engines/turningPoints";
import { detectObjectiveTurningPoints } from "@/engines/turningPoints/objectiveDetectors";
import { interpretTurningPointLegacy } from "@/engines/turningPoints/legacyInterpretations";
import type { ExacerbationEvent, MicrobiologyEvent, PulmonaryFunctionEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function basePatient(events: Patient["events"]): Patient {
  return {
    id: "p1",
    code: "PV-TEST-0005",
    sex: "Hombre",
    age: 67,
    primaryDiagnosis: "EPOC",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
  };
}

describe("detectObjectiveTurningPoints — respiratory-support-start", () => {
  it("no incluye una frase de interpretación (solo datos objetivos)", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-09-05", { drug: "oxígeno domiciliario" }),
    ]);
    const points = detectObjectiveTurningPoints(patient);
    expect(points).toHaveLength(1);
    expect(points[0]).not.toHaveProperty("interpretation");
    expect(points[0].subject).toBe("oxígeno domiciliario");
    expect(points[0].after["Soporte respiratorio"]).toBe("Oxígeno domiciliario");
  });
});

describe("detectObjectiveTurningPoints — first-persistent-organism", () => {
  it("detecta el 2º aislamiento del mismo organismo y guarda el organismo en `subject`", () => {
    const patient = basePatient([
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-01-01", {
        sampleType: "Esputo",
        organism: "Pseudomonas aeruginosa",
        sensitivity: [],
        resistance: [],
      }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", {
        sampleType: "Esputo",
        organism: "Pseudomonas aeruginosa",
        sensitivity: [],
        resistance: [],
      }),
    ]);
    const points = detectObjectiveTurningPoints(patient);
    const point = points.find((p) => p.criterion === "first-persistent-organism");
    expect(point?.subject).toBe("Pseudomonas aeruginosa");
  });
});

describe("detectObjectiveTurningPoints — restrictive-decline (bug técnico corregido, no clínico)", () => {
  it("detecta la caída de FVC aunque las pruebas no tengan FEV1Percent registrado", () => {
    // Antes de la corrección, este detector reutilizaba por error la lista de
    // PFT filtrada por FEV1Percent presente, así que una prueba con FVC
    // documentado pero sin FEV1 quedaba excluida y el turning point no se
    // detectaba. Ahora usa selectPFTWithFVC, propio de este detector.
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FVCPercent: 70 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-10-01", { FVCPercent: 60 }),
    ]);
    const points = detectObjectiveTurningPoints(patient);
    const point = points.find((p) => p.criterion === "restrictive-decline");
    expect(point).toBeDefined();
    expect(point?.before.FVC).toBe("70%");
    expect(point?.after.FVC).toBe("60%");
  });
});

describe("detectObjectiveTurningPoints — first-hospitalization", () => {
  it("detecta la primera exacerbación con hospitalization=true", () => {
    const patient = basePatient([
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2023-01-01", { severity: "Leve", hospitalization: false }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true }),
    ]);
    const points = detectObjectiveTurningPoints(patient);
    const point = points.find((p) => p.criterion === "first-hospitalization");
    expect(point?.date).toBe("2024-01-01");
  });
});

describe("interpretTurningPointLegacy (LEGACY)", () => {
  it("construye la frase de interpretación a partir del `subject` objetivo, no de texto fijo independiente del dato", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-09-05", { drug: "ventilación no invasiva" }),
    ]);
    const [objective] = detectObjectiveTurningPoints(patient);
    expect(interpretTurningPointLegacy(objective)).toBe(
      "Inicio de ventilación no invasiva: suele marcar un cambio relevante en el manejo de la enfermedad.",
    );
  });
});

describe("computeTurningPoints", () => {
  it("compone la detección objetiva con la interpretación legacy y marca la fuente", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-09-05", { drug: "oxígeno domiciliario" }),
    ]);
    const [tp] = computeTurningPoints(patient);
    expect(tp.source).toEqual({ kind: "legacy_heuristic", ruleId: "respiratory-support-start", label: "Inicio de soporte respiratorio" });
    expect(tp.interpretation).toContain("Inicio de oxígeno domiciliario");
    expect(tp.explanation.sections.map((s) => s.label)).toEqual(["Antes / Después", "Interpretación"]);
  });
});
