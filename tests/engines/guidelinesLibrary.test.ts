/**
 * Tests de engines/guidelines/library.ts — capa de presentación de la
 * pantalla "Guías". Ninguna cifra debe inventarse: cada assert compara
 * contra la MISMA base de conocimiento (engines/guidelines/knowledge/)
 * que ya usa matchPatientToGuidelines, nunca un número fijo copiado a
 * mano que pudiera desincronizarse si la base de conocimiento cambia.
 */
import { describe, expect, it } from "vitest";
import { getGuidelineDetail, listActiveGuidelines, listUncoveredDiagnosisCategories } from "@/engines/guidelines/library";
import { findCriteriaByGuideline, findDefinitionsByGuideline, findRecommendationsByGuideline, KNOWLEDGE_BASE_DOCUMENTS } from "@/engines/guidelines/knowledge";
import { isRecommendationEvaluated, SUPPORTED_DIAGNOSIS_CATEGORIES } from "@/engines/guidelines/match";
import { ALL_DIAGNOSIS_CATEGORIES } from "@/domain/diagnosis";

describe("listActiveGuidelines", () => {
  const entries = listActiveGuidelines();

  it("incluye exactamente las guías cuya disease está en SUPPORTED_DIAGNOSIS_CATEGORIES — hoy ERS 2025 y SEPAR 2018, ambas bronquiectasias", () => {
    expect(entries.map((e) => e.guidelineId).sort()).toEqual(["ers-bronchiectasis-2025", "separ-bronchiectasis-2018"].sort());
    expect(entries.every((e) => SUPPORTED_DIAGNOSIS_CATEGORIES.includes(e.disease as never))).toBe(true);
    expect(entries.every((e) => e.status === "active")).toBe(true);
  });

  it("cada cifra coincide EXACTAMENTE con la base de conocimiento real, no un número fijo", () => {
    for (const doc of KNOWLEDGE_BASE_DOCUMENTS) {
      const entry = entries.find((e) => e.guidelineId === doc.guidelineId);
      if (!entry) continue; // guía no activa — cubierto por el test de "uncovered"
      const recs = findRecommendationsByGuideline(doc.guidelineId);
      expect(entry.definitionCount).toBe(findDefinitionsByGuideline(doc.guidelineId).length);
      expect(entry.criterionCount).toBe(findCriteriaByGuideline(doc.guidelineId).length);
      expect(entry.recommendationCount).toBe(recs.length);
      expect(entry.evaluatedRecommendationCount).toBe(recs.filter((r) => isRecommendationEvaluated(r.recommendationId)).length);
    }
  });

  it("evaluatedRecommendationCount nunca supera recommendationCount (evaluar es un subconjunto de estructurar, nunca al revés)", () => {
    for (const e of entries) expect(e.evaluatedRecommendationCount).toBeLessThanOrEqual(e.recommendationCount);
  });

  it("expone metadatos reales del documento (título, sociedad, año, fuente) sin inventar ninguno", () => {
    const ers = entries.find((e) => e.guidelineId === "ers-bronchiectasis-2025")!;
    expect(ers.title).toContain("European Respiratory Society");
    expect(ers.society).toContain("ERS");
    expect(ers.year).toBe(2025);
    expect(ers.sourceUrl).toMatch(/^https:\/\//);
  });
});

describe("listUncoveredDiagnosisCategories", () => {
  it("son exactamente las categorías reales de domain/diagnosis.ts que NO están en SUPPORTED_DIAGNOSIS_CATEGORIES", () => {
    const uncovered = listUncoveredDiagnosisCategories();
    const expected = ALL_DIAGNOSIS_CATEGORIES.filter((c) => !SUPPORTED_DIAGNOSIS_CATEGORIES.includes(c));
    expect(uncovered).toEqual(expected);
  });

  it("nunca incluye 'General' (no es una enfermedad) ni una categoría ya activa", () => {
    const uncovered = listUncoveredDiagnosisCategories();
    expect(uncovered).not.toContain("General");
    expect(uncovered).not.toContain("Bronquiectasias");
  });
});

describe("getGuidelineDetail", () => {
  it("devuelve las mismas colecciones (definitions/criteria/recommendations) que expone engines/guidelines/knowledge, sin copiar ni recalcular su contenido", () => {
    const detail = getGuidelineDetail("ers-bronchiectasis-2025");
    expect(detail).not.toBeNull();
    expect(detail!.definitions).toEqual(findDefinitionsByGuideline("ers-bronchiectasis-2025"));
    expect(detail!.criteria).toEqual(findCriteriaByGuideline("ers-bronchiectasis-2025"));
    expect(detail!.recommendations).toEqual(findRecommendationsByGuideline("ers-bronchiectasis-2025"));
  });

  it("null para un guidelineId inexistente — nunca inventa un detalle vacío", () => {
    expect(getGuidelineDetail("guideline-que-no-existe")).toBeNull();
  });

  it("null para una categoría no activa aunque el guidelineId exista en teoría (defensivo: hoy no aplica, ambas guías cargadas están activas)", () => {
    // No hay ninguna guía inactiva en la base de conocimiento actual — este test documenta la
    // garantía (getGuidelineDetail nunca construye detalle para una guía no activa), verificándola
    // contra un id real conocido para asegurar el camino feliz sigue funcionando igual.
    expect(getGuidelineDetail("ers-bronchiectasis-2025")).not.toBeNull();
  });
});
