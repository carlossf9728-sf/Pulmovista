"use client";

import { CircleAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { usePatients } from "@/app/providers";
import { classifyDiagnosis } from "@/domain/diagnosis";
import { GUIDELINES } from "@/engines/guidelines";
import { Card, Eyebrow } from "@/components/ui";

export function GuidelinesView() {
  const { patients } = usePatients();
  const covered = new Set(GUIDELINES.map((g) => g.definition.disease));
  const uncovered = [...new Set(patients.map((p) => classifyDiagnosis(p.primaryDiagnosis)))].filter((d) => !covered.has(d));

  return (
    <div className="pv-fade-in">
      <Eyebrow>Guías clínicas</Eyebrow>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 4px" }}>Base de conocimiento</h1>
      <p style={{ color: COLORS.slate, fontSize: 13.5, marginBottom: 8, maxWidth: 640 }}>
        Estructura preparada para incorporar guías de bronquiectasias, EPOC, EPID, fibrosis quística, hipertensión pulmonar y
        trasplante, y para implementar RAG en el futuro.
      </p>
      <div style={{ fontSize: 12, color: COLORS.slateLight, marginBottom: 20, display: "flex", gap: 6, alignItems: "center" }}>
        <CircleAlert size={13} /> El contenido mostrado a continuación es simulado — no se han cargado textos reales de
        recomendaciones ni número de página.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 26 }}>
        {GUIDELINES.map((g) => (
          <Card key={g.definition.guidelineId} accent={COLORS.teal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.definition.source.title}</div>
                <div style={{ fontSize: 12.5, color: COLORS.slate, margin: "4px 0" }}>
                  {g.definition.source.society} · {g.definition.source.year}
                </div>
              </div>
              <span className="pv-mono" style={{ fontSize: 10.5, color: COLORS.slateLight }}>
                {g.definition.guidelineId}
              </span>
            </div>
            <span style={{ fontSize: 11.5, background: COLORS.tealTint, color: COLORS.tealDeep, padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>
              Sección: {g.definition.section}
            </span>
            <div style={{ fontSize: 12.5, color: COLORS.slateLight, fontStyle: "italic", marginTop: 10 }}>
              {g.recommendations[0]?.recommendationText}
            </div>
          </Card>
        ))}
      </div>
      {uncovered.length > 0 && (
        <>
          <Eyebrow color={COLORS.slate}>Sin recomendación cargada</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {uncovered.map((d, i) => (
              <div key={i} style={{ fontSize: 13, color: COLORS.slateLight, fontStyle: "italic", padding: "10px 14px", background: COLORS.white, border: `1px dashed ${COLORS.line}`, borderRadius: 9 }}>
                {d}: no se dispone de una recomendación validada para esta situación.
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
