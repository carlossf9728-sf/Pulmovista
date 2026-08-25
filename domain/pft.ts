/**
 * Comparación entre dos pruebas de función pulmonar consecutivas —
 * aritmética y formato, sin ninguna regla clínica ni umbral nuevo. Para
 * cada parámetro (FEV1, FVC, FEV1/FVC) distingue explícitamente tres
 * cosas que nunca se mezclan en un único número:
 *
 *   1. cambio absoluto del valor medido (litros),
 *   2. cambio en puntos porcentuales del % del predicho,
 *   3. cambio de z-score (cuando la prueba lo informa).
 *
 * El z-score se muestra siempre que la prueba ACTUAL lo tenga, aunque la
 * anterior no lo tuviera (dato longitudinal que empieza a capturarse) —
 * nunca se interpreta como "significativo": no hay ningún umbral aquí,
 * solo se calcula y se formatea la diferencia si hay dos valores.
 *
 * El DLCO queda deliberadamente fuera (sin z-score, sin comparación) —
 * se revisa aparte más adelante; su lógica actual no se toca.
 */
import type { PulmonaryFunctionEvent } from "@/types/clinicalEvent";

const MINUS = "−";

/** Valor crudo (no una diferencia): signo "−" solo si es negativo, nunca "+" para positivos. */
function formatRaw(n: number, decimals: number): string {
  const rounded = Number(n.toFixed(decimals));
  return rounded < 0 ? `${MINUS}${Math.abs(rounded).toFixed(decimals)}` : rounded.toFixed(decimals);
}

/** Diferencia entre dos valores: siempre con signo explícito ("+"/"−"), incluido el caso 0. */
function formatSigned(delta: number, decimals: number): string {
  const rounded = Number(delta.toFixed(decimals));
  if (rounded === 0) return "0";
  const sign = rounded > 0 ? "+" : MINUS;
  return `${sign}${Math.abs(rounded).toFixed(decimals)}`;
}

export function formatZScore(z: number): string {
  return formatRaw(z, 1);
}

interface MetricComparisonInput {
  label: string;
  prevValue?: number | null;
  curValue?: number | null;
  valueUnit?: string;
  valueDecimals?: number;
  prevPercent?: number | null;
  curPercent?: number | null;
  percentLabel?: string;
  prevZ?: number | null;
  curZ?: number | null;
}

/**
 * Línea de comparación de UN parámetro espirométrico, componiendo solo
 * las partes con dato disponible. El valor absoluto y el % del predicho
 * exigen dato en AMBAS pruebas (si no, no hay "cambio" que mostrar); el
 * z-score se muestra en cuanto la prueba actual lo tiene, con o sin
 * comparación previa.
 */
function compareMetric(opts: MetricComparisonInput): string | null {
  const parts: string[] = [];

  if (opts.prevValue != null && opts.curValue != null && opts.valueUnit) {
    const decimals = opts.valueDecimals ?? 2;
    parts.push(`${opts.curValue.toFixed(decimals)} ${opts.valueUnit} (${formatSigned(opts.curValue - opts.prevValue, decimals)} ${opts.valueUnit})`);
  }

  if (opts.prevPercent != null && opts.curPercent != null) {
    const label = opts.percentLabel ?? "% predicho";
    parts.push(`${opts.curPercent}${label} (${formatSigned(opts.curPercent - opts.prevPercent, 0)} puntos)`);
  }

  if (opts.curZ != null) {
    parts.push(opts.prevZ != null ? `z ${formatZScore(opts.curZ)} (${formatSigned(opts.curZ - opts.prevZ, 1)})` : `z ${formatZScore(opts.curZ)}`);
  }

  if (!parts.length) return null;
  return `${opts.label}: ${parts.join(" · ")}`;
}

/**
 * Compara `current` con la prueba de función pulmonar INMEDIATAMENTE
 * anterior del mismo paciente. Devuelve una línea por parámetro
 * (FEV1/FVC/FEV1-FVC) que SÍ tiene algo que mostrar — nunca una línea
 * vacía. `[]` si no hay prueba anterior con la que comparar (primera
 * prueba registrada): los valores de esa primera prueba, incluido su
 * z-score si lo trae, ya se muestran en el título de la propia entrada
 * (ver domain/timeline.ts#displayForEvent), no hace falta repetirlos
 * aquí sin nada que comparar.
 */
export function comparePft(current: PulmonaryFunctionEvent, previous: PulmonaryFunctionEvent | null): string[] {
  if (!previous) return [];
  const lines = [
    compareMetric({
      label: "FEV1",
      prevValue: previous.FEV1Liters,
      curValue: current.FEV1Liters,
      valueUnit: "L",
      prevPercent: previous.FEV1Percent,
      curPercent: current.FEV1Percent,
      prevZ: previous.FEV1zScore,
      curZ: current.FEV1zScore,
    }),
    compareMetric({
      label: "FVC",
      prevValue: previous.FVCLiters,
      curValue: current.FVCLiters,
      valueUnit: "L",
      prevPercent: previous.FVCPercent,
      curPercent: current.FVCPercent,
      prevZ: previous.FVCzScore,
      curZ: current.FVCzScore,
    }),
    compareMetric({
      label: "FEV1/FVC",
      prevPercent: previous.FEV1FVCRatio,
      curPercent: current.FEV1FVCRatio,
      percentLabel: "%",
      prevZ: previous.FEV1FVCzScore,
      curZ: current.FEV1FVCzScore,
    }),
  ];
  return lines.filter((l): l is string => l != null);
}
