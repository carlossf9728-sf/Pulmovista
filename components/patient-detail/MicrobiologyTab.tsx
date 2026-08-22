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
  // Nota: el prototipo original pasaba className="pv-fade-in" a <Card>, pero
  // Card nunca reenviaba esa prop al DOM (no la declaraba ni la usaba), así
  // que la animación de entrada nunca se aplicaba aquí en la práctica —
  // inconsistencia visual menor detectada durante la migración, TypeScript
  // la marca en tiempo de compilación en vez de descartarla en silencio
  // como hacía JS. Se preserva el comportamiento real (sin fade-in en esta
  // pestaña), no se añade la animación.
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
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
