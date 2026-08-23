import { describe, expect, it } from "vitest";
import { activeProblemCategories, classifyDiagnosis } from "@/domain/diagnosis";

describe("classifyDiagnosis", () => {
  it("clasifica bronquiectasias", () => {
    expect(classifyDiagnosis("Bronquiectasias no fibrosis quística")).toBe("Bronquiectasias");
  });
  it("clasifica EPOC", () => {
    expect(classifyDiagnosis("EPOC (GOLD III)")).toBe("EPOC");
  });
  it("clasifica fibrosis pulmonar (fibrosis, EPID o intersticial)", () => {
    expect(classifyDiagnosis("Fibrosis pulmonar idiopática")).toBe("Fibrosis pulmonar");
    expect(classifyDiagnosis("EPID no clasificable")).toBe("Fibrosis pulmonar");
    expect(classifyDiagnosis("Neumonía intersticial")).toBe("Fibrosis pulmonar");
  });
  it("usa General como categoría por defecto", () => {
    expect(classifyDiagnosis("Asma bronquial")).toBe("General");
    expect(classifyDiagnosis("")).toBe("General");
    expect(classifyDiagnosis(undefined)).toBe("General");
  });
});

describe("activeProblemCategories", () => {
  it("incluye la categoría del diagnóstico secundario, no solo del principal", () => {
    const patient = { primaryDiagnosis: "Fibrosis pulmonar idiopática", secondaryDiagnoses: "Bronquiectasias, infección crónica por Pseudomonas" };
    expect(activeProblemCategories(patient).sort()).toEqual(["Bronquiectasias", "Fibrosis pulmonar"].sort());
  });

  it("no duplica una categoría que coincide en principal y secundarios", () => {
    const patient = { primaryDiagnosis: "Bronquiectasias no FQ", secondaryDiagnoses: "Bronquiectasias por tracción" };
    expect(activeProblemCategories(patient)).toEqual(["Bronquiectasias"]);
  });

  it("descarta 'General' cuando hay al menos una categoría reconocida", () => {
    const patient = { primaryDiagnosis: "Bronquiectasias", secondaryDiagnoses: "Asma bronquial leve" };
    expect(activeProblemCategories(patient)).toEqual(["Bronquiectasias"]);
  });

  it("devuelve ['General'] cuando ningún diagnóstico clasifica en una categoría reconocida", () => {
    const patient = { primaryDiagnosis: "Asma bronquial", secondaryDiagnoses: "" };
    expect(activeProblemCategories(patient)).toEqual(["General"]);
  });
});
