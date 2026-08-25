"use client";

import { useState } from "react";
import { ChevronDown, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { GROUP_COLOR, GROUP_ICON } from "@/utils/eventGroupStyle";
import { displayForEvent } from "@/domain/timeline";
import { DataConfidenceBadge } from "@/components/ui";
import { CandidateFields } from "./CandidateFields";
import type { ClinicalEvent } from "@/types/clinicalEvent";

/** Un elemento candidato detectado por el motor de extracción (o la propia consulta pegada), pendiente de confirmar. */
export interface ReviewCandidate {
  event: ClinicalEvent;
  /** false = "Descartado": no se guarda. El médico puede volver a incluirlo sin perder la edición ya hecha. */
  included: boolean;
}

function CandidateCard({ candidate, onToggle, onEdit }: { candidate: ReviewCandidate; onToggle: () => void; onEdit: (updated: ClinicalEvent) => void }) {
  const [editing, setEditing] = useState(false);
  const { event, included } = candidate;
  const display = displayForEvent(event);
  const color = GROUP_COLOR[display.group];
  const Icon = GROUP_ICON[display.group];

  return (
    <div
      data-testid={`candidate-${event.id}`}
      style={{
        background: included ? COLORS.white : COLORS.paper,
        border: `1px solid ${COLORS.line}`,
        borderLeft: `3px solid ${included ? color : COLORS.line}`,
        borderRadius: 10,
        padding: "12px 14px",
        opacity: included ? 1 : 0.65,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", minWidth: 0 }}>
          <Icon size={15} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.03em" }}>{display.group}</span>
              {event.confidence !== "confirmado" && <DataConfidenceBadge reason={event.confidenceReason} />}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.ink, marginTop: 3 }}>{display.title}</div>
            {!editing && (
              <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 3, lineHeight: 1.45 }}>{display.detail}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setEditing((v) => !v)}
            title="Corregir"
            aria-label="Corregir"
            style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 7, padding: 6, display: "flex", cursor: "pointer" }}
          >
            <Pencil size={13} color={COLORS.slate} />
          </button>
          <button
            onClick={onToggle}
            title={included ? "Descartar" : "Volver a incluir"}
            aria-label={included ? "Descartar" : "Volver a incluir"}
            style={{
              background: included ? "none" : COLORS.tealTint,
              border: `1px solid ${included ? COLORS.line : COLORS.teal}`,
              borderRadius: 7,
              padding: 6,
              display: "flex",
              cursor: "pointer",
            }}
          >
            {included ? <Trash2 size={13} color={COLORS.red} /> : <RotateCcw size={13} color={COLORS.tealDeep} />}
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${COLORS.line}` }}>
          <CandidateFields event={event} onChange={onEdit} />
        </div>
      )}
    </div>
  );
}

/** Contadas por separado para el resumen "N de M elementos se guardarán". */
export function countIncluded(candidates: ReviewCandidate[]): number {
  return candidates.filter((c) => c.included).length;
}

export function ClinicalCandidateReview({ candidates, onChange }: { candidates: ReviewCandidate[]; onChange: (next: ReviewCandidate[]) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  const updateAt = (i: number, patch: Partial<ReviewCandidate>) => {
    onChange(candidates.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const includedIdx: number[] = [];
  const discardedIdx: number[] = [];
  candidates.forEach((c, i) => (c.included ? includedIdx : discardedIdx).push(i));
  const discardedCount = discardedIdx.length;

  return (
    <div>
      <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 12, lineHeight: 1.5 }}>
        PulmoVista ha detectado {candidates.length} {candidates.length === 1 ? "elemento" : "elementos"} en el texto. Revíselos, corrija lo que
        haga falta y descarte lo que no proceda antes de guardar — nada se añade a la historia todavía.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {includedIdx.map((i) => (
          <CandidateCard
            key={candidates[i].event.id}
            candidate={candidates[i]}
            onToggle={() => updateAt(i, { included: !candidates[i].included })}
            onEdit={(updated) => updateAt(i, { event: updated })}
          />
        ))}
      </div>

      {!!discardedCount && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: COLORS.slateLight }}
          >
            <ChevronDown size={13} style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }} />
            Descartados ({discardedCount})
          </button>
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {discardedIdx.map((i) => (
                <CandidateCard
                  key={candidates[i].event.id}
                  candidate={candidates[i]}
                  onToggle={() => updateAt(i, { included: !candidates[i].included })}
                  onEdit={(updated) => updateAt(i, { event: updated })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
