import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { computeMissingInfo, computeReviewOpportunities } from "@/engines/missingInfo";
import type { LabResultsEvent, MicrobiologyEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";
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

  /**
   * Las 3 componentes de cribado etiológico están respaldadas por SEPAR
   * 2018, Tabla 1 (separ-def-tabla1-causas): "Déficit de producción de
   * anticuerpos — Inmunoglobulinas", "ABPA" y "Déficit de AAT" — las
   * únicas 3 pruebas de cribado de bronquiectasias que aparecen
   * literalmente en una guía cargada. Se agrupan en `result.groups`, no en
   * `result.items`: es una constatación de qué no consta, con su propia
   * trazabilidad "¿Por qué?", no una orden clínica suelta.
   */
  it("señala inmunoglobulinas, ABPA y alfa-1-antitripsina como ausentes cuando no hay ningún LabResultsEvent con esos parámetros", () => {
    const result = computeMissingInfo(basePatient("Bronquiectasias no FQ"));
    expect(result.groups).toHaveLength(1);
    const group = result.groups[0];
    expect(group.title).toBe("Estudio etiológico de bronquiectasias incompleto");
    expect(group.missingComponents).toEqual(["Inmunoglobulinas / anticuerpos", "Estudio de ABPA", "Alfa-1-antitripsina"]);
    expect(group.explanation).not.toBeNull();
    // kindLabel distinto de "guideline": es una definición/tabla de referencia, no una recomendación graduada.
    expect(group.explanation?.kindLabel).toBe("guideline_definition");
    expect(group.explanation?.source).toMatchObject({
      kind: "guideline_definition",
      guidelineId: "separ-bronchiectasis-2018",
      definitionId: "separ-def-tabla1-causas",
      society: "Sociedad Española de Neumología y Cirugía Torácica (SEPAR)",
      year: 2018,
    });
    expect(group.explanation?.citation?.society).toBe("Sociedad Española de Neumología y Cirugía Torácica (SEPAR)");
    expect(group.explanation?.citation?.year).toBe(2018);
    expect(group.explanation?.citation?.sourceText).toContain("Déficit de producción de anticuerpos");
    // Nunca una orden clínica: ningún texto del grupo debe redactarse como imperativo.
    expect(group.explanation?.sections.every((s) => !/debes? pedir|debe solicitar/i.test(s.text))).toBe(true);
  });

  it("deja de señalar inmunoglobulinas cuando ya consta un parámetro IgG/IgA/IgM de categoría etiológica", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<LabResultsEvent>("p1", CLINICAL_EVENT_TYPES.LAB_RESULTS, "2023-01-01", {
        label: "Estudio etiológico",
        text: "IgG 950 mg/dL.",
        parameters: [{ name: "IgG", valueText: "950 mg/dL", numericValue: 950, unit: "mg/dL", status: "normal", category: "inmunologia" }],
      }),
    ]);
    const result = computeMissingInfo(patient);
    expect(result.groups).toHaveLength(1);
    // ABPA y AAT siguen sin constar — este LabResultsEvent solo trae IgG.
    expect(result.groups[0].missingComponents).toEqual(["Estudio de ABPA", "Alfa-1-antitripsina"]);
  });

  it("deja de señalar ABPA cuando ya consta un parámetro de Aspergillus, y alfa-1-antitripsina cuando ya consta ese parámetro", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<LabResultsEvent>("p1", CLINICAL_EVENT_TYPES.LAB_RESULTS, "2023-01-01", {
        label: "Estudio etiológico",
        text: "Cribado de ABPA e IgE específica Aspergillus negativos. Alfa-1-antitripsina 135 mg/dL.",
        parameters: [
          { name: "IgE específica Aspergillus fumigatus", valueText: "Negativo", status: "normal", category: "aspergillus_abpa" },
          { name: "Alfa-1-antitripsina", valueText: "135 mg/dL", numericValue: 135, unit: "mg/dL", status: "normal", category: "alfa1_antitripsina" },
        ],
      }),
    ]);
    const result = computeMissingInfo(patient);
    // Solo falta inmunoglobulinas — el grupo se mantiene, pero sin ABPA/AAT en missingComponents.
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].missingComponents).toEqual(["Inmunoglobulinas / anticuerpos"]);
  });

  it("un LabResultsEvent sin parámetros estructurados (analítica antigua en texto libre) no cuenta como cribado etiológico constatado", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<LabResultsEvent>("p1", CLINICAL_EVENT_TYPES.LAB_RESULTS, "2023-01-01", {
        label: "Analítica",
        text: "IgG, IgA, IgM y ABPA sin alteraciones.",
      }),
    ]);
    const result = computeMissingInfo(patient);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].missingComponents).toEqual(["Inmunoglobulinas / anticuerpos", "Estudio de ABPA", "Alfa-1-antitripsina"]);
  });

  it("no genera el grupo de cribado etiológico cuando ya constan los 3 componentes", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<LabResultsEvent>("p1", CLINICAL_EVENT_TYPES.LAB_RESULTS, "2023-01-01", {
        label: "Estudio etiológico",
        text: "IgG, ABPA y alfa-1-antitripsina sin alteraciones.",
        parameters: [
          { name: "IgG", valueText: "950 mg/dL", numericValue: 950, unit: "mg/dL", status: "normal", category: "inmunologia" },
          { name: "IgE específica Aspergillus fumigatus", valueText: "Negativo", status: "normal", category: "aspergillus_abpa" },
          { name: "Alfa-1-antitripsina", valueText: "135 mg/dL", numericValue: 135, unit: "mg/dL", status: "normal", category: "alfa1_antitripsina" },
        ],
      }),
    ]);
    const result = computeMissingInfo(patient);
    expect(result.groups).toEqual([]);
  });

  it("no genera el grupo de cribado etiológico para categorías diagnósticas distintas de Bronquiectasias", () => {
    const result = computeMissingInfo(basePatient("EPOC (GOLD III)"));
    expect(result.groups).toEqual([]);
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
