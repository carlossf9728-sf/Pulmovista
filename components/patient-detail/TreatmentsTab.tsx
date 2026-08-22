"use client";

import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectTreatments } from "@/domain/selectors";
import { Card } from "@/components/ui";
import type { Patient } from "@/types/patient";

export function TreatmentsTab({ patient }: { patient: Patient }) {
  const rows = [...selectTreatments(patient.events)].reverse();
  if (!rows.length) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin tratamientos registrados.</div>;
  }
  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((t) => (
        <Card key={t.id} accent={t.status === "Activo" ? COLORS.green : COLORS.slateLight}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10.5, color: COLORS.slateLight }}>{t.category}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: 20,
                  color: t.status === "Activo" ? COLORS.green : COLORS.slate,
                  background: t.status === "Activo" ? COLORS.greenTint : COLORS.paper,
                }}
              >
                {t.status}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 6 }}>
            Inicio: {formatDate(t.start)}
            {t.end ? ` · Fin: ${formatDate(t.end)}` : ""}
          </div>
        </Card>
      ))}
    </div>
  );
}
