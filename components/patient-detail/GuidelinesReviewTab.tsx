"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { todayISO } from "@/utils/date";
import { EVIDENCE_QUALITY_LABEL, guidelineShortLabel, STRENGTH_LABEL } from "@/utils/guidelineLabels";
import { buildCitation, criteriaSummaryText, interpretationSentence, patientDatumLines } from "@/engines/guidelines/explain";
import { diffChangedRecommendations, snapshotStatuses } from "@/engines/guidelines/changeTracking";
import { findRecommendationById, KNOWLEDGE_BASE_DOCUMENTS } from "@/engines/guidelines/knowledge";
import { matchPatientToGuidelines, SUPPORTED_DIAGNOSIS_CATEGORIES } from "@/engines/guidelines/match";
import { activeProblemCategories } from "@/domain/diagnosis";
import { Card, Eyebrow, WhyButton } from "@/components/ui";
import type { Patient } from "@/types/patient";
import type { DiagnosisCategory } from "@/domain/diagnosis";
import type { GuidelineMatch, GuidelineMatchStatus } from "@/types/guideline";
import type { GuidelineStatusSnapshot } from "@/engines/guidelines/changeTracking";
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
 * La unidad visual es la RECOMENDACIÓN, no el evento clínico: cada
 * recommendationId tiene siempre una única tarjeta (matchPatientToGuidelines
 * ya evalúa exactamente una vez por recomendación, contra el estado
 * COMPLETO del paciente — nunca se acumula una entrada nueva por evento).
 * Cuando llegan datos nuevos que cambian su estado, esa misma tarjeta se
 * actualiza en el sitio (mismo `key={recommendationId}`) y se marca
 * "Actualizada" — nunca aparece una segunda tarjeta para la misma
 * recomendación. El detalle fino (dato del paciente, criterio de la guía,
 * fuerza, calidad de evidencia, cita exacta) vive en el modal "¿Por qué?";
 * la tarjeta solo muestra los 5 datos imprescindibles: recomendación,
 * estado, motivo clínico resumido, guía y el botón para abrir el detalle.
 */

const STATUS_BADGE: Record<GuidelineMatchStatus, { label: string; color: string; tint: string }> = {
  applies: { label: "Aplica", color: COLORS.green, tint: COLORS.greenTint },
  possibly_applies: { label: "Posiblemente aplica", color: COLORS.orange, tint: COLORS.orangeTint },
  insufficient_data: { label: "Falta información", color: COLORS.slate, tint: COLORS.paper },
  does_not_apply: { label: "No aplica", color: COLORS.slateLight, tint: COLORS.paper },
};

type BucketKey = "aplicables" | "pendientes" | "no_indicadas";

/** A qué bloque de la vista pertenece cada GuidelineMatchStatus — agrupación de presentación, no una reclasificación clínica nueva. */
const BUCKET_FOR_STATUS: Record<GuidelineMatchStatus, BucketKey> = {
  applies: "aplicables",
  possibly_applies: "pendientes",
  insufficient_data: "pendientes",
  does_not_apply: "no_indicadas",
};

const BUCKETS: { key: BucketKey; label: string; color: string; tint: string; emptyText: string; defaultOpen: boolean }[] = [
  {
    key: "aplicables",
    label: "Aplicables",
    color: COLORS.green,
    tint: COLORS.greenTint,
    emptyText: "Ninguna recomendación evaluada como aplicable con los datos actuales.",
    defaultOpen: true,
  },
  {
    key: "pendientes",
    label: "Pendientes de información",
    color: COLORS.orange,
    tint: COLORS.orangeTint,
    emptyText: "Ninguna recomendación pendiente de información adicional.",
    defaultOpen: true,
  },
  {
    key: "no_indicadas",
    label: "No indicadas / desaconsejadas",
    color: COLORS.slateLight,
    tint: COLORS.paper,
    emptyText: "Ninguna recomendación no indicada o desaconsejada.",
    defaultOpen: false,
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

function buildExplanation(patient: Patient, match: GuidelineMatch): ClinicalExplanation {
  const recommendation = findRecommendationById(match.recommendationId);
  const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === match.guidelineCitation.guidelineId);
  const applicability = recommendation?.applicability ?? "conditional";
  const narrativeBlockNote = "No especificada por la guía para esta actuación: forma parte de un bloque narrativo evaluado en conjunto.";

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
      { label: "Dato del paciente", emphasis: true, text: patientDatumLines(patient, match, applicability).join(" · ") },
      { label: "Criterio clínico de la guía", text: criteriaSummaryText(match, applicability) },
      { label: "Interpretación de PulmoVista", text: interpretationSentence(match, applicability) },
      { label: "Recomendación", text: recommendation?.recommendationText ?? "Texto no disponible." },
      { label: "Fuerza de la recomendación", text: recommendation?.strength ? STRENGTH_LABEL[recommendation.strength] : narrativeBlockNote },
      { label: "Calidad de la evidencia", text: recommendation?.evidenceQuality ? EVIDENCE_QUALITY_LABEL[recommendation.evidenceQuality] : narrativeBlockNote },
    ],
    evidence: match.patientEvidence,
    citation: buildCitation(match, document),
  };
}

/**
 * Evalúa las recomendaciones soportadas contra el paciente y detecta
 * cuáles cambiaron de estado desde la última vez que se calcularon en
 * esta misma sesión del navegador (ver changeTracking.ts). Usa el patrón
 * de React "ajustar el estado durante el renderizado" (sin useEffect,
 * sin leer un ref durante el render) para comparar contra la fotografía
 * de la evaluación anterior: solo sirve mientras este componente
 * permanece montado, así que quien lo use debe mantenerlo montado
 * mientras dure la visita al paciente (ver PatientDetailView, que ya no
 * desmonta esta pestaña al cambiar de pestaña, precisamente para que
 * esto funcione).
 */
