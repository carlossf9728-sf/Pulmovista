/**
 * Tests de engines/guidelines/explain.ts — helpers de presentación sobre
 * GuidelineMatch. Cubren la distinción general/condicionada (una
 * recomendación general nunca debe leerse como si exigiera un criterio
 * clínico) y el resumen clínico de "Dato del paciente" (una frase legible
 * por criterio, nunca un evento por línea) e "Interpretación de
 * PulmoVista" (siempre nombra el criterio concreto, nunca la frase
 * genérica "cumple el criterio clínico" sin decir cuál).
 */
import { describe, expect, it } from "vitest";
import { criteriaSummaryText, criterionLine, evidenceLine, interpretationSentence, patientDatumLines } from "@/engines/guidelines/explain";
import { findRecommendationById } from "@/engines/guidelines/knowledge";
import { matchPatientToRecommendation } from "@/engines/guidelines/match";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import type { ExacerbationEvent, MicrobiologyEvent } from "@/types/clinicalEvent";
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

function exac(patientId: string, date: string, severity: string, hospitalization = false): ExacerbationEvent {
  return mkEvent<ExacerbationEvent>(patientId, CLINICAL_EVENT_TYPES.EXACERBATION, date, { severity, hospitalization });
}

function culture(patientId: string, date: string, organism: string): MicrobiologyEvent {
  return mkEvent<MicrobiologyEvent>(patientId, CLINICAL_EVENT_TYPES.MICROBIOLOGY, date, {
    sampleType: "Esputo",
    organism,
    sensitivity: [],
    resistance: [],
  });
}

const AS_OF = "2026-06-01";

describe("interpretationSentence — recomendaciones GENERALES", () => {
  it("nunca dice 'cumple el criterio clínico' para una recomendación sin ningún criterio (ers-rec-pico1)", () => {
    const recommendation = findRecommendationById("ers-rec-pico1")!;
    expect(recommendation.applicability).toBe("general");
    const match = matchPatientToRecommendation(basePatient(), recommendation, AS_OF);
    expect(match.status).toBe("applies");

    const sentence = interpretationSentence(match, recommendation.applicability);
    expect(sentence).not.toContain("cumple el criterio clínico");
    expect(sentence).toContain("aplica de forma general");
  });

  it("nombra la exclusión concreta (no una frase genérica) para una recomendación general con exclusión (separ-rec-corticoides-no-rutina)", () => {
    const recommendation = findRecommendationById("separ-rec-corticoides-no-rutina")!;
    expect(recommendation.applicability).toBe("general");
    const patientWithAsma = basePatient({ secondaryDiagnoses: "Asma bronquial leve" });
    const match = matchPatientToRecommendation(patientWithAsma, recommendation, AS_OF);
    expect(match.status).toBe("does_not_apply");

    const sentence = interpretationSentence(match, recommendation.applicability);
    expect(sentence).not.toContain("cumple el criterio clínico");
    expect(sentence).toContain("aplica de forma general");
    expect(sentence).toContain(criterionLine("separ-crit-corticoides-poblacion"));
  });
});

describe("interpretationSentence — recomendaciones CONDICIONADAS", () => {
  it("nombra el criterio concreto que cumple, nunca una frase genérica sin decir cuál (ers-rec-pico6, primer aislamiento de P. aeruginosa)", () => {
    const recommendation = findRecommendationById("ers-rec-pico6")!;
    expect(recommendation.applicability).toBe("conditional");
    const patient = basePatient({ events: [culture("p-explain", "2026-01-01", "Pseudomonas aeruginosa")] });
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    expect(match.status).toBe("applies");

    const sentence = interpretationSentence(match, recommendation.applicability);
    expect(sentence).not.toContain("cumple el criterio clínico de la guía para esta recomendación.");
    expect(sentence).toContain(criterionLine("ers-crit-new-pseudomonas-isolation"));
  });

  it("nombra el criterio concreto que falta cuando el estado es información insuficiente (prerrequisito de NTM sin comprobar)", () => {
    const recommendation = findRecommendationById("ers-rec-pico4")!;
    const patient = basePatient({
      events: [exac("p-explain", "2025-08-01", "Moderada"), exac("p-explain", "2026-01-01", "Grave", true)],
    });
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    expect(match.status).toBe("insufficient_data");

    const sentence = interpretationSentence(match, recommendation.applicability);
    expect(sentence).toContain(criterionLine("ers-crit-ntm-excluded-before-macrolide"));
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

  it("no antepone el diagnóstico para una recomendación condicionada", () => {
    const recommendation = findRecommendationById("ers-rec-pico4")!;
    const patient = basePatient();
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    const lines = patientDatumLines(patient, match, recommendation.applicability);
    expect(lines.join(" ")).not.toContain("Diagnóstico registrado:");
  });

  it("resume varias exacerbaciones en una única frase clínica, en vez de listar cada evento por separado", () => {
    const recommendation = findRecommendationById("ers-rec-pico4")!;
    const patient = basePatient({
      events: [
        exac("p-explain", "2025-08-01", "Leve"),
        exac("p-explain", "2025-11-01", "Moderada"),
        exac("p-explain", "2026-02-05", "Grave", true),
        exac("p-explain", "2026-05-01", "Leve"),
      ],
    });
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    const lines = patientDatumLines(patient, match, recommendation.applicability);
    // El ejemplo pedido explícitamente: una frase clínica clara, no 4 líneas con fecha por evento.
    expect(lines).toContain("4 exacerbaciones en el último año, incluida 1 grave con ingreso hospitalario.");
    expect(lines.some((l) => /^\d{2}\/\d{2}\/\d{4}/.test(l))).toBe(false);
  });

  it("resume varios cultivos positivos en una única frase clínica (ers-crit-chronic-pseudomonas, dentro de ers-rec-pico3-with-pa)", () => {
    const recommendation = findRecommendationById("ers-rec-pico3-with-pa")!;
    const patient = basePatient({
      events: [culture("p-explain", "2025-01-01", "Pseudomonas aeruginosa"), culture("p-explain", "2025-06-01", "Pseudomonas aeruginosa")],
    });
    const match = matchPatientToRecommendation(patient, recommendation, AS_OF);
    const lines = patientDatumLines(patient, match, recommendation.applicability);
    expect(lines.some((l) => /^2 cultivos positivos para Pseudomonas aeruginosa registrados\.$/.test(l))).toBe(true);
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

describe("evidenceLine", () => {
  it("sigue disponible para trazabilidad interna aunque ya no se muestre en el modal '¿Por qué?'", () => {
    expect(evidenceLine({ label: "Cultivo positivo: Pseudomonas aeruginosa", date: "2025-01-01" })).toContain("Cultivo positivo");
  });
});
