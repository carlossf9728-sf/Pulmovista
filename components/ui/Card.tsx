"use client";

import type { CSSProperties, ReactNode } from "react";
import { COLORS } from "@/utils/theme";

export function Card({
  children,
  style,
  accent,
  hover = true,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  accent?: string;
  hover?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[hover ? "pv-card-hover" : "", className].filter(Boolean).join(" ")}
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.line}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
