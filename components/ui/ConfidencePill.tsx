"use client";

import { COLORS } from "@/utils/theme";
import type { SentinelConfidence } from "@/types/sentinel";

const MAP: Record<SentinelConfidence, string> = { Alta: COLORS.red, Moderada: COLORS.orange, Baja: COLORS.slate };

export function ConfidencePill({ level }: { level: SentinelConfidence }) {
  const c = MAP[level] || COLORS.slate;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: c, background: `${c}14`, padding: "3px 9px", borderRadius: 20 }}>
      Confianza {level}
    </span>
  );
}
