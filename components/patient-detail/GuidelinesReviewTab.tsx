"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { todayISO } from "@/utils/date";
import { EVIDENCE_QUALITY_LABEL, guidelineShortLabel, STRENGTH_LABEL } from "@/utils/guidelineLabels";
import { buildCitation, criteriaSummaryText, criterionLine, evidenceLine, interpretationSentence } from "@/engines/guidelines/explain";
import { findRecommendationById, KNOWLEDGE_BASE_DOCUMENTS } from "@/engines/guidelines/knowledge";
import { matchPatientToGuidelines, SUPPORTED_DIAGNOSIS_CATEGORIES } from "@/engines/guidelines/match";
import { activeProblemCategories } from "@/domain/diagnosis";
import { Card, Eyebrow, Val, WhyButton } from "@/components/ui";
import type { Patient } from "@/types/patient";
import type { DiagnosisCategory } from "@/domain/diagnosis";
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
 *
 * El término técnico "GuidelineMatch" nunca se muestra: cada tarjeta
 * distingue tres cosas con su propio rótulo — Dato del paciente
 * (estructurado, calculable), Interpretación de PulmoVista (síntesis en
 * español de si el criterio se cumple, generada aquí) y Recomendación de
 * la guía (texto verbatim de la fuente, en su idioma original) — para que
 * no lea como una única respuesta generada por IA.
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

function categoryLabel(cat: DiagnosisCategory): string {
  switch (cat) {
    case "Bronquiectasias":
      return "bronquiectasias";
    case "EPOC":
      return "EPOC";
    case "Fibrosis pulmonar":
      return "fibrosis pulmonar";
    case "General":
      return "otros problemas no clasificados";
  }
}

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
      { label: "Criterio clínico de la guía", text: criteriaSummaryText(match) },
      { label: "Interpretación de PulmoVista", text: interpretationSentence(match.status) },
      { label: "Recomendación", text: recommendation?.recommendationText ?? "Texto no disponible." },
    ],
    evidence: match.patientEvidence,
    citation: buildCitation(match, document),
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

/** Bloque con rótulo — usado para distinguir visualmente dato / interpretación / recomendación dentro de la tarjeta. */
function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.slateLight, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
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

      {/* Tres bloques con su propio rótulo: dato objetivo / síntesis de PulmoVista / texto verbatim de la guía — nunca mezclados en un único párrafo. */}
      <Block label="Dato del paciente">
        {match.patientEvidence.length ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {match.patientEvidence.map((e, i) => (
              <li key={i} style={{ fontSize: 12.5, color: COLORS.ink, padding: "2px 0", display: "flex", gap: 6 }}>
                <span style={{ color: COLORS.slate, fontWeight: 700, flexShrink: 0 }}>›</span> {evidenceLine(e)}
              </li>
            ))}
          </ul>
        ) : (
          <span style={{ fontSize: 12.5, color: COLORS.slateLight, fontStyle: "italic" }}>Sin datos estructurados del paciente asociados a esta evaluación.</span>
        )}
      </Block>

      <Block label="Interpretación de PulmoVista">
        <span style={{ fontSize: 13, fontStyle: "italic", color: COLORS.navy }}>{interpretationSentence(match.status)}</span>
      </Block>

      <Block label="Recomendación de la guía">
        <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.45, color: COLORS.ink }}>{recommendation.recommendationText}</span>
      </Block>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 0 0", fontSize: 12.5 }}>
        <span>
          <span style={{ color: COLORS.slateLight, fontWeight: 700 }}>Fuerza </span>
          <Val value={recommendation.strength ? STRENGTH_LABEL[recommendation.strength] : null} />
        </span>
        <span>
          <span style={{ color: COLORS.slateLight, fontWeight: 700 }}>Calidad de evidencia </span>
          <Val value={recommendation.evidenceQuality ? EVIDENCE_QUALITY_LABEL[recommendation.evidenceQuality] : null} />
        </span>
      </div>

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

/**
 * Estado informativo cuando ningún problema clínico activo del paciente
 * tiene una base de conocimiento conectada. No es un error: PulmoVista
 * simplemente no aplica una guía que no corresponde al problema clínico
 * actual, y lo dice explícitamente en vez de mostrar una pantalla vacía.
 */
function NoCompatibleGuideline({ patient }: { patient: Patient }) {
  const activeProblems = activeProblemCategories(patient);
  const supportedLabel = SUPPORTED_DIAGNOSIS_CATEGORIES.map(categoryLabel).join(", ");
  const problemsLabel = activeProblems.map(categoryLabel).join(", ");

  return (
    <Card accent={COLORS.slateLight}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Info size={20} color={COLORS.slateLight} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.ink }}>No hay una guía compatible disponible para este problema clínico</div>
          <p style={{ fontSize: 13.5, color: COLORS.slate, marginTop: 8, lineHeight: 1.55, maxWidth: 620 }}>
            Actualmente PulmoVista dispone de una base de conocimiento estructurada para {supportedLabel}. No se han aplicado
            recomendaciones de esa guía porque el diagnóstico registrado ({problemsLabel}) no corresponde a esa categoría.
          </p>
          <p style={{ fontSize: 12, color: COLORS.slateLight, marginTop: 10, lineHeight: 1.5, maxWidth: 620 }}>
            Esto no es un error ni una omisión: PulmoVista no aplica una guía que no corresponde al problema clínico del
            paciente. A medida que se incorporen bases de conocimiento para otros problemas, esta pestaña mostrará sus
            recomendaciones automáticamente.
          </p>
        </div>
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
      </div>

      {!matches.length && <NoCompatibleGuideline patient={patient} />}

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
