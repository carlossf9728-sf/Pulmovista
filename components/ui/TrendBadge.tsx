"use client";

import { COLORS } from "@/utils/theme";
import type { ClinicalTrend } from "@/types/clinicalTrend";

/**
 * Única etiqueta de interpretación clínica en toda la app — 3 resultados
 * posibles, iguales en cualquier dominio. `null` no renderiza nada: la
 * ausencia de etiqueta es una decisión activa (sin cambio claro, o
 * cambio objetivo sin interpretación defendible), no un estado de carga.
 */
export function TrendBadge({ trend, title }: { trend: ClinicalTrend; title?: string }) {
  if (!trend) return null;
  const worse = trend === "Empeoramiento";
  return (
    <span
      title={title}
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: worse ? COLORS.red : COLORS.green,
        background: worse ? COLORS.redTint : COLORS.greenTint,
        padding: "1px 7px",
        borderRadius: 20,
        whiteSpace: "nowrap",
      }}
    >
      {trend}
    </span>
  );
}
