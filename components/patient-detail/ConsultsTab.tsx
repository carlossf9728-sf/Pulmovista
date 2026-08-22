"use client";

import { Plus } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectConsultations } from "@/domain/selectors";
import { Card } from "@/components/ui";
import type { Patient } from "@/types/patient";

export function ConsultsTab({ patient, onAddConsultation }: { patient: Patient; onAddConsultation: () => void }) {
  const rows = [...selectConsultations(patient.events)].reverse();
  return (
    <div className="pv-fade-in">
      <button
        onClick={onAddConsultation}
        style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "white", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13, marginBottom: 16 }}
      >
        <Plus size={15} /> Añadir nueva consulta
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((v) => (
          <Card key={v.id}>
            <div className="pv-mono" style={{ fontSize: 12, color: COLORS.teal, fontWeight: 700, marginBottom: 6 }}>
              {formatDate(v.date)}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: COLORS.ink }}>{v.rawText}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
