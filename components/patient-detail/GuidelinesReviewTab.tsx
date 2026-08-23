"use client";

import { useMemo } from "react";
import { CircleAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { todayISO } from "@/utils/date";
import { EVIDENCE_QUALITY_LABEL, guidelineShortLabel, STRENGTH_LABEL } from "@/utils/guidelineLabels";
import { criteriaSummaryText, criterionLine, evidenceLine } from "@/engines/guidelines/explain";
import { findRecommendationById, KNOWLEDGE_BASE_DOCUMENTS } from "@/engines/guidelines/knowledge";
import { matchPatientToGuidelines } from "@/engines/guidelines/match";
import { Card, Eyebrow, Val, WhyButton } from "@/components/ui";
import type { Patient } from "@/types/patient";
import type { GuidelineMatch, GuidelineMatchStatus } from "@/types/guideline";
import type { ClinicalExplanation } from "@/types/evidence";

/**
 * Pestaña "Revisión según guías" — capa de presentación pura sobre
 * GuidelineMatch (engines/guidelines/match.ts). No evalúa nada por su
 * cuenta, no reescribe recommendationText/sourceText, y no añade ninguna
 * regla clínica: solo agrupa y muestra lo que matchPatientToGuidelines ya
 * calculó, con su trazabilidad completa. Alcance actual de GuidelineMatch:
 * macrólidos, antibióticos inhalados, erradicación de Pseudomonas,
 * corticoides inhalados y fisioterapia/aclaramiento de vía aérea (ERS 2025
 * + SEPAR 2018, evaluadas siempre por separado). NO conectado a Sentinel,
 * Turning Points, Missing Information ni Review Opportunities.
 */

const STATUS_GROUPS: {
  key: GuidelineMatchStatus;
  label: string;
  singularLabel: string;
  color: string;
  tint: string;
  emptyText: string;
}[] = [
  {
    key: "applies",
    label: "Aplicables",
    singularLabel: "Aplica",
    color: COLORS.green,
    tint: COLORS.greenTint,
    emptyText: "Ninguna recomendación evaluada como aplicable con los datos actuales.",
  },
  {
    key: "possibly_applies",
    label: "Posiblemente aplicables",
    singularLabel: "Posiblemente aplica",
    color: COLORS.orange,
    tint: COLORS.orangeTint,
    emptyText: "Ninguna recomendación evaluada como posiblemente aplicable.",
  },
  {
    key: "insufficient_data",
    label: "Información insuficiente",
    singularLabel: "Falta información",
    color: COLORS.slate,
    tint: COLORS.paper,
    emptyText: "No hay recomendaciones marcadas con información insuficiente.",
  },
  {
    key: "does_not_apply",
    label: "No aplicables",
    singularLabel: "No aplica",
    color: COLORS.slateLight,
    tint: COLORS.paper,
    emptyText: "Ninguna recomendación evaluada como no aplicable.",
  },
];

function buildExplanation(match: GuidelineMatch): ClinicalExplanation {
  const recommendation = findRecommendationById(match.recommendationId);
  const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === match.guidelineCitation.guidelineId);

  const datoText = match.patientEvidence.length
    ? match.patientEvidence.map(evidenceLine).join(" · ")
    : "Esta recomendación no depende de ningún dato concreto del paciente (sin criterios acotados en la base de conocimiento).";

  return {
    kindLabel: "guideline",
    source: {
      kind: "guideline",
      guidelineId: match.guidelineCitation.guidelineId,
      recommendationId: match.recommendationId,
      society: document?.source.society ?? match.guidelineCitation.guidelineId,
      year: document?.source.year ?? 0,
      section: match.guidelineCitation.section,
      page: match.guidelineCitation.page,
    },
    sections: [
      { label: "Dato del paciente", emphasis: true, text: datoText },
      { label: "Criterio de la guía", text: criteriaSummaryText(match) },
      { label: "Recomendación", text: recommendation?.recommendationText ?? "Texto no disponible." },
      { label: "Sección", text: match.guidelineCitation.section ?? "No documentada por la guía." },
      { label: "Página", text: match.guidelineCitation.page != null ? `p. ${match.guidelineCitation.page}` : "No documentada por la guía." },
      { label: "Fragmento fuente", text: match.guidelineCitation.sourceText },
    ],
    evidence: match.patientEvidence,
  };
}

