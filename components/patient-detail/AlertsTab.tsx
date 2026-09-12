"use client";

import { useState } from "react";
import { CircleAlert, GitCommit, ListChecks } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { EVIDENCE_QUALITY_LABEL, guidelineShortLabel, STRENGTH_LABEL } from "@/utils/guidelineLabels";
import { ARGOS_SUPPORT_LABEL, argosSupportLevel } from "@/utils/argosSupport";
import { computeSentinelFindings } from "@/engines/sentinel";
import { computeTurningPoints } from "@/engines/turningPoints";
import { computeMissingInfo, computeReviewOpportunities } from "@/engines/missingInfo";
import { detectContradictions } from "@/engines/longitudinal";
import { GUIDELINES } from "@/engines/guidelines";
import { activeProblemCategories } from "@/domain/diagnosis";
import { ArgosMark, Card, Eyebrow, GuidelineRecommendationText, KindTag, Modal, Val, WhyButton } from "@/components/ui";
import type { ArgosSupportLevel } from "@/utils/argosSupport";
import type { Patient } from "@/types/patient";
import type { ClinicalExplanation } from "@/types/evidence";
import type { SentinelFinding, SentinelStatusLabel } from "@/types/sentinel";

/**
 * Argos ("Aspectos a revisar") — vista de VIGILANCIA CLÍNICA RÁPIDA, no
 * una segunda "Revisión según guías". Cada tarjeta principal separa
 * visualmente 3 capas que antes vivían mezcladas en un mismo párrafo:
 *
 *   1. Hallazgo objetivo (`finding.datum`) — el dato tal cual, sin juicio.
 *   2. Interpretación de Argos (`finding.interpretation`) — frase corta,
 *      heurística interna de PulmoVista (ver engines/sentinel/
 *      interpretation.ts), nunca una recomendación de guía.
 *   3. Soporte de guía (`argosSupportLevel`) — solo 3 estados posibles
 *      (Respaldado por guía / Posible aplicabilidad / Sin interpretación
 *      basada en guía disponible), una lectura más gruesa de los estados
 *      Cumple/Posiblemente cumple/Información insuficiente/No cumple que
 *      ya calcula GuidelineMatch — esos 4 estados, la fuerza/calidad de
 *      evidencia y el texto original de la guía se han movido al detalle
 *      bajo interacción ("Ver recomendaciones"/"¿Por qué?"), no se
 *      duplican aquí ni se recalculan: es la misma `guidelineInterpretations`
 *      que ya produce engines/sentinel/guidelineInterpretation.ts.
 *
 * Nada de esto cambia criterios clínicos, umbrales ni reglas de guía —
 * es solo una reorganización visual de datos que los motores ya
 * calculaban.
 */

const STATUS_LABEL_TONE: Record<SentinelStatusLabel, { color: string; tint: string }> = {
  Cumple: { color: COLORS.green, tint: COLORS.greenTint },
  "Posiblemente cumple": { color: COLORS.orange, tint: COLORS.orangeTint },
  "Información insuficiente": { color: COLORS.slate, tint: COLORS.paper },
  "No cumple": { color: COLORS.slateLight, tint: COLORS.paper },
};

const ARGOS_SUPPORT_TONE: Record<ArgosSupportLevel, { color: string; tint: string }> = {
  respaldado: { color: COLORS.green, tint: COLORS.greenTint },
  posible: { color: COLORS.orange, tint: COLORS.orangeTint },
  sin_soporte: { color: COLORS.slate, tint: COLORS.paper },
};

function sentinelCardAccent(f: SentinelFinding): string {
  if (f.guidelineInterpretations.some((gi) => gi.statusLabel === "Cumple")) return COLORS.red;
  if (f.guidelineInterpretations.length) return COLORS.orange;
  return COLORS.slateLight;
}

