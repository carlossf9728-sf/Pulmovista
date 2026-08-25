/**
 * Tests de domain/pft.ts — comparación entre dos pruebas de función
 * pulmonar. Pura aritmética/formato: no hay ninguna regla clínica ni
 * umbral que verificar aquí, solo que cada tipo de cambio (valor
 * absoluto, puntos porcentuales del % predicho, z-score) se calcula y
 * se muestra por separado, nunca mezclado, y con el formato exacto
 * pedido ("−4 puntos", signo "−" real, no un guion).
 */
import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { comparePft, formatZScore } from "@/domain/pft";
import type { PulmonaryFunctionEvent } from "@/types/clinicalEvent";

function pft(date: string, payload: Partial<PulmonaryFunctionEvent>): PulmonaryFunctionEvent {
  return mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, date, payload);
}

describe("formatZScore", () => {
  it("nunca antepone '+' a un valor crudo positivo, y usa el signo '−' real (no un guion) para negativos", () => {
    expect(formatZScore(1.8)).toBe("1.8");
    expect(formatZScore(-1.8)).toBe("−1.8");
    expect(formatZScore(-1.8)).not.toContain("-1.8"); // guion ASCII normal, no debe aparecer
  });
});

describe("comparePft", () => {
  it("sin prueba anterior, no hay nada que comparar", () => {
    const current = pft("2024-01-01", { FEV1Percent: 70 });
    expect(comparePft(current, null)).toEqual([]);
  });

  it("distingue claramente cambio absoluto (L), puntos porcentuales del % predicho y z-score en líneas separadas para FEV1", () => {
    const previous = pft("2025-01-01", { FEV1Liters: 1.8, FEV1Percent: 72, FEV1zScore: -1.5 });
    const current = pft("2025-06-01", { FEV1Liters: 1.74, FEV1Percent: 68, FEV1zScore: -1.9 });
    const lines = comparePft(current, previous);
    const fev1Line = lines.find((l) => l.startsWith("FEV1:"))!;
    expect(fev1Line).toBeDefined();
    expect(fev1Line).toContain("1.74 L (−0.06 L)");
    // Formato exacto pedido: "−4 puntos", con la palabra completa "puntos".
    expect(fev1Line).toContain("68% predicho (−4 puntos)");
    expect(fev1Line).toContain("z −1.9 (−0.4)");
  });

  it("muestra el z-score aunque la prueba anterior no lo tuviera (dato longitudinal que empieza a capturarse), sin delta de z", () => {
    const previous = pft("2025-01-01", { FEV1Percent: 72 }); // sin z-score
    const current = pft("2025-06-01", { FEV1Percent: 68, FEV1zScore: -1.9 });
    const fev1Line = comparePft(current, previous).find((l) => l.startsWith("FEV1:"))!;
    expect(fev1Line).toContain("z −1.9");
    expect(fev1Line).not.toMatch(/z −1\.9 \(/); // sin paréntesis de delta: no hay z anterior con qué comparar
  });

  it("no muestra la línea de FEV1/FVC si ninguna de las dos pruebas trae el cociente", () => {
    const previous = pft("2025-01-01", { FEV1Percent: 72 });
    const current = pft("2025-06-01", { FEV1Percent: 68 });
    expect(comparePft(current, previous).some((l) => l.startsWith("FEV1/FVC"))).toBe(false);
  });

  it("FEV1/FVC compara el cociente en puntos y su z-score, sin fingir un valor 'absoluto en litros' que no existe para un cociente", () => {
    const previous = pft("2025-01-01", { FEV1FVCRatio: 74, FEV1FVCzScore: -1.1 });
    const current = pft("2025-06-01", { FEV1FVCRatio: 70, FEV1FVCzScore: -1.4 });
    const line = comparePft(current, previous).find((l) => l.startsWith("FEV1/FVC"))!;
    expect(line).toBe("FEV1/FVC: 70% (−4 puntos) · z −1.4 (−0.3)");
  });

  it("nunca interpreta el cambio de z-score como significativo: solo aritmética, ningún umbral ni etiqueta cualitativa", () => {
    const previous = pft("2025-01-01", { FEV1zScore: -1.0 });
    const current = pft("2025-06-01", { FEV1zScore: -3.5 }); // caída grande a propósito
    const line = comparePft(current, previous).find((l) => l.startsWith("FEV1:"))!;
    expect(line).toContain("z −3.5 (−2.5)");
    expect(line).not.toMatch(/significativ|grave|alarma|umbral/i);
  });

  it("el DLCO no se compara aquí (se revisa aparte): ninguna línea empieza por 'DLCO'", () => {
    const previous = pft("2025-01-01", { DLCOPercent: 70 });
    const current = pft("2025-06-01", { DLCOPercent: 60 });
    expect(comparePft(current, previous).some((l) => l.startsWith("DLCO"))).toBe(false);
  });
});
