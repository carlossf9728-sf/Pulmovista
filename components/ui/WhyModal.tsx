"use client";

import { Eye } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { Modal } from "./Modal";
import { Eyebrow } from "./Eyebrow";
import { KindTag } from "./KindTag";
import type { ClinicalExplanation } from "@/types/evidence";

/**
 * Modal "¿Por qué?": acepta un `ClinicalExplanation` estructurado (nunca
 * texto plano suelto), para que cualquier mensaje clínico futuro —legacy
 * hoy, respaldado por guía mañana— pueda enlazar dato -> interpretación
 * -> recomendación -> fuente sin rediseñar este componente.
 */
export function WhyModal({ data, onClose }: { data: ClinicalExplanation | null; onClose: () => void }) {
  if (!data) return null;
  return (
    <Modal title="¿Por qué?" onClose={onClose} width={540}>
      {data.kindLabel && (
        <div style={{ marginBottom: 14 }}>
          <KindTag kind={data.kindLabel} />
        </div>
      )}
      {data.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          <Eyebrow color={i === 0 ? COLORS.navy : COLORS.slate}>{s.label}</Eyebrow>
          <p style={{ fontSize: 14, margin: "5px 0 0", lineHeight: 1.5, fontWeight: s.emphasis ?? i === 0 ? 600 : 400 }}>{s.text}</p>
        </div>
      ))}
      {data.citation && (
        <div style={{ marginBottom: 14, background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "12px 14px" }}>
          <Eyebrow color={COLORS.tealDeep}>Fuente</Eyebrow>
          <div style={{ fontSize: 12.5, color: COLORS.slate, margin: "5px 0 8px" }}>
            {data.citation.society} · {data.citation.year}
            {data.citation.section ? ` · ${data.citation.section}` : ""}
            {data.citation.page != null ? ` · p. ${data.citation.page}` : ""}
          </div>
          <p className="pv-mono" style={{ fontSize: 12.5, fontStyle: "italic", color: COLORS.ink, margin: 0, lineHeight: 1.55 }}>
            “{data.citation.sourceText}”
          </p>
        </div>
      )}
      {data.evidence.length > 0 && (
        <>
          <Eyebrow color={COLORS.slate}>Evidencias</Eyebrow>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {data.evidence.map((e, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  fontSize: 13.5,
                  padding: "9px 0",
                  borderBottom: i < data.evidence.length - 1 ? `1px dashed ${COLORS.line}` : "none",
                }}
              >
                <span className="pv-mono" style={{ color: COLORS.teal, fontWeight: 700 }}>
                  ›
                </span>
                <span>{e.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div style={{ marginTop: 16, fontSize: 12, color: COLORS.slateLight, display: "flex", alignItems: "center", gap: 6 }}>
        <Eye size={13} /> Esto permite auditar siempre el razonamiento detrás de cada conclusión.
      </div>
    </Modal>
  );
}
