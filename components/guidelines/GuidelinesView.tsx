"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { guidelineShortLabel, EVIDENCE_QUALITY_LABEL, STRENGTH_LABEL } from "@/utils/guidelineLabels";
import { getGuidelineDetail, listActiveGuidelines, listUncoveredDiagnosisCategories } from "@/engines/guidelines/library";
import { Card, Eyebrow, Modal } from "@/components/ui";
import type { GuidelineLibraryDetail, GuidelineLibraryEntry } from "@/engines/guidelines/library";
import type { GuidelineRecommendation } from "@/types/guideline";

/**
 * "Guías" — biblioteca de bases de conocimiento clínicas REALMENTE
 * cargadas en PulmoVista, no una lista simulada. Todo lo que se muestra
 * aquí sale de engines/guidelines/library.ts, capa de presentación pura
 * sobre engines/guidelines/knowledge/ (la misma base que ya usa
 * matchPatientToGuidelines) — ninguna cifra se calcula ni se inventa
 * aquí, y ninguna guía puede aparecer como "Activa" sin estar realmente
 * dentro de SUPPORTED_DIAGNOSIS_CATEGORIES (match.ts), la misma
 * condición que decide si esa guía produce recomendaciones de verdad en
 * "Revisión según guías"/Argos.
 *
 * No muestra IDs técnicos (guidelineId/recommendationId/criterionId/
 * definitionId) en ningún sitio — esta pantalla no tiene un "modo
 * debug"; si se añadiera uno en el futuro, ahí es donde deberían vivir.
 */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.ink }}>{value}</div>
      <div style={{ fontSize: 10.5, color: COLORS.slateLight, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function GuidelineCard({ entry, onOpen }: { entry: GuidelineLibraryEntry; onOpen: () => void }) {
  return (
    <Card accent={COLORS.teal}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, background: COLORS.greenTint, padding: "2px 9px", borderRadius: 20 }}>Activa</span>
        <span className="pv-mono" style={{ fontSize: 11, color: COLORS.slateLight }}>
          {entry.disease} · {entry.year}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.ink, lineHeight: 1.35 }}>{entry.title}</div>
      <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 4 }}>{entry.society}</div>

      <div style={{ display: "flex", gap: 22, marginTop: 16, flexWrap: "wrap" }}>
        <Stat label="Recomendaciones estructuradas" value={entry.recommendationCount} />
        <Stat label="Evaluadas por el motor" value={entry.evaluatedRecommendationCount} />
        <Stat label="Criterios" value={entry.criterionCount} />
        <Stat label="Definiciones" value={entry.definitionCount} />
      </div>

      <button
        onClick={onOpen}
        style={{
          marginTop: 16,
          padding: "8px 16px",
          borderRadius: 9,
          border: `1px solid ${COLORS.line}`,
          background: "white",
          fontWeight: 700,
          fontSize: 12.5,
          color: COLORS.tealDeep,
        }}
      >
        Ver contenido
      </button>
    </Card>
  );
}

