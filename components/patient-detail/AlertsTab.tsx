"use client";

import { CircleAlert, GitCommit, TrendingDown } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { EVIDENCE_QUALITY_LABEL, guidelineShortLabel, STRENGTH_LABEL } from "@/utils/guidelineLabels";
import { computeSentinelFindings } from "@/engines/sentinel";
import { computeTurningPoints } from "@/engines/turningPoints";
import { computeMissingInfo, computeReviewOpportunities } from "@/engines/missingInfo";
import { detectContradictions } from "@/engines/longitudinal";
import { findGuidelinesForDiagnosis } from "@/engines/guidelines";
import { Card, Eyebrow, KindTag, Val, WhyButton } from "@/components/ui";
import type { Patient } from "@/types/patient";
import type { ClinicalExplanation } from "@/types/evidence";
import type { SentinelFinding, SentinelStatusLabel } from "@/types/sentinel";

/** Color por SentinelStatusLabel — misma paleta que los 4 estados de la pestaña "Revisión según guías" (green/orange/slate/slateLight). */
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

export function AlertsTab({ patient, onWhy }: { patient: Patient; onWhy: (explanation: ClinicalExplanation) => void }) {
  const findings = computeSentinelFindings(patient);
  const turningPoints = computeTurningPoints(patient);
  const missing = computeMissingInfo(patient);
  const opportunities = computeReviewOpportunities(patient);
  const contradictions = detectContradictions(patient);
  const relatedGuidelines = findGuidelinesForDiagnosis(patient.primaryDiagnosis);

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Eyebrow>PulmoVista Sentinel</Eyebrow>
        </div>
        {!findings.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>No se ha detectado un patrón de deterioro con los datos actuales.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {findings.map((f) => (
            <Card key={f.signalId + (f.subject ?? "")} accent={sentinelCardAccent(f)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 7 }}>
                  <TrendingDown size={16} color={COLORS.red} /> {f.label}
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.slateLight, textTransform: "uppercase" }}>Dato objetivo </span>
                <span style={{ fontSize: 13 }}>{f.datum}</span>
              </div>

              {!f.guidelineInterpretations.length && (
                <div style={{ marginTop: 12, fontSize: 13, fontStyle: "italic", color: COLORS.slateLight, background: COLORS.paper, borderRadius: 8, padding: "9px 12px" }}>
                  {f.noSupportMessage}
                </div>
              )}

              {f.guidelineInterpretations.map((gi) => {
                const tone = STATUS_LABEL_TONE[gi.statusLabel];
                return (
                  <div key={gi.recommendationId} style={{ marginTop: 12, borderTop: `1px dashed ${COLORS.line}`, paddingTop: 12 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <KindTag kind="guideline" />
                      <span
                        className="pv-mono"
                        style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.tealDeep, background: COLORS.tealTint, padding: "3px 9px", borderRadius: 20 }}
                      >
                        {guidelineShortLabel(gi.society, gi.year)}
                      </span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.tint, padding: "3px 9px", borderRadius: 20 }}>
                        {gi.statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, margin: "8px 0" }}>{gi.recommendationText}</div>
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.slate }}>
                      <span>
                        Fuerza: <Val value={gi.strength ? STRENGTH_LABEL[gi.strength] : null} />
                      </span>
                      <span>
                        Calidad de evidencia: <Val value={gi.evidenceQuality ? EVIDENCE_QUALITY_LABEL[gi.evidenceQuality] : null} />
                      </span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <WhyButton onClick={() => onWhy(gi.explanation)} />
                    </div>
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Eyebrow color={COLORS.orange}>Momentos clave</Eyebrow>
        {!turningPoints.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>No se han identificado puntos de inflexión relevantes.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {turningPoints.map((tp) => (
            <Card key={tp.id} accent={COLORS.orange}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 7 }}>
                  <GitCommit size={15} color={COLORS.orange} /> {tp.label}
                </div>
                <KindTag kind={tp.explanation.kindLabel} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, margin: "10px 0" }}>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.slateLight, fontWeight: 700, marginBottom: 4 }}>ANTES</div>
                  {Object.entries(tp.before).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12.5, marginBottom: 2 }}>
                      {k}: <Val value={v} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.slateLight, fontWeight: 700, marginBottom: 4 }}>DESPUÉS</div>
                  {Object.entries(tp.after).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12.5, marginBottom: 2, fontWeight: 600 }}>
                      {k}: <Val value={v} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 13, fontStyle: "italic", color: COLORS.slate, marginBottom: 10 }}>{tp.interpretation}</div>
              <WhyButton onClick={() => onWhy(tp.explanation)} />
            </Card>
          ))}
        </div>
      </div>

      {!!contradictions.length && (
        <div>
          <Eyebrow color={COLORS.red}>Datos potencialmente contradictorios</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {contradictions.map((c) => (
              <div key={c.id} style={{ fontSize: 13, background: COLORS.redTint, borderRadius: 9, padding: "10px 14px" }}>
                {c.message}
                <br />
                <span style={{ fontStyle: "italic", color: COLORS.slate }}>{c.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Eyebrow color={COLORS.slate}>¿Qué me falta revisar?</Eyebrow>
          <span style={{ fontSize: 10.5, color: COLORS.slateLight }}>Lista de comprobación para: {missing.category}</span>
        </div>
        {!missing.items.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>No se han identificado ausencias relevantes para este diagnóstico.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {missing.items.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: COLORS.ink, background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "9px 12px" }}>
              <CircleAlert size={14} color={COLORS.slateLight} style={{ flexShrink: 0, marginTop: 1 }} />
              {m}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Eyebrow color={COLORS.orange}>Oportunidades de revisión clínica</Eyebrow>
        {!opportunities.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>Sin oportunidades de revisión identificadas.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {opportunities.map((o) => (
            <Card key={o.id} accent={COLORS.orange}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.title}</div>
              <div style={{ fontSize: 13, color: COLORS.ink, margin: "6px 0" }}>{o.detail}</div>
              <div style={{ fontSize: 12.5, color: COLORS.slateLight, fontStyle: "italic", marginBottom: 10 }}>{o.note}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.orange, background: COLORS.orangeTint, padding: "4px 10px", borderRadius: 20 }}>{o.action}</span>
                {relatedGuidelines.map((g) => (
                  <span key={g.definition.guidelineId} className="pv-mono" style={{ fontSize: 10.5, color: COLORS.slateLight }}>
                    {g.definition.source.title} ({g.definition.source.year})
                  </span>
                ))}
                {!relatedGuidelines.length && <span style={{ fontSize: 11, color: COLORS.slateLight, fontStyle: "italic" }}>No se dispone de una recomendación validada para esta situación.</span>}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
