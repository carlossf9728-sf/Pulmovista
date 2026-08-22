import { describe, expect, it } from "vitest";
import { classifyDiagnosis } from "@/domain/diagnosis";

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
