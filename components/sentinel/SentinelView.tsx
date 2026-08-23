"use client";

import Link from "next/link";
import { COLORS } from "@/utils/theme";
import { guidelineShortLabel } from "@/utils/guidelineLabels";
import { usePatients } from "@/app/providers";
import { computeSentinelFindings } from "@/engines/sentinel";
import { Card, Eyebrow } from "@/components/ui";
import type { SentinelFinding, SentinelStatusLabel } from "@/types/sentinel";

/** Color por SentinelStatusLabel — misma paleta que los 4 estados de la pestaña "Revisión según guías". */
const STATUS_LABEL_TONE: Record<SentinelStatusLabel, { color: string; tint: string }> = {
  Cumple: { color: COLORS.green, tint: COLORS.greenTint },
  "Posiblemente cumple": { color: COLORS.orange, tint: COLORS.orangeTint },
  "Información insuficiente": { color: COLORS.slate, tint: COLORS.paper },
  "No cumple": { color: COLORS.slateLight, tint: COLORS.paper },
};

function sentinelCardAccent(f: SentinelFinding): string {
  if (f.guidelineInterpretations.some((gi) => gi.statusLabel === "Cumple")) return COLORS.red;
  if (f.guidelineInterpretations.length) return COLORS.orange;
  return COLORS.slateLight;
}

export function SentinelView() {
  const { patients } = usePatients();
  const all = patients.flatMap((p) => computeSentinelFindings(p).map((finding) => ({ patient: p, finding })));

  return (
    <div className="pv-fade-in">
      <Eyebrow>Sentinel</Eyebrow>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 4px" }}>PulmoVista Sentinel</h1>
      <p style={{ color: COLORS.slate, fontSize: 13.5, marginBottom: 22, maxWidth: 640 }}>
        Capa de vigilancia longitudinal. Detecta cambios objetivos en los datos del paciente y, cuando las guías
        cargadas (ERS 2025 / SEPAR 2018) respaldan una interpretación clínica para ese cambio, la muestra con su cita
        exacta. Si no hay soporte suficiente en las guías, se muestra solo el cambio objetivo.
      </p>
      {!all.length && <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No se han detectado alertas activas.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {all.map(({ patient, finding }, i) => (
          <Card key={i} accent={sentinelCardAccent(finding)} style={{ cursor: "pointer" }}>
            <Link href={`/pacientes/${patient.id}?tab=alertas`} style={{ display: "block", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>
                    {patient.code}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.slate }}>{patient.primaryDiagnosis}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {finding.guidelineInterpretations.length ? (
                    finding.guidelineInterpretations.map((gi) => {
                      const tone = STATUS_LABEL_TONE[gi.statusLabel];
                      return (
                        <span
                          key={gi.recommendationId}
                          style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.tint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}
                        >
                          {guidelineShortLabel(gi.society, gi.year)} · {gi.statusLabel}
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.slateLight, fontStyle: "italic" }}>Sin soporte en las guías cargadas</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, margin: "8px 0 6px" }}>{finding.label}</div>
              <div style={{ fontSize: 13, color: COLORS.ink }}>{finding.datum}</div>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
