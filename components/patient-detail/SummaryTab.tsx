"use client";

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { COLORS } from "@/utils/theme";
import { cap } from "@/utils/text";
import { formatDate, todayISO } from "@/utils/date";
import { selectHospitalizationCount, selectMicrobiology, selectPFT, selectTreatments, exacerbationsByYear } from "@/domain/selectors";
import { changeTrend } from "@/domain/changeTrend";
import { activeProblemCategories } from "@/domain/diagnosis";
import { computeChangesSinceLastVisit } from "@/engines/longitudinal";
import { computeTurningPoints, shortTurningPointLabel } from "@/engines/turningPoints";
import { computeSentinelFindings } from "@/engines/sentinel";
import { computeMissingInfo } from "@/engines/missingInfo";
import { matchPatientToGuidelines, SUPPORTED_DIAGNOSIS_CATEGORIES } from "@/engines/guidelines/match";
import { findRecommendationById } from "@/engines/guidelines/knowledge";
import { buildGuidelineMatchExplanation, patientDatumLines } from "@/engines/guidelines/explain";
import { Card, Eyebrow, TrendBadge, Val, WhyButton } from "@/components/ui";
import type { Patient } from "@/types/patient";
import type { ClinicalChange } from "@/types/longitudinal";
import type { ClinicalExplanation } from "@/types/evidence";
import type { ClinicalTrend } from "@/types/clinicalTrend";
import type { GuidelineMatch } from "@/types/guideline";
import type { TurningPoint } from "@/types/turningPoints";

/**
 * Resumen clínico — síntesis priorizada, no un listado exhaustivo. El
 * detalle completo de cada bloque sigue viviendo en su pestaña propia
 * ("Alertas", "Revisión según guías", Cronología): aquí solo se muestran
 * las 2-3 prioridades de cada uno, con "¿Por qué?" para el razonamiento
 * completo (incluido el texto verbatim de la guía, que nunca se muestra
 * aquí). No se evalúa nada nuevo: todo se deriva de motores ya
 * existentes (Sentinel, Turning Points, GuidelineMatch, MissingInfo,
 * LongitudinalEngine).
 */

const MAX_VISIBLE_CHANGES = 3;

/** Empeoramiento primero, luego Mejoría, luego el resto — nunca al azar, para que las 3 filas visibles sean siempre las más relevantes. */
function changeTrendRank(trend: ClinicalTrend): number {
  if (trend === "Empeoramiento") return 0;
  if (trend === "Mejoría") return 1;
  return 2;
}

function rankedChanges(changes: ClinicalChange[], window: { fromDate: string; toDate: string; turningPoints: TurningPoint[] }): { change: ClinicalChange; trend: ClinicalTrend }[] {
  return changes.map((change) => ({ change, trend: changeTrend(change, window) })).sort((a, b) => changeTrendRank(a.trend) - changeTrendRank(b.trend));
}

interface TodayPriority {
  key: string;
  /** Título clínico corto — el `topic` ya clasificado de la recomendación (p. ej. "Antibióticos inhalados"), nunca el texto verbatim de la guía. */
  title: string;
  statusLabel: string;
  /** Motivo clínico resumido en una línea — mismo resumen del dato del paciente que ya usa el modal "¿Por qué?" (patientDatumLines), no un texto nuevo. */
  motivo: string;
  explanation: ClinicalExplanation;
}

function buildTodayPriority(patient: Patient, match: GuidelineMatch, statusLabel: string, explanation: ClinicalExplanation): TodayPriority | null {
  const recommendation = findRecommendationById(match.recommendationId);
  if (!recommendation) return null;
  return {
    key: match.recommendationId,
    title: cap(recommendation.topic) ?? recommendation.topic,
    statusLabel,
    motivo: patientDatumLines(patient, match, recommendation.applicability).join(" · "),
    explanation,
  };
}

/**
 * Hasta 3 prioridades clínicas de hoy, combinando dos motores ya
 * existentes — nunca una regla nueva, solo selección/orden para no
 * repetir el listado completo:
 *  1. Hallazgos de Sentinel con una interpretación de guía que "Cumple"
 *     (dato objetivo de deterioro + guía que ya confirma una recomendación).
 *  2. Recomendaciones de matchPatientToGuidelines con estado "applies"
 *     no cubiertas ya por el punto 1, hasta completar 3.
 */
