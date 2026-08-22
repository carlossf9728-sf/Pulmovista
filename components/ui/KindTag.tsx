"use client";

import { COLORS } from "@/utils/theme";

const MAP: Record<"heurística experimental" | "guideline", { c: string; t: string }> = {
  "heurística experimental": { c: COLORS.violet, t: COLORS.violetTint },
  guideline: { c: COLORS.tealDeep, t: COLORS.tealTint },
};

export function KindTag({ kind }: { kind: "heurística experimental" | "guideline" }) {
  const s = MAP[kind] || MAP["heurística experimental"];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.c, background: s.t, padding: "2px 8px", borderRadius: 20 }}>
      {kind}
    </span>
  );
}
