/**
 * Tests de engines/guidelines/explain.ts — helpers de presentación sobre
 * GuidelineMatch. Cubren específicamente la distinción general/
 * condicionada: una recomendación general (sin criteria ni
 * prerequisites) nunca debe leerse como si exigiera un criterio
 * clínico, y su "Dato del paciente" debe incluir el diagnóstico.
 */
import { describe, expect, it } from "vitest";
import { criteriaSummaryText, evidenceLine, interpretationSentence, patientDatumLines } from "@/engines/guidelines/explain";
import { findRecommendationById } from "@/engines/guidelines/knowledge";
import { matchPatientToRecommendation } from "@/engines/guidelines/match";
import type { Patient } from "@/types/patient";

function basePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p-explain",
    code: "PV-TEST-EXPLAIN",
    sex: "Mujer",
    age: 60,
    primaryDiagnosis: "Bronquiectasias no fibrosis quística",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events: [],
    ...overrides,
  };
}

const AS_OF = "2026-06-01";

describe("interpretationSentence — recomendaciones GENERALES", () => {
  it("nunca dice 'cumple el criterio clínico' para una recomendación sin ningún criterio (ers-rec-pico1)", () => {
    const recommendation = findRecommendationById("ers-rec-pico1")!;
    expect(recommendation.applicability).toBe("general");
    const match = matchPatientToRecommendation(basePatient(), recommendation, AS_OF);
    expect(match.status).toBe("applies");

    const sentence = interpretationSentence(match.status, recommendation.applicability);
    expect(sentence).not.toContain("cumple el criterio clínico");
    expect(sentence).toContain("aplica de forma general");
  });

  it("explica la exclusión sin decir 'cumple el criterio clínico' para una recomendación general con exclusión (separ-rec-corticoides-no-rutina)", () => {
    const recommendation = findRecommendationById("separ-rec-corticoides-no-rutina")!;
    expect(recommendation.applicability).toBe("general");
    const patientWithAsma = basePatient({ secondaryDiagnoses: "Asma bronquial leve" });
    const match = matchPatientToRecommendation(patientWithAsma, recommendation, AS_OF);
    expect(match.status).toBe("does_not_apply");

    const sentence = interpretationSentence(match.status, recommendation.applicability);
    expect(sentence).not.toContain("cumple el criterio clínico");
    expect(sentence).toContain("aplica de forma general");
    expect(sentence).toContain("exclusión");
  });
});

describe("interpretationSentence — recomendaciones CONDICIONADAS (sin cambios de comportamiento)", () => {
  it("sí describe cumplimiento de criterio clínico cuando la recomendación exige uno (ers-rec-pico4)", () => {
    const recommendation = findRecommendationById("ers-rec-pico4")!;
    expect(recommendation.applicability).toBe("conditional");
    const sentence = interpretationSentence("applies", recommendation.applicability);
    expect(sentence).toContain("cumple el criterio clínico");
  });
});

describe("patientDatumLines", () => {
  it("antepone el diagnóstico registrado para una recomendación general", () => {
    const recommendation = findRecommendationById("ers-rec-pico1")!;
    const patient = basePatient();
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    const lines = patientDatumLines(patient, match, recommendation.applicability);
    expect(lines[0]).toBe(`Diagnóstico registrado: "${patient.primaryDiagnosis}".`);
  });

  it("no antepone el diagnóstico para una recomendación condicionada — usa exactamente la evidencia de match.patientEvidence", () => {
    const recommendation = findRecommendationById("ers-rec-pico4")!;
    const patient = basePatient();
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    const lines = patientDatumLines(patient, match, recommendation.applicability);
    expect(lines).toEqual(match.patientEvidence.map(evidenceLine));
    expect(lines.join(" ")).not.toContain("Diagnóstico registrado:");
  });
});

describe("criteriaSummaryText", () => {
  it("para una recomendación general sin ningún criterio evaluado, explica que no se exige ninguno (no 'sin criterios verificables')", () => {
    const recommendation = findRecommendationById("ers-rec-pico1")!;
    const patient = basePatient();
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    const text = criteriaSummaryText(match, recommendation.applicability);
    expect(text).toContain("No se exige ningún criterio clínico adicional");
  });

  it("para una recomendación condicionada sin criterios verificables (caso límite), usa el texto neutro original", () => {
    // Caso sintético: no depende de datos reales de la KB, solo de la lógica de criteriaSummaryText.
    const match = matchPatientToRecommendation(basePatient(), findRecommendationById("ers-rec-pico4")!, AS_OF);
    const emptyMatch = { ...match, matchedCriteria: [], unmatchedCriteria: [], missingCriteria: [], conflictingCriteria: [] };
    expect(criteriaSummaryText(emptyMatch, "conditional")).toBe("Sin criterios verificables asociados a esta recomendación.");
  });
});