function useGuidelineMatches(patient: Patient): { matches: GuidelineMatch[]; changedRecommendationIds: ReadonlySet<string> } {
  const matches = useMemo(() => matchPatientToGuidelines(patient, todayISO()), [patient]);
  const [tracked, setTracked] = useState<{ matches: GuidelineMatch[]; snapshot: GuidelineStatusSnapshot; changed: ReadonlySet<string> } | null>(null);

  if (tracked === null || tracked.matches !== matches) {
    const changed = diffChangedRecommendations(tracked?.snapshot ?? null, matches);
    setTracked({ matches, snapshot: snapshotStatuses(matches), changed });
    return { matches, changedRecommendationIds: changed };
  }
  return { matches, changedRecommendationIds: tracked.changed };
}

function GuidelineBadge({ society, year }: { society: string; year: number }) {
  return (
    <span
      className="pv-mono"
      style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.tealDeep, background: COLORS.tealTint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}
    >
      {guidelineShortLabel(society, year)}
    </span>
  );
}

function StatusBadge({ status }: { status: GuidelineMatchStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: badge.color, background: badge.tint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {badge.label}
    </span>
  );
}

function UpdatedBadge() {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.tealDeep, background: COLORS.tealTint, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
      Actualizada
    </span>
  );
}

/**
 * Tarjeta única por recomendación — solo los 5 datos imprescindibles:
 * guía, estado, recomendación, motivo clínico resumido y "¿Por qué?".
 * El resto (dato del paciente, criterio de la guía, fuerza, calidad de
 * evidencia, cita exacta) vive en el modal, no aquí.
 */
function MatchCard({ match, isUpdated, onWhy }: { match: GuidelineMatch; isUpdated: boolean; onWhy: () => void }) {
  const recommendation = findRecommendationById(match.recommendationId);
  const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === match.guidelineCitation.guidelineId);
  if (!recommendation || !document) return null;

  return (
    <Card accent={STATUS_BADGE[match.status].color}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <GuidelineBadge society={document.source.society} year={document.source.year} />
        <StatusBadge status={match.status} />
        {isUpdated && <UpdatedBadge />}
      </div>

      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, lineHeight: 1.45, color: COLORS.ink }}>{recommendation.recommendationText}</div>

      <div style={{ marginTop: 6, fontSize: 13, fontStyle: "italic", color: COLORS.navy }}>{interpretationSentence(match, recommendation.applicability)}</div>

      <div style={{ marginTop: 12 }}>
        <WhyButton onClick={onWhy} />
      </div>
    </Card>
  );
}

/** Grupo plegable — "No indicadas / desaconsejadas" empieza plegado; el resto, abierto. */
function CollapsibleGroup({
  label,
  color,
  tint,
  count,
  defaultOpen,
  children,
}: {
  label: string;
  color: string;
  tint: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}
      >
        {open ? <ChevronDown size={14} color={COLORS.slateLight} /> : <ChevronRight size={14} color={COLORS.slateLight} />}
        <Eyebrow color={color}>{label}</Eyebrow>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: tint, borderRadius: 20, padding: "1px 8px" }}>{count}</span>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
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
  const { matches, changedRecommendationIds } = useGuidelineMatches(patient);
  const recentChanges = matches.filter((m) => changedRecommendationIds.has(m.recommendationId));

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <Eyebrow>Revisión según guías</Eyebrow>
        <p style={{ fontSize: 13, color: COLORS.slate, margin: "6px 0 0", maxWidth: 700, lineHeight: 1.5 }}>
          Evaluación automática de las recomendaciones soportadas de ERS 2025 y SEPAR 2018 —
          macrólidos, antibióticos inhalados, erradicación de Pseudomonas, corticoides inhalados y fisioterapia/
          aclaramiento de vía aérea — contra los datos estructurados de este paciente. ERS y SEPAR se evalúan siempre
          por separado; nunca se fusionan. Cada recomendación tiene una única tarjeta: cuando llegan datos nuevos,
          esa misma tarjeta se actualiza en vez de duplicarse.
        </p>
      </div>

      {!matches.length && <NoCompatibleGuideline patient={patient} />}

      {BUCKETS.map((bucket) => {
        if (!matches.length) return null;
        const items = matches.filter((m) => BUCKET_FOR_STATUS[m.status] === bucket.key);
        return (
          <CollapsibleGroup key={bucket.key} label={bucket.label} color={bucket.color} tint={bucket.tint} count={items.length} defaultOpen={bucket.defaultOpen}>
            {!items.length && <div style={{ fontSize: 13, color: COLORS.slateLight }}>{bucket.emptyText}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((m) => (
                <MatchCard
                  key={m.recommendationId}
                  match={m}
                  isUpdated={changedRecommendationIds.has(m.recommendationId)}
                  onWhy={() => onWhy(buildExplanation(patient, m))}
                />
              ))}
            </div>
          </CollapsibleGroup>
        );
      })}

      {!!recentChanges.length && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow color={COLORS.tealDeep}>Cambios recientes</Eyebrow>
            <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.tealDeep, background: COLORS.tealTint, borderRadius: 20, padding: "1px 8px" }}>
              {recentChanges.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {recentChanges.map((m) => (
              <MatchCard key={m.recommendationId} match={m} isUpdated onWhy={() => onWhy(buildExplanation(patient, m))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
