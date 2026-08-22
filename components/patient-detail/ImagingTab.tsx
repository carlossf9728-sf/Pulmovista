"use client";

import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectImaging } from "@/domain/selectors";
import { Card } from "@/components/ui";
import type { Patient } from "@/types/patient";

export function ImagingTab({ patient }: { patient: Patient }) {
  const rows = [...selectImaging(patient.events)].reverse();
  if (!rows.length) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin pruebas de imagen registradas.</div>;
  }
  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((im, i) => {
        const changed = i < rows.length - 1 && im.text !== rows[i + 1].text;
        return (
          <Card key={im.id} accent={COLORS.teal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {im.label} — {formatDate(im.date)}
              </div>
              {changed && (
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.orange, background: COLORS.orangeTint, padding: "3px 9px", borderRadius: 20 }}>
                  Cambio respecto al informe anterior
                </span>
              )}
            </div>
            <div style={{ fontSize: 13.5, color: COLORS.ink, marginTop: 8, lineHeight: 1.55 }}>{im.text}</div>
          </Card>
        );
      })}
    </div>
  );
}
