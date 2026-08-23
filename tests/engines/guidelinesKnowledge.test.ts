/**
 * Tests de integridad ESTRUCTURAL de la base de conocimiento (ERS 2025 +
 * SEPAR 2018). Deliberadamente NO evalúan si una recomendación médica
 * "es correcta" — solo que la trazabilidad y las referencias internas
 * son consistentes: IDs únicos, cada elemento cita una guía existente,
 * las referencias entre entidades son válidas, y no hay fuerza/evidencia
 * atribuida a una actuación hija que la guía no gradúa individualmente.
 */
import { describe, expect, it } from "vitest";
import {
  ERS_2025_CRITERIA,
  ERS_2025_DEFINITIONS,
  ERS_2025_DOCUMENT,
  ERS_2025_GUIDELINE_ID,
  ERS_2025_RECOMMENDATIONS,
  KNOWLEDGE_BASE_CRITERIA,
  KNOWLEDGE_BASE_DEFINITIONS,
  KNOWLEDGE_BASE_DOCUMENTS,
  KNOWLEDGE_BASE_RECOMMENDATIONS,
  SEPAR_2018_CRITERIA,
  SEPAR_2018_DEFINITIONS,
  SEPAR_2018_DOCUMENT,
  SEPAR_2018_GUIDELINE_ID,
  SEPAR_2018_RECOMMENDATIONS,
  findChildRecommendations,
} from "@/engines/guidelines/knowledge";

const GUIDELINE_IDS = new Set(KNOWLEDGE_BASE_DOCUMENTS.map((d) => d.guidelineId));
const DEFINITION_IDS = new Set(KNOWLEDGE_BASE_DEFINITIONS.map((d) => d.definitionId));
const CRITERION_IDS = new Set(KNOWLEDGE_BASE_CRITERIA.map((c) => c.criterionId));
const RECOMMENDATION_IDS = new Set(KNOWLEDGE_BASE_RECOMMENDATIONS.map((r) => r.recommendationId));

const PAGE_RANGE: Record<string, [number, number]> = {
  [ERS_2025_GUIDELINE_ID]: [1, 34],
  [SEPAR_2018_GUIDELINE_ID]: [88, 98],
};

describe("Documentos", () => {
  it("hay exactamente 2 guías registradas (ERS 2025 y SEPAR 2018), sin fusionarlas", () => {
    expect(KNOWLEDGE_BASE_DOCUMENTS).toHaveLength(2);
    expect(GUIDELINE_IDS).toEqual(new Set([ERS_2025_GUIDELINE_ID, SEPAR_2018_GUIDELINE_ID]));
  });

  it("cada documento tiene fuente bibliográfica completa (sociedad, título, año)", () => {
    for (const doc of KNOWLEDGE_BASE_DOCUMENTS) {
      expect(doc.source.society.length).toBeGreaterThan(0);
      expect(doc.source.title.length).toBeGreaterThan(0);
      expect(doc.source.year).toBeGreaterThan(2000);
    }
  });
});

describe("Namespaces de ID separados entre tipos de entidad", () => {
  it("ningún id se reutiliza entre GuidelineDefinition, GuidelineCriterion y GuidelineRecommendation", () => {
    for (const id of DEFINITION_IDS) {
      expect(CRITERION_IDS.has(id)).toBe(false);
      expect(RECOMMENDATION_IDS.has(id)).toBe(false);
    }
  });
});

