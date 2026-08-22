"use client";

import { CONFIDENCE_COLOR, COLORS } from "@/utils/theme";
import type { ConfidenceLevel } from "@/types/clinicalEvent";

export function DataConfidenceBadge({ level, reason }: { level: ConfidenceLevel; reason?: string | null }) {
  const c = CONFIDENCE_COLOR[level] || COLORS.slate;
  return (
    <span
      title={reason || ""}
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: c,
        background: `${c}14`,
        padding: "2px 8px",
        borderRadius: 20,
        textTransform: "capitalize",
      }}
    >
      {level}
    </span>
  );
}