function computeTodayPriorities(patient: Patient): TodayPriority[] {
  const priorities: TodayPriority[] = [];
  const seen = new Set<string>();
  const matches = matchPatientToGuidelines(patient, todayISO());
  const matchById = new Map(matches.map((m) => [m.recommendationId, m]));

  for (const finding of computeSentinelFindings(patient)) {
    for (const gi of finding.guidelineInterpretations) {
      if (gi.statusLabel !== "Cumple" || seen.has(gi.recommendationId)) continue;
      const match = matchById.get(gi.recommendationId);
      if (!match) continue;
      const priority = buildTodayPriority(patient, match, gi.statusLabel, gi.explanation);
      if (priority) {
        seen.add(gi.recommendationId);
        priorities.push(priority);
      }
    }
  }

  if (priorities.length < 3) {
    for (const match of matches) {
      if (priorities.length >= 3) break;
      if (match.status !== "applies" || seen.has(match.recommendationId)) continue;
      const priority = buildTodayPriority(patient, match, "Aplica", buildGuidelineMatchExplanation(patient, match));
      if (priority) {
        seen.add(match.recommendationId);
        priorities.push(priority);
      }
    }
  }

  return priorities.slice(0, 3);
}

function sortTurningPointsByDateDesc(points: TurningPoint[]): TurningPoint[] {
  return [...points].sort((a, b) => b.date.localeCompare(a.date));
}

function SectionCard({ title, color, children }: { title: string; color?: string; children: ReactNode }) {
  return (
    <Card accent={color}>
      <Eyebrow color={color}>{title}</Eyebrow>
      <div style={{ marginTop: 12 }}>{children}</div>
    </Card>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: COLORS.slateLight }}>{text}</div>;
}

