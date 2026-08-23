"use client";

import { COLORS } from "@/utils/theme";

/**
 * `kind` es el discriminante interno de ClinicalSource/ClinicalExplanation
 * (types/evidence.ts) — se mantiene en inglés porque es un identificador
 * de tipo, no texto de interfaz. La etiqueta que se muestra al usuario se
 * traduce aquí, en el único punto de presentación.
 */
const MAP: Record<"heurística experimental" | "guideline", { c: string; t: string; label: string }> = {
  "heurística experimental": { c: COLORS.violet, t: COLORS.violetTint, label: "heurística experimental" },
  guideline: { c: COLORS.tealDeep, t: COLORS.tealTint, label: "guía clínica" },
};

export function KindTag({ kind }: { kind: "heurística experimental" | "guideline" }) {
  const s = MAP[kind] || MAP["heurística experimental"];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.c, background: s.t, padding: "2px 8px", borderRadius: 20 }}>
      {s.label}
    </span>
  );
}