function CriterionList({ label, items, emptyText, tone }: { label: string; items: string[]; emptyText: string; tone: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.slateLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: COLORS.slateLight, fontStyle: "italic", marginTop: 3 }}>{emptyText}</div>
      ) : (
        <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
          {items.map((item, i) => (
            <li key={i} style={{ fontSize: 12.5, color: COLORS.ink, padding: "2px 0", display: "flex", gap: 6 }}>
              <span style={{ color: tone, fontWeight: 700, flexShrink: 0 }}>›</span> {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchCard({ match, onWhy }: { match: GuidelineMatch; onWhy: () => void }) {
  const recommendation = findRecommendationById(match.recommendationId);
  const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === match.guidelineCitation.guidelineId);
  const group = STATUS_GROUPS.find((g) => g.key === match.status);
  if (!recommendation || !document || !group) return null;

  return (
    <Card accent={group.color}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.45, flex: 1, minWidth: 220 }}>{recommendation.recommendationText}</div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <span
            className="pv-mono"
            style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.tealDeep, background: COLORS.tealTint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}
          >
            {guidelineShortLabel(document.source.society, document.source.year)}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: group.color, background: group.tint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
            {group.singularLabel}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "10px 0 0", fontSize: 12.5 }}>
        <span>
          <span style={{ color: COLORS.slateLight, fontWeight: 700 }}>Fuerza </span>
          <Val value={recommendation.strength ? STRENGTH_LABEL[recommendation.strength] : null} />
        </span>
        <span>
          <span style={{ color: COLORS.slateLight, fontWeight: 700 }}>Calidad de evidencia </span>
          <Val value={recommendation.evidenceQuality ? EVIDENCE_QUALITY_LABEL[recommendation.evidenceQuality] : null} />
        </span>
      </div>

      <CriterionList
        label="Datos del paciente utilizados"
        items={match.patientEvidence.map(evidenceLine)}
        emptyText="Sin datos estructurados del paciente asociados a esta evaluación."
        tone={COLORS.slate}
      />
      <CriterionList label="Criterios cumplidos" items={match.matchedCriteria.map(criterionLine)} emptyText="Ninguno." tone={COLORS.green} />
      <CriterionList label="Criterios que faltan" items={match.missingCriteria.map(criterionLine)} emptyText="Ninguno." tone={COLORS.slate} />
      {match.unmatchedCriteria.length > 0 && (
        <CriterionList label="Criterios no cumplidos" items={match.unmatchedCriteria.map(criterionLine)} emptyText="Ninguno." tone={COLORS.slateLight} />
      )}
      <CriterionList label="Exclusiones o conflictos" items={match.conflictingCriteria.map(criterionLine)} emptyText="Ninguna." tone={COLORS.red} />

      <div style={{ marginTop: 12 }}>
        <WhyButton onClick={onWhy} />
      </div>
    </Card>
  );
}

export function GuidelinesReviewTab({ patient, onWhy }: { patient: Patient; onWhy: (explanation: ClinicalExplanation) => void }) {
  const matches = useMemo(() => matchPatientToGuidelines(patient, todayISO()), [patient]);

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <Eyebrow>Revisión según guías</Eyebrow>
        <p style={{ fontSize: 13, color: COLORS.slate, margin: "6px 0 0", maxWidth: 700, lineHeight: 1.5 }}>
          Evaluación automática de las recomendaciones soportadas de ERS 2025 y SEPAR 2018 —
          macrólidos, antibióticos inhalados, erradicación de Pseudomonas, corticoides inhalados y fisioterapia/
          aclaramiento de vía aérea — contra los datos estructurados de este paciente. ERS y SEPAR se evalúan siempre
          por separado; nunca se fusionan.
        </p>
        {!matches.length && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.slateLight, display: "flex", gap: 6, alignItems: "flex-start" }}>
            <CircleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Esta base de conocimiento cubre bronquiectasias. Si el diagnóstico principal registrado no clasifica en
            esa categoría, no hay recomendaciones que evaluar.
          </div>
        )}
      </div>

      {STATUS_GROUPS.map((group) => {
        const items = matches.filter((m) => m.status === group.key);
        if (!matches.length) return null;
        return (
          <div key={group.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Eyebrow color={group.color}>{group.label}</Eyebrow>
              <span style={{ fontSize: 11, fontWeight: 700, color: group.color, background: group.tint, borderRadius: 20, padding: "1px 8px" }}>{items.length}</span>
            </div>
            {!items.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>{group.emptyText}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {items.map((m) => (
                <MatchCard key={m.recommendationId} match={m} onWhy={() => onWhy(buildExplanation(m))} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
