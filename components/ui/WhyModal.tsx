"use client";

import { Eye } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { Modal } from "./Modal";
import { Eyebrow } from "./Eyebrow";
import { KindTag } from "./KindTag";
import type { ClinicalExplanation } from "@/types/evidence";

function ExplanationBlock({ data }: { data: ClinicalExplanation }) {
  return (
    <>
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
    </>
  );
}

/**
 * Modal "¿Por qué?": acepta uno o varios `ClinicalExplanation`
 * estructurados (nunca texto plano suelto), para que cualquier mensaje
 * clínico futuro —legacy hoy, respaldado por guía mañana— pueda enlazar
 * dato -> interpretación -> recomendación -> fuente sin rediseñar este
 * componente.
 *
 * Un array llega cuando "Qué revisar hoy" (Resumen) agrupa por
 * PRESENTACIÓN varias guías que coinciden en la misma acción clínica
 * (ver SummaryTab.tsx#computeTodayPriorities y
 * engines/guidelines/match.ts#actionGroupKeyFor): un único botón "¿Por
 * qué?", pero cada guía conserva aquí su propio bloque completo
 * (criterio, texto original, fuerza, calidad, fuente) — la
 * deduplicación nunca fusiona ni descarta trazabilidad, solo evita
 * repetir la fila en la lista.
 */
export function WhyModal({ data, onClose }: { data: ClinicalExplanation | ClinicalExplanation[] | null; onClose: () => void }) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : [data];
  if (!items.length) return null;
  return (
    <Modal title="¿Por qué?" onClose={onClose} width={540}>
      {items.map((item, i) => (
        <div key={i} style={i < items.length - 1 ? { marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${COLORS.line}` } : undefined}>
          {items.length > 1 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.slateLight, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
              {item.citation ? `${item.citation.society} ${item.citation.year}` : `Fuente ${i + 1}`}
            </div>
          )}
          <ExplanationBlock data={item} />
        </div>
      ))}
      {/*
        Sin bloque "Evidencias": la lista cruda de eventos (data.evidence)
        se conserva en el objeto para trazabilidad interna — y para un
        futuro "Ver datos utilizados" si hace falta — pero no se muestra
        aquí, porque ya está resumida en la sección "Dato del paciente" de
        arriba (o cubierta por el bloque "Fuente" cuando no hay evidencia
        adicional que resumir).
      */}
      <div style={{ marginTop: 16, fontSize: 12, color: COLORS.slateLight, display: "flex", alignItems: "center", gap: 6 }}>
        <Eye size={13} /> Esto permite auditar siempre el razonamiento detrás de cada conclusión.
      </div>
    </Modal>
  );
}
