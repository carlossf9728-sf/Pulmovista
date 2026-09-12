import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { computeMissingInfo } from "@/engines/missingInfo";
import type { ConsultationEvent, LabResultsEvent, MicrobiologyEvent, TreatmentStartedEvent } from "@/types/clinicalEvent";
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

  it("'No consta revisión de fisioterapia respiratoria' revisa la NARRATIVA de consulta, no si existe un TreatmentStartedEvent de fisioterapia — un tratamiento de fisioterapia ya pautado no basta para dar por hecho que se revisó en consulta", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<TreatmentStartedEvent>("p1", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2024-01-01", { drug: "fisioterapia respiratoria" }),
    ]);
    const result = computeMissingInfo(patient);
    expect(result.items).toContain("No consta revisión de fisioterapia respiratoria.");
  });

  it("deja de señalar la revisión de fisioterapia cuando la CONSULTA (no el tratamiento) la menciona", () => {
    const patient = basePatient("Bronquiectasias no FQ", [
      mkEvent<ConsultationEvent>("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { rawText: "Se revisa la técnica de fisioterapia respiratoria, correcta." }),
    ]);
    const result = computeMissingInfo(patient);
    expect(result.items).not.toContain("No consta revisión de fisioterapia respiratoria.");
  });

  it("usa el checklist General para diagnósticos no reconocidos", () => {
    expect(computeMissingInfo(basePatient("Asma bronquial")).category).toBe("General");
  });

  /**
   * Normalización diagnóstica centralizada (ver domain/diagnosis.ts#activeProblemCategories):
   * computeMissingInfo ya no clasifica solo por primaryDiagnosis — un problema activo (aquí,
   * Bronquiectasias) que solo conste como diagnóstico SECUNDARIO debe seguir activando tanto el
   * checklist como el módulo de cribado etiológico, nunca caer en "General" teniendo un problema
   * reconocido.
   */
  it("usa las reglas de Bronquiectasias (no 'General') cuando el diagnóstico principal no clasifica pero el secundario sí es bronquiectasias", () => {
    const patient: Patient = { ...basePatient("Otra enfermedad respiratoria no clasificada"), secondaryDiagnoses: "Bronquiectasias por tracción" };
    const result = computeMissingInfo(patient);
    expect(result.category).toBe("Bronquiectasias");
    expect(result.items).toContain("No consta microbiología reciente.");
  });

  it("un diagnóstico principal reconocido (EPOC) con bronquiectasias como SECUNDARIO conserva el checklist de EPOC, pero activa igualmente el módulo de cribado etiológico de bronquiectasias", () => {
    const patient: Patient = { ...basePatient("EPOC (GOLD III)"), secondaryDiagnoses: "Bronquiectasias por tracción" };
    const result = computeMissingInfo(patient);
    // El checklist principal no cambia: EPOC como principal decide "category" igual que antes.
    expect(result.category).toBe("EPOC");
    expect(result.items).toContain("No consta espirometría reciente.");
    // Pero el módulo de bronquiectasias (cribado etiológico) sigue activo — es un problema real del paciente.
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].title).toBe("Estudio etiológico de bronquiectasias incompleto");
  });

  it("sin bronquiectasias en ningún diagnóstico (ni principal ni secundario), nunca aparece el módulo de cribado etiológico", () => {
    const patient: Patient = { ...basePatient("EPOC (GOLD III)"), secondaryDiagnoses: "Fibrosis pulmonar idiopática" };
    const result = computeMissingInfo(patient);
    expect(result.category).toBe("EPOC");
    expect(result.groups).toEqual([]);
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
