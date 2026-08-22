"use client";

import type { ReactNode } from "react";
import { COLORS } from "@/utils/theme";

export function Eyebrow({ children, color = COLORS.teal }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color }}>
      {children}
    </div>
  );
}
