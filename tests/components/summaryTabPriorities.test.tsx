import { describe, expect, it } from "vitest";
import { groupPrioritiesForDisplay } from "@/components/patient-detail/SummaryTab";
import type { RawPriority } from "@/components/patient-detail/SummaryTab";
import type { ClinicalExplanation } from "@/types/evidence";

/**
 * groupPrioritiesForDisplay — deduplicación SOLO de presentación de "Qué
 * revisar hoy" (Resumen): agrupa recomendaciones equivalentes de guías
 * distintas por la misma acción clínica (engines/guidelines/match.ts#
 * actionGroupKeyFor, un registro ya curado — no `topic`, demasiado
 * ancho, ni comparación manual de strings), sin fusionar ni descartar
 * nada del motor de matching: cada fuente conserva su propio
 * ClinicalExplanation completo dentro del grupo.
 */

function explanationFor(society: string, year: number): ClinicalExplanation {
  return {
    kindLabel: "guideline",
    source: { kind: "guideline", guidelineId: `${society.toLowerCase()}-${year}`, recommendationId: "irrelevant", society, year },
    sections: [{ label: "Recomendación", text: `Texto de ${society} ${year}.` }],
    evidence: [],
    citation: { society, year, section: "Sección", page: 1, sourceText: `Cita textual de ${society} ${year}.` },
  };
}

function raw(recommendationId: string, statusLabel: string, topic: string, society: string, year: number): RawPriority {
  return {
    recommendationId,
    topic,
    statusLabel,
    motivo: `Motivo (${society}).`,
    source: `${society} ${year}`,
    explanation: explanationFor(society, year),
  };
}

describe("groupPrioritiesForDisplay", () => {
  it("dos guías con la misma acción clínica: una sola fila, ambas fuentes, ambas explicaciones conservadas", () => {
    const grouped = groupPrioritiesForDisplay([
      raw("ers-rec-pico6", "Aplica", "Erradicación", "ERS", 2025),
      raw("separ-rec-erradicacion-primoinfeccion", "Aplica", "Erradicación", "SEPAR", 2018),
    ]);
    expect(grouped).toHaveLength(1);
    const [row] = grouped;
    expect(row.title).toBe("Erradicación de Pseudomonas");
    expect(row.statusLabel).toBe("Aplica");
    expect(row.sources).toEqual(["ERS 2025", "SEPAR 2018"]);
    // Nunca se pierde trazabilidad: cada fuente conserva su propia explicación completa.
    expect(row.explanations).toHaveLength(2);
    expect(row.explanations[0].citation?.society).toBe("ERS");
    expect(row.explanations[1].citation?.society).toBe("SEPAR");
  });

  it("una sola guía: fila propia, sin línea de 'Fuentes', título = topic (no el nombre de grupo, porque no hay nada que agrupar)", () => {
    const grouped = groupPrioritiesForDisplay([raw("ers-rec-pico6", "Aplica", "Erradicación", "ERS", 2025)]);
    expect(grouped).toHaveLength(1);
    const [row] = grouped;
    expect(row.title).toBe("Erradicación");
    expect(row.sources).toEqual(["ERS 2025"]);
    expect(row.explanations).toHaveLength(1);
  });

  it("acciones parecidas pero clínicamente distintas (mismo topic amplio, recomendaciones distintas fuera del registro curado): nunca se fusionan", () => {
    // Dos sub-recomendaciones reales del ERS bajo el mismo topic amplio "paciente que se deteriora",
    // pero cada una una actuación propia — ninguna está en el registro curado de acciones equivalentes.
    const grouped = groupPrioritiesForDisplay([
      raw("ers-rec-narrativeq3-1", "Aplica", "Paciente que se deteriora", "ERS", 2025),
      raw("ers-rec-narrativeq3-2", "Aplica", "Paciente que se deteriora", "ERS", 2025),
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped.every((r) => r.sources.length === 1)).toBe(true);
  });

  it("estados diferentes entre guías para la misma acción: nunca se fusionan bajo un único estado — el desacuerdo se muestra como filas separadas", () => {
    const grouped = groupPrioritiesForDisplay([
      raw("ers-rec-pico6", "Cumple", "Erradicación", "ERS", 2025),
      raw("separ-rec-erradicacion-primoinfeccion", "Aplica", "Erradicación", "SEPAR", 2018),
    ]);
    expect(grouped).toHaveLength(2);
    const statuses = grouped.map((r) => r.statusLabel).sort();
    expect(statuses).toEqual(["Aplica", "Cumple"]);
    expect(grouped.every((r) => r.sources.length === 1)).toBe(true);
  });
});
