"use client";

import { COLORS } from "@/utils/theme";

/**
 * `kind` es el discriminante interno de ClinicalSource/ClinicalExplanation
 * (types/evidence.ts) — se mantiene en inglés porque es un identificador
 * de tipo, no texto de interfaz. La etiqueta que se muestra al usuario se
 * traduce aquí, en el único punto de presentación.
 */
const MAP: Record<"heurística experimental" | "guideline" | "guideline_definition", { c: string; t: string; label: string }> = {
  // Etiqueta visible deliberadamente distinta del identificador interno "heurística experimental": ese nombre
  // técnico no se muestra al médico — ver ¿Por qué? para la explicación de qué es y qué no es esta interpretación.
  "heurística experimental": { c: COLORS.violet, t: COLORS.violetTint, label: "Interpretación de PulmoVista" },
  guideline: { c: COLORS.tealDeep, t: COLORS.tealTint, label: "guía clínica" },
  // Distinto de "guideline": es una definición/tabla de referencia de la guía, no una recomendación graduada.
  guideline_definition: { c: COLORS.slate, t: COLORS.paper, label: "referencia de guía (no es una recomendación)" },
};

export function KindTag({ kind }: { kind: "heurística experimental" | "guideline" | "guideline_definition" }) {
  const s = MAP[kind] || MAP["heurística experimental"];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.c, background: s.t, padding: "2px 8px", borderRadius: 20 }}>
      {s.label}
    </span>
  );
}
