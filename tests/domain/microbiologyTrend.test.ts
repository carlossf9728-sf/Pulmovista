/**
 * Tests de domain/microbiologyTrend.ts — solo capa 1 (cambio objetivo),
 * nunca una etiqueta de interpretación. No existe "negativización
 * confirmada" en el modelo de datos actual (MicrobiologyEvent solo
 * registra organismos SÍ aislados) — se verifica explícitamente que la
 * función nunca la produce.
 */
import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { microbiologyObjectiveChange } from "@/domain/microbiologyTrend";
import type { MicrobiologyEvent } from "@/types/clinicalEvent";

function culture(date: string, organism: string): MicrobiologyEvent {
  return mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, date, { sampleType: "Esputo", organism, sensitivity: [], resistance: [] });
}

describe("microbiologyObjectiveChange", () => {
  it("el primer aislamiento histórico de un organismo es 'Nuevo aislamiento'", () => {
    const c = culture("2024-01-01", "Pseudomonas aeruginosa");
    expect(microbiologyObjectiveChange(c, [c])).toBe("Nuevo aislamiento");
  });

  it("un segundo cultivo consecutivo del MISMO organismo es 'Persistencia'", () => {
    const first = culture("2024-01-01", "Pseudomonas aeruginosa");
    const second = culture("2024-06-01", "Pseudomonas aeruginosa");
    expect(microbiologyObjectiveChange(second, [first, second])).toBe("Persistencia");
  });

  it("un organismo distinto que reaparece tras un hueco (cultivo intermedio de otro organismo) es 'Nuevo aislamiento'", () => {
    const first = culture("2024-01-01", "Pseudomonas aeruginosa");
    const gap = culture("2024-03-01", "Haemophilus influenzae");
    const reappearance = culture("2024-06-01", "Pseudomonas aeruginosa");
    expect(microbiologyObjectiveChange(reappearance, [first, gap, reappearance])).toBe("Nuevo aislamiento");
  });

  it("nunca produce 'Negativización confirmada': el modelo de datos no registra cultivos negativos explícitos", () => {
    const first = culture("2024-01-01", "Pseudomonas aeruginosa");
    const second = culture("2024-06-01", "Pseudomonas aeruginosa");
    const results = [microbiologyObjectiveChange(first, [first]), microbiologyObjectiveChange(second, [first, second])];
    expect(results).not.toContain("Negativización confirmada");
  });
});
