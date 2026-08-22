"use client";

import Link from "next/link";
import { COLORS } from "@/utils/theme";
import { usePatients } from "@/app/providers";
import { computeSentinelFindings } from "@/engines/sentinel";
import { Card, ConfidencePill, Eyebrow, KindTag } from "@/components/ui";

export function SentinelView() {
  const { patients } = usePatients();
  const all = patients.flatMap((p) => computeSentinelFindings(p).map((finding) => ({ patient: p, finding })));

  return (
    <div className="pv-fade-in">
      <Eyebrow>Sentinel</Eyebrow>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 4px" }}>PulmoVista Sentinel</h1>
      <p style={{ color: COLORS.slate, fontSize: 13.5, marginBottom: 22, maxWidth: 640 }}>
        Capa de vigilancia longitudinal. Las señales proceden hoy de heurísticas locales sobre tendencias objetivas; la
        arquitectura queda preparada para incorporar reglas basadas en guías reales y, más adelante, modelos de IA.
      </p>
      {!all.length && <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No se han detectado alertas activas.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {all.map(({ patient, finding }, i) => (
          <Card key={i} accent={finding.confidence === "Alta" ? COLORS.red : COLORS.orange} style={{ cursor: "pointer" }}>
            <Link href={`/pacientes/${patient.id}?tab=alertas`} style={{ display: "block", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div className="pv-mono" style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>
                    {patient.code}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.slate }}>{patient.primaryDiagnosis}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <KindTag kind={finding.explanation.kindLabel} />
                  <ConfidencePill level={finding.confidence} />
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