function SupportPill({ level }: { level: ArgosSupportLevel }) {
  const tone = ARGOS_SUPPORT_TONE[level];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.tint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {ARGOS_SUPPORT_LABEL[level]}
    </span>
  );
}

function ViewRecommendationsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "none",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 8,
        padding: "5px 10px",
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.tealDeep,
      }}
    >
      <ListChecks size={13} /> Ver recomendaciones
    </button>
  );
}

/**
 * Detalle completo bajo interacción — mismo contenido que antes vivía
 * siempre visible en la tarjeta (estado Cumple/No cumple, texto original
 * de la guía, fuerza, calidad de evidencia): se traslada aquí sin
 * recalcular nada, misma `guidelineInterpretations` que ya trae la
 * tarjeta. No sustituye a "Revisión según guías" (que cubre TODAS las
 * recomendaciones del diagnóstico): esto son solo las relacionadas con
 * este hallazgo concreto.
 */
function RecommendationsModal({ finding, onClose, onWhy }: { finding: SentinelFinding; onClose: () => void; onWhy: (e: ClinicalExplanation) => void }) {
  return (
    <Modal title="Recomendaciones relacionadas" onClose={onClose} width={620}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>{finding.label}</div>
      <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 16 }}>{finding.datum}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {finding.guidelineInterpretations.map((gi) => {
          const tone = STATUS_LABEL_TONE[gi.statusLabel];
          return (
            <div key={gi.recommendationId} style={{ borderTop: `1px solid ${COLORS.line}`, paddingTop: 14 }}>
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
              <div style={{ margin: "8px 0" }}>
                <GuidelineRecommendationText interpretation={gi.interpretationSentence} verbatim={gi.recommendationText} />
              </div>
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
      </div>
    </Modal>
  );
}

/**
 * Tarjeta compacta — objetivo: que un neumólogo entienda en 10-15
 * segundos qué ha cambiado, si merece revisión y si hay soporte de guía,
 * sin abrir nada. Máximo 3 líneas de contenido (dato / interpretación /
 * soporte) antes de los botones de acción.
 */
function SentinelFindingCard({
  finding,
  onWhy,
  onViewRecommendations,
}: {
  finding: SentinelFinding;
  onWhy: (e: ClinicalExplanation) => void;
  onViewRecommendations: () => void;
}) {
  const level = argosSupportLevel(finding.guidelineInterpretations);
  const guidelineLabels = Array.from(new Set(finding.guidelineInterpretations.map((gi) => guidelineShortLabel(gi.society, gi.year))));

  return (
    <Card accent={sentinelCardAccent(finding)} style={{ padding: "14px 16px" }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{finding.label}</div>

      <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700, color: COLORS.slateLight, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.03em" }}>Dato objetivo </span>
        <span style={{ color: COLORS.ink }}>{finding.datum}</span>
      </div>

      <div style={{ marginTop: 5, fontSize: 13, color: COLORS.ink, lineHeight: 1.45 }}>{finding.interpretation}</div>

      <div style={{ marginTop: 10 }}>
        {level === "sin_soporte" ? (
          <div>
            <SupportPill level={level} />
            <div style={{ marginTop: 5, fontSize: 11.5, color: COLORS.slateLight, fontStyle: "italic" }}>
              Argos muestra el cambio objetivo, pero no asigna significado clínico.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <SupportPill level={level} />
            <span className="pv-mono" style={{ fontSize: 11, color: COLORS.slateLight }}>
              {guidelineLabels.join(" · ")} · recomendaciones relacionadas disponibles
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {!!finding.guidelineInterpretations.length && <ViewRecommendationsButton onClick={onViewRecommendations} />}
        <WhyButton onClick={() => onWhy(finding.explanation)} />
      </div>
    </Card>
  );
}

export function AlertsTab({ patient, onWhy }: { patient: Patient; onWhy: (explanation: ClinicalExplanation) => void }) {
  const findings = computeSentinelFindings(patient);
  const turningPoints = computeTurningPoints(patient);
  const missing = computeMissingInfo(patient);
  const opportunities = computeReviewOpportunities(patient);
  const contradictions = detectContradictions(patient);
  // Igual que el resto de motores (ver domain/diagnosis.ts#activeProblemCategories): un problema
  // clínico puede constar como diagnóstico secundario, no solo como principal — nunca se lee
  // patient.primaryDiagnosis a pelo para decidir qué categoría diagnóstica aplica.
  const activeCategories: string[] = activeProblemCategories(patient);
  const relatedGuidelines = GUIDELINES.filter((g) => activeCategories.includes(g.definition.disease));
  const [recommendationsFor, setRecommendationsFor] = useState<SentinelFinding | null>(null);

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <ArgosMark size={13} color={COLORS.teal} />
          <Eyebrow>Argos · Aspectos a revisar</Eyebrow>
        </div>
        {!findings.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>No se ha detectado un patrón de deterioro con los datos actuales.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {findings.map((f) => (
            <SentinelFindingCard key={f.signalId + (f.subject ?? "")} finding={f} onWhy={onWhy} onViewRecommendations={() => setRecommendationsFor(f)} />
          ))}
        </div>
      </div>

      <div>
        <Eyebrow color={COLORS.orange}>Momentos clave</Eyebrow>
        {!turningPoints.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>No se han identificado puntos de inflexión relevantes.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {turningPoints.map((tp) => (
            <Card key={tp.id} accent={COLORS.orange} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <GitCommit size={14} color={COLORS.orange} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.ink }}>{tp.label}</span>
                </div>
                <span style={{ fontSize: 11, color: COLORS.slateLight, whiteSpace: "nowrap", flexShrink: 0 }}>{formatDate(tp.date)}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "10px 0" }}>
                <div>
                  <div style={{ fontSize: 10.5, color: COLORS.slateLight, fontWeight: 700, marginBottom: 3 }}>ANTES</div>
                  {Object.entries(tp.before).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12, marginBottom: 2 }}>
                      {k}: <Val value={v} />
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: COLORS.slateLight, fontWeight: 700, marginBottom: 3 }}>DESPUÉS</div>
                  {Object.entries(tp.after).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 12, marginBottom: 2, fontWeight: 600 }}>
                      {k}: <Val value={v} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 8 }}>{tp.interpretation}</div>
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
        {!missing.items.length && !missing.groups.length && (
          <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>No se han identificado ausencias relevantes para este diagnóstico.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {missing.items.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: COLORS.ink, background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "8px 12px" }}>
              <CircleAlert size={13} color={COLORS.slateLight} style={{ flexShrink: 0, marginTop: 1 }} />
              {m}
            </div>
          ))}
          {missing.groups.map((g) => (
            <Card key={g.title} style={{ padding: "12px 14px" }} accent={COLORS.slate}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.ink }}>{g.title}</div>
                {g.explanation && <WhyButton onClick={() => onWhy(g.explanation!)} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {g.missingComponents.map((c) => (
                  <div key={c} style={{ fontSize: 12, color: COLORS.slate }}>
                    {c}: no consta
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Eyebrow color={COLORS.orange}>Oportunidades de revisión clínica</Eyebrow>
        {!opportunities.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>Sin oportunidades de revisión identificadas.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {opportunities.map((o) => (
            <Card key={o.id} accent={COLORS.orange} style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{o.title}</div>
              <div style={{ fontSize: 13, color: COLORS.ink, margin: "6px 0" }}>{o.detail}</div>
              <div style={{ fontSize: 12, color: COLORS.slateLight, fontStyle: "italic", marginBottom: 10 }}>{o.note}</div>
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

      {recommendationsFor && <RecommendationsModal finding={recommendationsFor} onClose={() => setRecommendationsFor(null)} onWhy={onWhy} />}
    </div>
  );
}
