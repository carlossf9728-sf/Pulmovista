import { describe, expect, it } from "vitest";
import { findGuidelinesForDiagnosis, GUIDELINES, matchGuidelines } from "@/engines/guidelines";
import type { Patient } from "@/types/patient";

describe("GuidelineEngine (stub)", () => {
  it("GUIDELINES contiene solo contenido simulado, marcado como tal", () => {
    for (const g of GUIDELINES) {
      for (const rec of g.recommendations) {
        expect(rec.recommendationText).toContain("Contenido simulado");
      }
    }
  });

  it("findGuidelinesForDiagnosis filtra por categoría diagnóstica", () => {
    const results = findGuidelinesForDiagnosis("Bronquiectasias no FQ");
    expect(results.every((g) => g.definition.disease === "Bronquiectasias")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("findGuidelinesForDiagnosis devuelve [] para categorías sin guía cargada (General)", () => {
    expect(findGuidelinesForDiagnosis("Asma bronquial")).toEqual([]);
  });

  it("matchGuidelines es un stub: siempre devuelve [] en esta fase", () => {
    const patient = { id: "p1", code: "PV-TEST-0007", sex: "Mujer", age: 58, primaryDiagnosis: "EPOC", secondaryDiagnoses: "", createdAt: "2023-01-01", events: [] } satisfies Patient;
    expect(matchGuidelines(patient)).toEqual([]);
  });
});
