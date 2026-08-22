"use client";

import { HelpCircle } from "lucide-react";
import { COLORS } from "@/utils/theme";

export function WhyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 8,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.tealDeep,
      }}
    >
      <HelpCircle size={13} /> ¿Por qué?
    </button>
  );
}
