"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectPFT } from "@/domain/selectors";
import { detectContradictions } from "@/engines/longitudinal";
import { Card, Eyebrow } from "@/components/ui";
import type { Patient } from "@/types/patient";

const CHARTS = [
  { key: "FEV1Percent", title: "FEV1 (% predicho)", color: COLORS.teal },
  { key: "FVCPercent", title: "FVC (% predicho)", color: COLORS.navy },
  { key: "DLCOPercent", title: "DLCO (% predicho)", color: COLORS.orange },
] as const;

export function PFTTab({ patient }: { patient: Patient }) {
  const data = selectPFT(patient.events).map((p) => ({ ...p, label: formatDate(p.date) }));
  const contradictions = detectContradictions(patient);

  if (!data.length) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin pruebas de función pulmonar registradas.</div>;
  }

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!!contradictions.length && (
        <Card accent={COLORS.red} style={{ background: COLORS.redTint }}>
          <div style={{ display: "flex", gap: 10 }}>
            <ShieldAlert size={18} color={COLORS.red} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.red }}>Dato potencialmente inconsistente</div>
              {contradictions.map((c) => (
                <div key={c.id} style={{ fontSize: 13, color: COLORS.ink, marginTop: 6 }}>
                  {c.message}
                  <br />
                  <span style={{ fontStyle: "italic", color: COLORS.slate }}>{c.note}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
      {CHARTS.map((c) => (
        <Card key={c.key}>
          <Eyebrow color={c.color}>{c.title}</Eyebrow>
          <div style={{ width: "100%", height: 200, marginTop: 10 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 6, right: 14, left: -14, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.slateLight }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.slateLight }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                <Line type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2.5} dot={{ r: 3.5, fill: c.color }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ))}
    </div>
  );
}