describe("IDs únicos", () => {
  it("no hay definitionId duplicados", () => {
    const ids = KNOWLEDGE_BASE_DEFINITIONS.map((d) => d.definitionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("no hay criterionId duplicados", () => {
    const ids = KNOWLEDGE_BASE_CRITERIA.map((c) => c.criterionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("no hay recommendationId duplicados", () => {
    const ids = KNOWLEDGE_BASE_RECOMMENDATIONS.map((r) => r.recommendationId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Cada elemento cita una guía existente y tiene fuente", () => {
  it("todo GuidelineDefinition.guidelineId apunta a un documento registrado", () => {
    for (const d of KNOWLEDGE_BASE_DEFINITIONS) expect(GUIDELINE_IDS.has(d.guidelineId)).toBe(true);
  });
  it("todo GuidelineCriterion.guidelineId apunta a un documento registrado", () => {
    for (const c of KNOWLEDGE_BASE_CRITERIA) expect(GUIDELINE_IDS.has(c.guidelineId)).toBe(true);
  });
  it("todo GuidelineRecommendation.guidelineId apunta a un documento registrado", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) expect(GUIDELINE_IDS.has(r.guidelineId)).toBe(true);
  });

  it("toda definición/criterio/recomendación tiene sourceText no vacío", () => {
    for (const d of KNOWLEDGE_BASE_DEFINITIONS) expect(d.sourceText.trim().length).toBeGreaterThan(0);
    for (const c of KNOWLEDGE_BASE_CRITERIA) expect(c.sourceText.trim().length).toBeGreaterThan(0);
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) expect(r.sourceText.trim().length).toBeGreaterThan(0);
  });
});

describe("No hay páginas inventadas", () => {
  it("toda página citada es null o un entero dentro del rango real del documento fuente", () => {
    const all = [...KNOWLEDGE_BASE_DEFINITIONS, ...KNOWLEDGE_BASE_CRITERIA, ...KNOWLEDGE_BASE_RECOMMENDATIONS];
    for (const item of all) {
      if (item.page === null) continue;
      const [min, max] = PAGE_RANGE[item.guidelineId];
      expect(Number.isInteger(item.page)).toBe(true);
      expect(item.page).toBeGreaterThanOrEqual(min);
      expect(item.page).toBeLessThanOrEqual(max);
    }
  });
});

describe("Referencias internas válidas", () => {
  it("GuidelineRecommendation.criteria referencia criterionId existentes de la MISMA guía", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      for (const critId of r.criteria) {
        expect(CRITERION_IDS.has(critId)).toBe(true);
        const crit = KNOWLEDGE_BASE_CRITERIA.find((c) => c.criterionId === critId);
        expect(crit?.guidelineId).toBe(r.guidelineId);
      }
    }
  });

  it("GuidelineRecommendation.exclusions referencia criterionId existentes de la MISMA guía", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      for (const critId of r.exclusions) {
        expect(CRITERION_IDS.has(critId)).toBe(true);
        const crit = KNOWLEDGE_BASE_CRITERIA.find((c) => c.criterionId === critId);
        expect(crit?.guidelineId).toBe(r.guidelineId);
      }
    }
  });

  it("GuidelineRecommendation.prerequisites referencia criterionId existentes de la MISMA guía", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      for (const critId of r.prerequisites) {
        expect(CRITERION_IDS.has(critId)).toBe(true);
        const crit = KNOWLEDGE_BASE_CRITERIA.find((c) => c.criterionId === critId);
        expect(crit?.guidelineId).toBe(r.guidelineId);
      }
    }
  });

  it("ningún criterionId aparece a la vez en criteria/exclusions/prerequisites de una misma recomendación", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      const buckets = [r.criteria, r.exclusions, r.prerequisites];
      for (let i = 0; i < buckets.length; i++) {
        for (let j = i + 1; j < buckets.length; j++) {
          const overlap = buckets[i].filter((id) => buckets[j].includes(id));
          expect(overlap).toEqual([]);
        }
      }
    }
  });

  it("parentRecommendationId (cuando existe) referencia una recomendación existente de la MISMA guía", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      if (!r.parentRecommendationId) continue;
      expect(RECOMMENDATION_IDS.has(r.parentRecommendationId)).toBe(true);
      const parent = KNOWLEDGE_BASE_RECOMMENDATIONS.find((p) => p.recommendationId === r.parentRecommendationId);
      expect(parent?.guidelineId).toBe(r.guidelineId);
    }
  });
});

