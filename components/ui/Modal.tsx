"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { COLORS } from "@/utils/theme";

export function Modal({
  title,
  onClose,
  children,
  width = 560,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7,26,48,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="pv-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.white,
          borderRadius: 14,
          width: "100%",
          maxWidth: width,
          boxShadow: "0 24px 60px rgba(7,26,48,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: `1px solid ${COLORS.line}`,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", padding: 4, borderRadius: 6, display: "flex" }}>
            <X size={18} color={COLORS.slate} />
          </button>
        </div>
        <div style={{ padding: 22, maxHeight: "72vh", overflowY: "auto" }} className="pv-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
