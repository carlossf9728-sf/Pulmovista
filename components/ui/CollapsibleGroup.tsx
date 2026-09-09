"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { Eyebrow } from "./Eyebrow";

/** Grupo plegable con contador — vista principal compacta, detalle expandible bajo demanda. */
export function CollapsibleGroup({
  label,
  color,
  tint,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  color: string;
  tint: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        {open ? <ChevronDown size={14} color={COLORS.slateLight} /> : <ChevronRight size={14} color={COLORS.slateLight} />}
        <Eyebrow color={color}>{label}</Eyebrow>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: tint, borderRadius: 20, padding: "1px 8px" }}>{count}</span>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}