describe("Fuerza/evidencia: nunca atribuida a una actuación hija que la guía no gradúa", () => {
  it("toda recomendación con parentRecommendationId tiene strength y evidenceQuality en null", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      if (!r.parentRecommendationId) continue;
      expect(r.strength).toBeNull();
      expect(r.evidenceQuality).toBeNull();
    }
  });

  it("strength y evidenceQuality son ambos null o ambos no-null (nunca uno solo inventado)", () => {
    for (const r of KNOWLEDGE_BASE_RECOMMENDATIONS) {
      const bothNull = r.strength === null && r.evidenceQuality === null;
      const bothSet = r.strength !== null && r.evidenceQuality !== null;
      expect(bothNull || bothSet).toBe(true);
    }
  });

  it("las recomendaciones padre de Narrative Question 2 y 3 (ERS) sí llevan fuerza/evidencia global", () => {
    const parentQ2 = ERS_2025_RECOMMENDATIONS.find((r) => r.recommendationId === "ers-rec-narrativeq2");
    const parentQ3 = ERS_2025_RECOMMENDATIONS.find((r) => r.recommendationId === "ers-rec-narrativeq3");
    expect(parentQ2?.strength).toBe("conditional");
    expect(parentQ2?.evidenceQuality).toBe("very low");
    expect(parentQ3?.strength).toBe("conditional");
    expect(parentQ3?.evidenceQuality).toBe("very low");
  });
});

describe("Fidelidad al conteo declarado por la propia guía (Table 1, ERS p.8)", () => {
  it("Narrative Question 2 tiene exactamente 9 recomendaciones hijas (la guía dice \"nine recommendations\")", () => {
    expect(findChildRecommendations("ers-rec-narrativeq2")).toHaveLength(9);
  });
  it("Narrative Question 3 tiene exactamente 11 recomendaciones hijas (la guía dice \"11 recommendations\")", () => {
    expect(findChildRecommendations("ers-rec-narrativeq3")).toHaveLength(11);
  });
});

describe("ERS y SEPAR se mantienen separadas (no fusionadas)", () => {
  it("ninguna recomendación de ERS referencia un criterio de SEPAR ni viceversa", () => {
    for (const r of ERS_2025_RECOMMENDATIONS) {
      for (const id of [...r.criteria, ...r.exclusions, ...r.prerequisites]) {
        expect(SEPAR_2018_CRITERIA.some((c) => c.criterionId === id)).toBe(false);
      }
    }
    for (const r of SEPAR_2018_RECOMMENDATIONS) {
      for (const id of [...r.criteria, ...r.exclusions, ...r.prerequisites]) {
        expect(ERS_2025_CRITERIA.some((c) => c.criterionId === id)).toBe(false);
      }
    }
  });

  it("ambas guías pueden tener una recomendación sobre el mismo tema con distinta fuerza/evidencia (p. ej. corticoides inhalados)", () => {
    const ersCorticoides = ERS_2025_RECOMMENDATIONS.find((r) => r.recommendationId === "ers-rec-pico7");
    const separCorticoides = SEPAR_2018_RECOMMENDATIONS.find((r) => r.recommendationId === "separ-rec-corticoides-no-rutina");
    expect(ersCorticoides?.strength).toBe("conditional");
    expect(separCorticoides?.strength).toBe("strong");
    // Mismo sentido clínico (ambas en contra del uso rutinario), fuerza distinta — no se reconcilian ni se fusionan.
    expect(ersCorticoides?.guidelineId).not.toBe(separCorticoides?.guidelineId);
  });
});

describe("Inventario (documentación del recuento, no verificación médica)", () => {
  it("registra el tamaño total de la base de conocimiento", () => {
    expect(ERS_2025_DEFINITIONS.length).toBe(5);
    expect(ERS_2025_CRITERIA.length).toBe(8);
    expect(ERS_2025_RECOMMENDATIONS.length).toBe(33);
    expect(SEPAR_2018_DEFINITIONS.length).toBe(4);
    expect(SEPAR_2018_CRITERIA.length).toBe(16);
    expect(SEPAR_2018_RECOMMENDATIONS.length).toBe(19);
  });

  it("expone los documentos con su título completo para el inventario", () => {
    expect(ERS_2025_DOCUMENT.source.title).toContain("European Respiratory Society");
    expect(SEPAR_2018_DOCUMENT.source.title).toContain("bronquiectasias");
  });
});
