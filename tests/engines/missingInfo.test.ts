import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { computeMissingInfo, computeReviewOpportunities } from "@/engines/missingInfo";
import type { MicrobiologyEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function basePatient(primaryDiagnosis: string, events: Patient["events"] = []): Patient {
  return {
    id: "p1",
    code: "PV-TEST-0006",
    sex: "Mujer",
    age: 58,
    primaryDiagnosis,
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
  };
}

describe("computeMissingInfo (LEGACY)", () => {
  it("usa el checklist de Bronquiectasias y señala todo lo ausente", () => {
    const result = computeMissingInfo(basePatient("Bronquiectasias no FQ"));
    expect(result.category).toBe("Bronquiectasias");
    expect(result.items).toContain("No consta microbiología reciente.");
    expect(result.source).toMatchObject({ kind: "legacy_heuristic" });
  });

  it("deja de señalar microbiología cuando ya hay un cultivo registrado", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-01-01", {
        sampleType: "Esputo",
        organism: "Haemophilus influenzae",
        sensitivity: [],
        resistance: [],
      }),
    ]);
    const result = computeMissingInfo(patient);
    expect(result.items).not.toContain("No consta microbiología reciente.");
  });

  it("usa el checklist General para diagnósticos no reconocidos", () => {
    expect(computeMissingInfo(basePatient("Asma bronquial")).category).toBe("General");
  });
});

describe("computeReviewOpportunities (LEGACY)", () => {
  it("deriva una oportunidad de revisión por cada turning point, con la nota fija", () => {
    const patient = basePatient("EPOC (GOLD III)", [
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2025-09-05", { drug: "oxígeno domiciliario" }),
    ]);
    const opportunities = computeReviewOpportunities(patient);
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].note).toBe(
      "No consta posteriormente una valoración documentada de estrategia preventiva en la información introducida.",
    );
    expect(opportunities[0].source.kind).toBe("legacy_heuristic");
  });

  it("no genera oportunidades si no hay turning points", () => {
    expect(computeReviewOpportunities(basePatient("EPOC (GOLD III)"))).toEqual([]);
  });
});