export function SummaryTab({ patient, onWhy }: { patient: Patient; onWhy: (explanation: ClinicalExplanation) => void }) {
  const pft = selectPFT(patient.events).slice(-1)[0];
  const years = exacerbationsByYear(patient);
  const lastYear = years.length ? years[years.length - 1] : null;
  const hospTotal = selectHospitalizationCount(patient.events, null) || selectHospitalizationCount(patient.events, todayISO());
  const lastMicro = selectMicrobiology(patient.events).slice(-1)[0];
  const activeTreatments = selectTreatments(patient.events).filter((t) => t.status === "Activo");
  const activeProblems = [patient.primaryDiagnosis, ...patient.secondaryDiagnoses.split(/[,;]/).map((s) => s.trim())].filter(Boolean);

  const changes = computeChangesSinceLastVisit(patient);
  const turningPoints = computeTurningPoints(patient);
  const recentTurningPoints = sortTurningPointsByDateDesc(turningPoints).slice(0, 2);
  const missing = computeMissingInfo(patient);
  const topMissing = missing.items.slice(0, 3);
  const priorities = computeTodayPriorities(patient);
  const hasGuidelineCoverage = activeProblemCategories(patient).some((c) => SUPPORTED_DIAGNOSIS_CATEGORIES.includes(c));

  const topChanges = changes ? rankedChanges(changes.changes, { fromDate: changes.fromDate, toDate: changes.toDate, turningPoints }).slice(0, MAX_VISIBLE_CHANGES) : [];

  const fields: [string, string | null][] = [
    ["FEV1 más reciente", pft ? `${pft.FEV1Percent ?? "—"}%${pft.FEV1Liters ? ` (${pft.FEV1Liters} L)` : ""}` : null],
    ["FVC", pft && pft.FVCPercent != null ? `${pft.FVCPercent}%${pft.FVCLiters ? ` (${pft.FVCLiters} L)` : ""}` : null],
    ["DLCO", pft && pft.DLCOPercent != null ? `${pft.DLCOPercent}%` : null],
    [lastYear ? `Exacerbaciones en ${lastYear.year}` : "Exacerbaciones (año en curso)", lastYear ? `${lastYear.count}` : null],
    ["Hospitalizaciones (acumuladas)", hospTotal != null ? `${hospTotal}` : null],
    ["Microbiología relevante", lastMicro ? `${lastMicro.organism} (${formatDate(lastMicro.date)})` : null],
    ["Tratamiento y soporte actual", activeTreatments.length ? activeTreatments.map((t) => t.name).join(", ") : null],
  ];

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionCard title="Estado actual">
        {!!activeProblems.length && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {activeProblems.map((p, i) => (
              <span
                key={i}
                style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 20, padding: "3px 10px" }}
              >
                {p}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                <Val value={value} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Qué ha cambiado desde la última consulta" color={COLORS.teal}>
        {!changes && <EmptyNote text="Aún no hay suficientes consultas para comparar." />}
        {changes && (
          <>
            <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginBottom: 10 }}>
              {formatDate(changes.fromDate)} → {formatDate(changes.toDate)}
            </div>
            {!changes.changes.length && <EmptyNote text="Sin cambios relevantes detectados entre ambas consultas." />}
            {!!changes.changes.length && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topChanges.map(({ change: c, trend }, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5, padding: "8px 0", borderBottom: i < topChanges.length - 1 ? `1px solid ${COLORS.line}` : "none" }}
                  >
                    <span style={{ fontWeight: 700 }}>{c.label}</span>
                    <span className="pv-mono" style={{ color: COLORS.slate }}>
                      {c.from}
                    </span>
                    <ArrowRight size={12} color={COLORS.slateLight} />
                    <span className="pv-mono" style={{ fontWeight: 700, color: COLORS.ink }}>
                      {c.to}
                    </span>
                    {trend && (
                      <span style={{ marginLeft: "auto" }}>
                        <TrendBadge trend={trend} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {changes.changes.length > topChanges.length && <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginTop: 10 }}>Ver todo en “Cronología”.</div>}
          </>
        )}
      </SectionCard>

      <SectionCard title="Qué revisar hoy" color={COLORS.orange}>
        {!priorities.length && (
          <EmptyNote
            text={
              hasGuidelineCoverage
                ? "Sin prioridades clínicas identificadas con los datos y guías actuales."
                : "PulmoVista todavía no tiene una guía clínica cargada para este diagnóstico. No es un fallo del sistema: es una limitación de cobertura actual, que iremos ampliando."
            }
          />
        )}
        {!!priorities.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {priorities.map((p) => (
              <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>
                    {p.title} — <span style={{ color: COLORS.green }}>{p.statusLabel}</span>
                  </div>
                  {p.motivo && <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 3 }}>Motivo: {p.motivo}</div>}
                </div>
                <WhyButton onClick={() => onWhy(p.explanation)} />
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginTop: 12 }}>Ver todas las recomendaciones en “Revisión según guías”.</div>
      </SectionCard>

      <SectionCard title="Qué información falta" color={COLORS.slate}>
        {!topMissing.length && <EmptyNote text="No se han identificado ausencias relevantes para este diagnóstico." />}
        {!!topMissing.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topMissing.map((m, i) => (
              <div key={i} style={{ fontSize: 13, color: COLORS.ink }}>
                {m}
              </div>
            ))}
          </div>
        )}
        {missing.items.length > topMissing.length && (
          <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginTop: 10 }}>
            +{missing.items.length - topMissing.length} más en “Alertas”.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Momentos clave" color={COLORS.orange}>
        {!recentTurningPoints.length && <EmptyNote text="No se han identificado puntos de inflexión relevantes." />}
        {!!recentTurningPoints.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recentTurningPoints.map((tp) => (
              <div key={tp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                <div>
                  <span style={{ fontSize: 11.5, color: COLORS.slateLight, marginRight: 8 }}>{formatDate(tp.date)}</span>
                  <span style={{ color: COLORS.ink }}>{shortTurningPointLabel(tp)}</span>
                </div>
                <WhyButton onClick={() => onWhy(tp.explanation)} />
              </div>
            ))}
          </div>
        )}
        {turningPoints.length > recentTurningPoints.length && (
          <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginTop: 10 }}>Ver la evolución completa en “Alertas”.</div>
        )}
      </SectionCard>
    </div>
  );
}
