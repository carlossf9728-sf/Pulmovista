/**
 * Tests de engines/guidelines/changeTracking.ts — lógica pura de
 * detección de cambios entre dos evaluaciones sucesivas de
 * GuidelineMatch. No monta componentes: solo compara snapshots de
 * `status` por recommendationId, que es exactamente lo que
 * GuidelinesReviewTab usa para marcar una tarjeta como "Actualizada".
 */
import { describe, expect, it } from "vitest";
import { diffChangedRecommendations, snapshotStatuses } from "@/engines/guidelines/changeTracking";
import type { GuidelineMatch } from "@/types/guideline";

function match(recommendationId: string, status: GuidelineMatch["status"]): GuidelineMatch {
  return {
    patientId: "p1",
    recommendationId,
    status,
    matchedCriteria: [],
    unmatchedCriteria: [],
    missingCriteria: [],
    conflictingCriteria: [],
    patientEvidence: [],
    guidelineCitation: { guidelineId: "g", section: null, page: null, sourceText: "..." },
  };
}

describe("snapshotStatuses", () => {
  it("recoge el status actual de cada recommendationId", () => {
    const snap = snapshotStatuses([match("a", "applies"), match("b", "does_not_apply")]);
    expect(snap.get("a")).toBe("applies");
    expect(snap.get("b")).toBe("does_not_apply");
  });
});

describe("diffChangedRecommendations", () => {
  it("sin fotografía anterior (primera vez en la sesión), nunca marca nada como cambiado", () => {
    const changed = diffChangedRecommendations(null, [match("a", "applies"), match("b", "insufficient_data")]);
    expect(changed.size).toBe(0);
  });

  it("marca solo los recommendationId cuyo status difiere de la fotografía anterior", () => {
    const previous = snapshotStatuses([match("a", "insufficient_data"), match("b", "does_not_apply")]);
    const current = [match("a", "applies"), match("b", "does_not_apply")];
    const changed = diffChangedRecommendations(previous, current);
    expect(changed.has("a")).toBe(true);
    expect(changed.has("b")).toBe(false);
    expect(changed.size).toBe(1);
  });

  it("no marca nada si ningún status cambió", () => {
    const previous = snapshotStatuses([match("a", "applies")]);
    const changed = diffChangedRecommendations(previous, [match("a", "applies")]);
    expect(changed.size).toBe(0);
  });
});
