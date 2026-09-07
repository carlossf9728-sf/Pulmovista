"use client";

import { COLORS } from "@/utils/theme";

/**
 * Texto de una recomendación de guía en cualquier tarjeta compacta
 * (Resumen, Alertas, Revisión según guías): la interpretación en
 * español de PulmoVista es siempre el texto principal — nunca el
 * `recommendationText` verbatim de la guía, que puede venir en inglés
 * (ERS 2025) o español (SEPAR 2018) según el idioma original del
 * documento. El texto verbatim se conserva sin modificar, siempre
 * etiquetado como "Texto original de la guía" para que quede claro que
 * es una cita literal, no una traducción.
 */
export function GuidelineRecommendationText({ interpretation, verbatim }: { interpretation: string; verbatim: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, color: COLORS.ink }}>{interpretation}</div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.slateLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>Texto original de la guía</div>
        <p className="pv-mono" style={{ fontSize: 12, fontStyle: "italic", color: COLORS.slate, margin: "3px 0 0", lineHeight: 1.5 }}>
          “{verbatim}”
        </p>
      </div>
    </div>
  );
}