function RecommendationRow({ r }: { r: GuidelineRecommendation }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.line}`, padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.tealDeep, background: COLORS.tealTint, padding: "2px 8px", borderRadius: 20 }}>
          {entryApplicabilityLabel(r)}
        </span>
        {r.strength ? (
          <>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.slate, background: COLORS.paper, padding: "2px 8px", borderRadius: 20 }}>
              {STRENGTH_LABEL[r.strength]}
            </span>
            {r.evidenceQuality && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.slate, background: COLORS.paper, padding: "2px 8px", borderRadius: 20 }}>
                Evidencia {EVIDENCE_QUALITY_LABEL[r.evidenceQuality].toLowerCase()}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 10.5, color: COLORS.slateLight, fontStyle: "italic" }}>Parte de un bloque narrativo (sin graduación individual)</span>
        )}
      </div>
      <p style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.55, margin: 0 }}>{r.recommendationText}</p>
      {(r.section || r.page != null) && (
        <div className="pv-mono" style={{ fontSize: 10.5, color: COLORS.slateLight, marginTop: 6 }}>
          {[r.section, r.page != null ? `p. ${r.page}` : null].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function entryApplicabilityLabel(r: GuidelineRecommendation): string {
  return r.applicability === "general" ? "Aplica a toda la población diana" : "Aplica según criterios clínicos";
}

function GuidelineDetailModal({ detail, onClose }: { detail: GuidelineLibraryDetail; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredRecommendations = useMemo(
    () => (q ? detail.recommendations.filter((r) => r.recommendationText.toLowerCase().includes(q) || r.topic.toLowerCase().includes(q)) : detail.recommendations),
    [detail.recommendations, q],
  );

  const groups = useMemo(() => {
    const map = new Map<string, GuidelineRecommendation[]>();
    for (const r of filteredRecommendations) map.set(r.topic, [...(map.get(r.topic) ?? []), r]);
    return [...map.entries()];
  }, [filteredRecommendations]);

  const filteredDefinitions = q ? detail.definitions.filter((d) => d.term.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)) : detail.definitions;

  return (
    <Modal title={guidelineShortLabel(detail.society, detail.year)} onClose={onClose} width={720}>
      <div style={{ fontWeight: 700, fontSize: 15.5, color: COLORS.ink }}>{detail.title}</div>
      <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 4 }}>
        {detail.society} · {detail.year} · Área clínica: {detail.disease}
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
        <Stat label="Recomendaciones estructuradas" value={detail.recommendationCount} />
        <Stat label="Evaluadas por el motor" value={detail.evaluatedRecommendationCount} />
        <Stat label="Criterios disponibles" value={detail.criterionCount} />
        <Stat label="Definiciones/referencias" value={detail.definitionCount} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14, fontSize: 12.5 }}>
        <span style={{ fontWeight: 700, color: COLORS.slateLight, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.03em" }}>Estado de integración</span>
        <span style={{ color: COLORS.ink }}>
          Activa — utilizada por Revisión según guías y Argos para el área clínica &ldquo;{detail.disease}&rdquo;.
        </span>
      </div>

      {detail.sourceUrl && (
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 12.5, color: COLORS.tealDeep, fontWeight: 600 }}
        >
          <ExternalLink size={13} /> Fuente bibliográfica
        </a>
      )}

      <div style={{ position: "relative", marginTop: 20 }}>
        <Search size={14} color={COLORS.slateLight} style={{ position: "absolute", left: 11, top: 10 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por texto o tema dentro de esta guía..."
          style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13 }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <Eyebrow>Recomendaciones por tema</Eyebrow>
        {!groups.length && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 8 }}>Ningún resultado para esta búsqueda.</div>}
        <div style={{ marginTop: 8 }}>
          {groups.map(([topic, recs]) => (
            <div key={topic} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink, textTransform: "capitalize" }}>
                {topic} <span style={{ color: COLORS.slateLight, fontWeight: 600 }}>({recs.length})</span>
              </div>
              {recs.map((r, i) => (
                <RecommendationRow key={i} r={r} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {!!filteredDefinitions.length && (
        <div style={{ marginTop: 20 }}>
          <Eyebrow color={COLORS.slate}>Definiciones y referencias</Eyebrow>
          <div style={{ marginTop: 8 }}>
            {filteredDefinitions.map((d, i) => (
              <div key={i} style={{ borderTop: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.ink }}>{d.term}</div>
                <p style={{ fontSize: 12.5, color: COLORS.slate, margin: "4px 0 0", lineHeight: 1.5 }}>{d.description}</p>
                {(d.section || d.page != null) && (
                  <div className="pv-mono" style={{ fontSize: 10.5, color: COLORS.slateLight, marginTop: 5 }}>
                    {[d.section, d.page != null ? `p. ${d.page}` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function GuidelinesView() {
  const activeGuidelines = listActiveGuidelines();
  const uncovered = listUncoveredDiagnosisCategories();
  const [openGuidelineId, setOpenGuidelineId] = useState<string | null>(null);
  const detail = openGuidelineId ? getGuidelineDetail(openGuidelineId) : null;

  return (
    <div className="pv-fade-in">
      <Eyebrow>Base de conocimiento clínico</Eyebrow>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 8px" }}>Guías</h1>
      <p style={{ color: COLORS.slate, fontSize: 13.5, marginBottom: 24, maxWidth: 640, lineHeight: 1.5 }}>
        Guías estructuradas utilizadas por PulmoVista para revisar los datos clínicos del paciente y ofrecer trazabilidad de
        las recomendaciones.
      </p>

      <Eyebrow color={COLORS.green}>Activas</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10, marginBottom: 28 }}>
        {activeGuidelines.map((g) => (
          <GuidelineCard key={g.guidelineId} entry={g} onOpen={() => setOpenGuidelineId(g.guidelineId)} />
        ))}
      </div>

      {!!uncovered.length && (
        <>
          <Eyebrow color={COLORS.slateLight}>Todavía no disponibles</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {uncovered.map((category) => (
              <div
                key={category}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: COLORS.slateLight, padding: "9px 14px", background: COLORS.paper, borderRadius: 9 }}
              >
                <span>{category}</span>
                <span style={{ fontStyle: "italic" }}>No disponible todavía</span>
              </div>
            ))}
          </div>
        </>
      )}

      {detail && <GuidelineDetailModal detail={detail} onClose={() => setOpenGuidelineId(null)} />}
    </div>
  );
}
