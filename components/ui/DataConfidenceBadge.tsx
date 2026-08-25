"use client";

import { COLORS } from "@/utils/theme";

/**
 * Señal de confianza simplificada. Nunca expone la taxonomía interna de
 * ConfidenceLevel (5 niveles) ni un porcentaje — cuando se muestra, es
 * siempre "Revisar": suficiente para que el médico sepa que ese dato no
 * está confirmado, sin jerga técnica. Quien llama a este componente
 * sigue decidiendo CUÁNDO mostrarlo (nunca para un dato "confirmado" —
 * ahí no aporta nada y no se muestra). El motivo detallado, si existe,
 * se ofrece como tooltip (title) en vez de como texto siempre visible.
 */
export function DataConfidenceBadge({ reason }: { reason?: string | null }) {
  return (
    <span
      title={reason || ""}
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: COLORS.orange,
        background: COLORS.orangeTint,
        padding: "2px 8px",
        borderRadius: 20,
      }}
    >
      Revisar
    </span>
  );
}
