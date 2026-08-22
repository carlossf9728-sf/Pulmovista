"use client";

import { STATUS } from "@/utils/theme";
import type { PatientStatus } from "@/types/patient";

export function StatusPill({ status }: { status: PatientStatus }) {
  const s = STATUS[status] || STATUS.estable;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: s.color,
        background: s.tint,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: s.color }} /> {s.label}
    </span>
  );
}
