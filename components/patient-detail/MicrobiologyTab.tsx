"use client";

import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectMicrobiology } from "@/domain/selectors";
import { Card, Val } from "@/components/ui";
import type { Patient } from "@/types/patient";

const HEADERS = ["Fecha", "Muestra", "Microorganismo", "Sensible a", "Resistente a"];

export function MicrobiologyTab({ patient }: { patient: Patient }) {
  const rows = [...selectMicrobiology(patient.events)].reverse();
  if (!rows.length) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin muestras microbiológicas registradas.</div>;
  }
  // Bug técnico corregido tras la migración (no clínico): el prototipo
  // original pasaba className="pv-fade-in" a <Card>, pero Card no la
  // declaraba ni la reenviaba al DOM, así que la animación de entrada nunca
  // se aplicaba aquí en la práctica. Se corrigió Card para que reenvíe
  // className (ver components/ui/Card.tsx) y se restaura la prop.
  return (
    <Card style={{ padding: 0, overflow: "hidden" }} className="pv-fade-in">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: COLORS.paper, textAlign: "left" }}>
            {HEADERS.map((h) => (
              <th key={h} style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: COLORS.slate, fontWeight: 700 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${COLORS.line}` }}>
              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }} className="pv-mono">
                {formatDate(m.date)}
              </td>
              <td style={{ padding: "10px 14px" }}>{m.sampleType}</td>
              <td style={{ padding: "10px 14px", fontWeight: 600 }}>{m.organism}</td>
              <td style={{ padding: "10px 14px", color: COLORS.slate }}>
                <Val value={m.sensitivity?.length ? m.sensitivity.join(", ") : null} />
              </td>
              <td style={{ padding: "10px 14px", color: COLORS.slate }}>
                <Val value={m.resistance?.length ? m.resistance.join(", ") : null} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
