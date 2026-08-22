"use client";

import { COLORS } from "@/utils/theme";

export function Val({ value, suffix = "" }: { value: string | number | null | undefined; suffix?: string }) {
  if (value === null || value === undefined || value === "") {
    return <span style={{ color: COLORS.slateLight, fontStyle: "italic", fontWeight: 400 }}>No disponible</span>;
  }
  return (
    <span>
      {value}
      {suffix}
    </span>
  );
}
