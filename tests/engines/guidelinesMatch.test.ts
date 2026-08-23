/**
 * Tests de GuidelineMatch (engines/guidelines/match.ts) contra pacientes
 * SINTÉTICOS. Cubren los 5 temas pedidos —macrólidos, antibióticos
 * inhalados, erradicación de Pseudomonas, corticoides inhalados y
 * fisioterapia/aclaramiento de vía aérea— con al menos un caso de cada
 * categoría en el conjunto: cumple claramente (applies), no cumple
 * (does_not_apply), faltan datos (insufficient_data) y situación
 * ambigua (possibly_applies). No se evalúa si la recomendación médica
 * "es correcta", solo que el motor deriva el status correcto a partir
 * de los datos estructurados del paciente y las citas de la guía.
 */
import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { findRecommendationById, KNOWLEDGE_BASE_RECOMMENDATIONS } from "@/engines/guidelines/knowledge";
import { matchPatientToGuidelines, matchPatientToRecommendation, SUPPORTED_TOPICS } from "@/engines/guidelines/match";
import type { ExacerbationEvent, MicrobiologyEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

const AS_OF = "2026-06-01";

function makePatient(id: string, events: Patient["events"], extra: Partial<Patient> = {}): Patient {
  return {
    id,
    code: `PV-TEST-${id}`,
    sex: "Mujer",
    age: 60,
    primaryDiagnosis: "Bronquiectasias",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
    ...extra,
  };
}

function exac(patientId: string, date: string, severity = "Leve", hospitalization = false): ExacerbationEvent {
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

function rec(id: string) {
  const r = findRecommendationById(id);
  if (!r) throw new Error(`fixture inválido: recommendationId "${id}" no existe`);
  return r;
}

describe("Macrólidos", () => {
  it("faltan datos (ERS): alto riesgo confirmado, pero sin comprobación de exclusión de NTM — antes se devolvía \"applies\" por error", () => {
    const patient = makePatient("macro-missing-ntm", [exac("macro-missing-ntm", "2025-08-01"), exac("macro-missing-ntm", "2026-01-01")]);
    const match = matchPatientToRecommendation(patient, rec("ers-rec-pico4"), AS_OF);
    // ers-crit-ntm-excluded-before-macrolide es un PRERREQUISITO (no una
    // exclusión): no poder confirmar que se excluyó NTM impide "applies",
    // aunque el criterio de indicación (alto riesgo) esté confirmado.
    expect(match.status).toBe("insufficient_data");
    expect(match.matchedCriteria).toEqual(["ers-crit-high-risk-exacerbation"]);
    expect(match.missingCriteria).toEqual(["ers-crit-ntm-excluded-before-macrolide"]);
    expect(match.conflictingCriteria).toEqual([]);
    expect(match.guidelineCitation.guidelineId).toBe("ers-bronchiectasis-2025");
    expect(match.patientEvidence.length).toBeGreaterThan(0);

    // La misma exposición evaluada en SEPAR: el criterio SEPAR exige además
    // estabilidad clínica y tratamiento de base correcto, no verificables.
    const separMatch = matchPatientToRecommendation(patient, rec("separ-rec-macrolidos"), AS_OF);
    expect(separMatch.status).toBe("insufficient_data");
    expect(separMatch.missingCriteria).toEqual(["separ-crit-macrolidos-poblacion"]);
  });

  it("no cumple (ERS): evidencia de NTM (prerrequisito NO cumplido) bloquea la recomendación aunque el resto de criterios se cumplan", () => {
    const patient = makePatient("macro-ntm", [
      exac("macro-ntm", "2025-08-01"),
      exac("macro-ntm", "2026-01-01"),
      culture("macro-ntm", "2025-09-01", "Mycobacterium avium"),
    ]);
    const match = matchPatientToRecommendation(patient, rec("ers-rec-pico4"), AS_OF);
    expect(match.status).toBe("does_not_apply");
    expect(match.matchedCriteria).toEqual(["ers-crit-high-risk-exacerbation"]);
    // El prerrequisito NO cumplido va a unmatchedCriteria, no a
    // conflictingCriteria — esa lista queda reservada para `exclusions`.
    expect(match.unmatchedCriteria).toEqual(["ers-crit-ntm-excluded-before-macrolide"]);
    expect(match.conflictingCriteria).toEqual([]);
  });

  it("faltan datos: 1 sola exacerbación no grave — no se puede confirmar ni descartar la rama de síntomas diarios graves", () => {
    const patient = makePatient("macro-missing", [exac("macro-missing", "2026-01-01")]);
    const match = matchPatientToRecommendation(patient, rec("ers-rec-pico4"), AS_OF);
    expect(match.status).toBe("insufficient_data");
    expect(match.missingCriteria.sort()).toEqual(["ers-crit-high-risk-exacerbation", "ers-crit-ntm-excluded-before-macrolide"]);
  });

  it("no cumple: sin exacerbaciones en el año previo, en ambas guías", () => {
    const patient = makePatient("macro-none", []);
    expect(matchPatientToRecommendation(patient, rec("ers-rec-pico4"), AS_OF).status).toBe("does_not_apply");
    expect(matchPatientToRecommendation(patient, rec("separ-rec-macrolidos"), AS_OF).status).toBe("does_not_apply");
  });
});

describe("Antibióticos inhalados", () => {
  it("cumple claramente (sin P. aeruginosa): alto riesgo de exacerbación confirmado", () => {
    const patient = makePatient("inh-applies", [exac("inh-applies", "2025-08-01"), exac("inh-applies", "2026-01-01")]);
    const withoutPa = matchPatientToRecommendation(patient, rec("ers-rec-pico3-without-pa"), AS_OF);
    expect(withoutPa.status).toBe("applies");

    // El mismo paciente, sin ningún cultivo de Pseudomonas, no cumple la
    // variante "con P. aeruginosa" (criterio de infección crónica no cumplido).
    const withPa = matchPatientToRecommendation(patient, rec("ers-rec-pico3-with-pa"), AS_OF);
    expect(withPa.status).toBe("does_not_apply");
    expect(withPa.unmatchedCriteria).toEqual(["ers-crit-chronic-pseudomonas"]);
  });

  it("no cumple: sin alto riesgo de exacerbación y sin Pseudomonas", () => {
    const patient = makePatient("inh-none", []);
    expect(matchPatientToRecommendation(patient, rec("ers-rec-pico3-without-pa"), AS_OF).status).toBe("does_not_apply");
    expect(matchPatientToRecommendation(patient, rec("ers-rec-pico3-with-pa"), AS_OF).status).toBe("does_not_apply");
  });

  it("faltan datos: 1 exacerbación no grave deja \"alto riesgo\" sin confirmar", () => {
    const patient = makePatient("inh-missing", [exac("inh-missing", "2026-01-01")]);
    const withoutPa = matchPatientToRecommendation(patient, rec("ers-rec-pico3-without-pa"), AS_OF);
    expect(withoutPa.status).toBe("insufficient_data");
    expect(withoutPa.missingCriteria).toEqual(["ers-crit-high-risk-exacerbation"]);
  });

  it("situación ambigua: alto riesgo confirmado + ≥2 aislamientos de P. aeruginosa, pero la guía no cuantifica \"crónica\"", () => {
    const patient = makePatient("inh-ambiguous", [
      exac("inh-ambiguous", "2025-08-01"),
      exac("inh-ambiguous", "2026-01-01"),
      culture("inh-ambiguous", "2024-01-01", "Pseudomonas aeruginosa"),
      culture("inh-ambiguous", "2025-09-01", "Pseudomonas aeruginosa"),
    ]);
    const withPa = matchPatientToRecommendation(patient, rec("ers-rec-pico3-with-pa"), AS_OF);
    expect(withPa.status).toBe("possibly_applies");
    expect(withPa.matchedCriteria.sort()).toEqual(["ers-crit-chronic-pseudomonas", "ers-crit-high-risk-exacerbation"]);
    expect(withPa.unmatchedCriteria).toEqual([]);
    expect(withPa.missingCriteria).toEqual([]);
  });
});

describe("Erradicación de Pseudomonas", () => {
  it("cumple claramente en ambas guías: primer y único aislamiento de P. aeruginosa", () => {
    const patient = makePatient("erad-applies", [culture("erad-applies", "2026-05-01", "Pseudomonas aeruginosa")]);
    const ers = matchPatientToRecommendation(patient, rec("ers-rec-pico6"), AS_OF);
    const separ = matchPatientToRecommendation(patient, rec("separ-rec-erradicacion-primoinfeccion"), AS_OF);
    expect(ers.status).toBe("applies");
    expect(separ.status).toBe("applies");
    expect(ers.matchedCriteria).toEqual(["ers-crit-new-pseudomonas-isolation"]);
    expect(separ.matchedCriteria).toEqual(["separ-crit-primoinfeccion-pa"]);
  });

  it("no cumple: nunca se ha aislado P. aeruginosa (hay otros cultivos)", () => {
    const patient = makePatient("erad-never", [culture("erad-never", "2025-01-01", "Haemophilus influenzae")]);
    expect(matchPatientToRecommendation(patient, rec("ers-rec-pico6"), AS_OF).status).toBe("does_not_apply");
    expect(matchPatientToRecommendation(patient, rec("separ-rec-erradicacion-primoinfeccion"), AS_OF).status).toBe("does_not_apply");
  });

  it("no cumple: infección persistente sin cultivo negativo intermedio — no es un nuevo aislamiento", () => {
    const patient = makePatient("erad-persisting", [
      culture("erad-persisting", "2025-01-01", "Pseudomonas aeruginosa"),
      culture("erad-persisting", "2025-07-01", "Pseudomonas aeruginosa"),
    ]);
    const ers = matchPatientToRecommendation(patient, rec("ers-rec-pico6"), AS_OF);
    expect(ers.status).toBe("does_not_apply");
    expect(ers.unmatchedCriteria).toEqual(["ers-crit-new-pseudomonas-isolation"]);
  });

  it("faltan datos: sin ningún cultivo microbiológico registrado", () => {
    const patient = makePatient("erad-missing", []);
    expect(matchPatientToRecommendation(patient, rec("ers-rec-pico6"), AS_OF).status).toBe("insufficient_data");
    expect(matchPatientToRecommendation(patient, rec("separ-rec-erradicacion-primoinfeccion"), AS_OF).status).toBe("insufficient_data");
  });

  it("situación ambigua: ERS y SEPAR DIVERGEN sobre el mismo dato — reaislamiento tras un cultivo negativo intermedio", () => {
    const patient = makePatient("erad-ambiguous", [
      culture("erad-ambiguous", "2025-01-01", "Pseudomonas aeruginosa"),
      culture("erad-ambiguous", "2025-07-01", "Haemophilus influenzae"),
      culture("erad-ambiguous", "2026-02-01", "Pseudomonas aeruginosa"),
    ]);
    const ers = matchPatientToRecommendation(patient, rec("ers-rec-pico6"), AS_OF);
    const separ = matchPatientToRecommendation(patient, rec("separ-rec-erradicacion-primoinfeccion"), AS_OF);
    // ERS matiza explícitamente el reaislamiento tras un periodo sin detectarse (sin cuantificarlo) → posible, no confirmado.
    expect(ers.status).toBe("possibly_applies");
    expect(ers.matchedCriteria).toEqual(["ers-crit-new-pseudomonas-isolation"]);
    // SEPAR solo habla de "primer cultivo positivo" — un segundo aislamiento ya no es primoinfección, sin matiz de plazo.
    expect(separ.status).toBe("does_not_apply");
    expect(separ.unmatchedCriteria).toEqual(["separ-crit-primoinfeccion-pa"]);
    // No fusionadas: cada match cita su propia guía.
    expect(ers.guidelineCitation.guidelineId).toBe("ers-bronchiectasis-2025");
    expect(separ.guidelineCitation.guidelineId).toBe("separ-bronchiectasis-2018");
  });
});

describe("Corticoides inhalados", () => {
  it('SEPAR "no cumple" (la excepción por asma DESACTIVA la recomendación negativa, nunca la convierte en positiva) / ERS "no cumple" también, sobre el mismo paciente', () => {
    const patient = makePatient("cort-asma", [], { secondaryDiagnoses: "Asma bronquial leve" });
    const separ = matchPatientToRecommendation(patient, rec("separ-rec-corticoides-no-rutina"), AS_OF);
    // separ-crit-corticoides-poblacion es una EXCLUSIÓN de "no rutina", no
    // una indicación: con asma confirmada, la prohibición de uso rutinario
    // deja de regir para este paciente — el resultado es does_not_apply,
    // NUNCA una lectura de "SEPAR recomienda ICS" (el texto no lo afirma).
    expect(separ.status).toBe("does_not_apply");
    expect(separ.conflictingCriteria).toEqual(["separ-crit-corticoides-poblacion"]);
    expect(separ.matchedCriteria).toEqual([]);
    // recommendationText sigue siendo el enunciado negativo original — el
    // motor no lo reescribe ni lo invierte.
    expect(rec("separ-rec-corticoides-no-rutina").recommendationText).toMatch(/^No se recomienda/);

    // ERS solo recomienda EN CONTRA de los ICS en pacientes SIN asma/EPOC:
    // con asma confirmada, esta guía tampoco aplica a este paciente (aquí
    // el criterio SÍ es de indicación de la propia guía, no una excepción).
    const ers = matchPatientToRecommendation(patient, rec("ers-rec-pico7"), AS_OF);
    expect(ers.status).toBe("does_not_apply");
    expect(ers.unmatchedCriteria).toEqual(["ers-crit-no-asthma-copd"]);
  });

  it('SEPAR "cumple" (sin excepción confirmada, la recomendación negativa rige) / ERS "situación ambigua", sobre el mismo paciente: ninguna comorbilidad registrada', () => {
    const patient = makePatient("cort-none", []);
    const separ = matchPatientToRecommendation(patient, rec("separ-rec-corticoides-no-rutina"), AS_OF);
    // Sin asma/HRB/broncorrea confirmada, la exclusión no se cumple (queda
    // "missing", pero una exclusión en "missing" no bloquea, igual que en
    // el resto del modelo) → la prohibición de uso rutinario es la que
    // rige por defecto para este paciente.
    expect(separ.status).toBe("applies");
    expect(separ.matchedCriteria).toEqual([]);
    expect(separ.conflictingCriteria).toEqual([]);
    expect(separ.patientEvidence.length).toBeGreaterThan(0);

    // Ausencia de mención de asma/EPOC no es una negación explícita — no se asume el "sin asma ni EPOC" de ERS.
    const ers = matchPatientToRecommendation(patient, rec("ers-rec-pico7"), AS_OF);
    expect(ers.status).toBe("possibly_applies");
    expect(ers.matchedCriteria).toEqual(["ers-crit-no-asthma-copd"]);
  });
});

describe("Fisioterapia / aclaramiento de vía aérea", () => {
  it("cumple claramente (ERS): recomendación sin criterios de población, aplica a todo paciente con bronquiectasias", () => {
    const patient = makePatient("fisio-applies", []);
    const match = matchPatientToRecommendation(patient, rec("ers-rec-pico1"), AS_OF);
    expect(match.status).toBe("applies");
    expect(match.matchedCriteria).toEqual([]);
    expect(match.missingCriteria).toEqual([]);
  });

  it("no cumple (SEPAR): paciente menor de edad — la recomendación SEPAR se limita explícitamente a adultos", () => {
    const patient = makePatient("fisio-minor", [], { age: 15 });
    const separ = matchPatientToRecommendation(patient, rec("separ-rec-drenaje-secreciones"), AS_OF);
    expect(separ.status).toBe("does_not_apply");
    expect(separ.unmatchedCriteria).toEqual(["separ-crit-drenaje-secreciones-poblacion"]);

    // ERS no matiza por edad en su propio texto — no se le añade una restricción que no declara.
    const ers = matchPatientToRecommendation(patient, rec("ers-rec-pico1"), AS_OF);
    expect(ers.status).toBe("applies");
  });

  it("faltan datos: adulto sin más datos — SEPAR no puede confirmar estabilidad clínica ni tos productiva; ERS no puede confirmar fracaso del aclaramiento", () => {
    const patient = makePatient("fisio-adult", [], { age: 45 });
    const separ = matchPatientToRecommendation(patient, rec("separ-rec-drenaje-secreciones"), AS_OF);
    expect(separ.status).toBe("insufficient_data");
    expect(separ.missingCriteria).toEqual(["separ-crit-drenaje-secreciones-poblacion"]);

    const ersMucoactive = matchPatientToRecommendation(patient, rec("ers-rec-pico2-mucoactive"), AS_OF);
    expect(ersMucoactive.status).toBe("insufficient_data");
    expect(ersMucoactive.missingCriteria).toEqual(["ers-crit-airway-clearance-failed"]);
  });
});

describe("Integración: matchPatientToGuidelines", () => {
  it("evalúa las 11 recomendaciones soportadas de los 5 temas iniciales, para un paciente con bronquiectasias", () => {
    const patient = makePatient("integration", [exac("integration", "2026-01-01"), exac("integration", "2025-08-01")]);
    const matches = matchPatientToGuidelines(patient, AS_OF);
    expect(matches).toHaveLength(11);
    expect(SUPPORTED_TOPICS).toEqual([
      "macrólidos",
      "antibióticos inhalados",
      "erradicación de Pseudomonas",
      "corticoides inhalados",
      "fisioterapia/aclaramiento de vía aérea",
    ]);
  });

  it("devuelve [] para un paciente sin bronquiectasias ni como diagnóstico principal ni secundario", () => {
    const patient = makePatient("other-dx", [], { primaryDiagnosis: "EPOC grave" });
    expect(matchPatientToGuidelines(patient, AS_OF)).toEqual([]);
  });

  it("evalúa recomendaciones aunque bronquiectasias conste solo como diagnóstico SECUNDARIO (no depende únicamente de primaryDiagnosis)", () => {
    const patient = makePatient("secondary-dx", [], { primaryDiagnosis: "Fibrosis pulmonar idiopática", secondaryDiagnoses: "Bronquiectasias por tracción" });
    expect(matchPatientToGuidelines(patient, AS_OF)).toHaveLength(11);
  });

  it("ERS y SEPAR se evalúan por separado: cada GuidelineMatch cita una única guía, nunca fusionada", () => {
    const patient = makePatient("separation", [
      exac("separation", "2025-08-01"),
      exac("separation", "2026-01-01"),
      culture("separation", "2026-05-01", "Pseudomonas aeruginosa"),
    ]);
    const matches = matchPatientToGuidelines(patient, AS_OF);
    for (const match of matches) {
      const recommendation = findRecommendationById(match.recommendationId);
      expect(recommendation).toBeDefined();
      expect(match.guidelineCitation.guidelineId).toBe(recommendation?.guidelineId);
      expect(["ers-bronchiectasis-2025", "separ-bronchiectasis-2018"]).toContain(match.guidelineCitation.guidelineId);
    }
  });

  it("todo criterionId referenciado en un GuidelineMatch pertenece a la guía citada (sin cruces ERS/SEPAR)", () => {
    const patient = makePatient("no-cross", [
      exac("no-cross", "2025-08-01"),
      exac("no-cross", "2026-01-01"),
      culture("no-cross", "2024-01-01", "Pseudomonas aeruginosa"),
      culture("no-cross", "2025-09-01", "Pseudomonas aeruginosa"),
    ]);
    const matches = matchPatientToGuidelines(patient, AS_OF);
    for (const match of matches) {
      for (const criterionId of [...match.matchedCriteria, ...match.unmatchedCriteria, ...match.missingCriteria, ...match.conflictingCriteria]) {
        const isErs = criterionId.startsWith("ers-crit-");
        const isSepar = criterionId.startsWith("separ-crit-");
        expect(isErs || isSepar).toBe(true);
        if (match.guidelineCitation.guidelineId === "ers-bronchiectasis-2025") expect(isErs).toBe(true);
        if (match.guidelineCitation.guidelineId === "separ-bronchiectasis-2018") expect(isSepar).toBe(true);
      }
    }
  });

  it("no lanza excepción para ninguna recomendación soportada, incluso sin datos del paciente", () => {
    const empty = makePatient("empty", []);
    const supportedIds = new Set(
      ["ers-rec-pico4", "separ-rec-macrolidos", "ers-rec-pico3-with-pa", "ers-rec-pico3-without-pa", "ers-rec-pico6", "separ-rec-erradicacion-primoinfeccion", "ers-rec-pico7", "separ-rec-corticoides-no-rutina", "ers-rec-pico1", "ers-rec-pico2-mucoactive", "separ-rec-drenaje-secreciones"],
    );
    for (const recommendation of KNOWLEDGE_BASE_RECOMMENDATIONS.filter((r) => supportedIds.has(r.recommendationId))) {
      expect(() => matchPatientToRecommendation(empty, recommendation, AS_OF)).not.toThrow();
    }
  });
});
