"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectLabResults } from "@/domain/selectors";
import { groupLabParametersByPanel, latestPoint, selectUnstructuredLabResults } from "@/domain/labParameters";
import { Card, CollapsibleGroup, Val } from "@/components/ui";
import type { LabParameterPoint, LabParameterSeries } from "@/domain/labParameters";
import type { LabPanelCategory, LabParameterStatus, LabReferenceRange } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

/**
 * Pestaña "Analíticas" — una única vista organizada por BLOQUE DE
 * LABORATORIO (Hemograma, Bioquímica, Función renal...), no por "general
 * vs etiológico": ver LabPanelCategory en types/clinicalEvent.ts y la
 * normalización que la asigna en engines/extraction/labParameters.ts.
 * La categoría es puramente organizativa — no interviene en ningún
 * cálculo clínico, y es intencionadamente independiente de
 * MissingInfoEngine (ver engines/missingInfo/legacyRules.ts): esa
 * lógica decide qué bloques de LabPanelCategory cuentan como cribado
 * etiológico para sus propios fines, sin que esta pestaña tenga que
 * saber nada de eso ni viceversa.
 *
 * Vista compacta en dos niveles: cada bloque es un CollapsibleGroup con
 * sus filas de parámetros (nombre + valor + fecha más reciente, badge de
 * estado SOLO cuando `status` viene explícito); el histórico completo de
 * un parámetro solo se ve al expandir SU fila, no el bloque entero. Para
 * no alargar la pantalla, un bloque arranca plegado salvo que alguno de
 * sus parámetros esté marcado "alterado" en su valor más reciente — así
 * lo relevante se ve de un vistazo sin tener que abrir bloque a bloque.
 * Las analíticas sin desglose estructurado se siguen mostrando íntegras
 * al final, nunca ocultas.
 */

const PANELS: { key: LabPanelCategory; label: string }[] = [
  { key: "hemograma", label: "Hemograma" },
  { key: "bioquimica", label: "Bioquímica" },
  { key: "funcion_renal", label: "Función renal" },
  { key: "perfil_hepatico", label: "Perfil hepático" },
  { key: "inflamacion", label: "Inflamación" },
  { key: "coagulacion", label: "Coagulación" },
  { key: "inmunologia", label: "Inmunología / inmunoglobulinas" },
  { key: "aspergillus_abpa", label: "Aspergillus / ABPA" },
  { key: "alfa1_antitripsina", label: "Alfa-1-antitripsina" },
  { key: "autoinmunidad", label: "Autoinmunidad" },
  { key: "otros", label: "Otros" },
];

const STATUS_TONE: Record<"normal" | "alterado", { color: string; tint: string }> = {
  normal: { color: COLORS.green, tint: COLORS.greenTint },
  alterado: { color: COLORS.red, tint: COLORS.redTint },
};

function StatusBadge({ status }: { status: LabParameterStatus }) {
  if (!status) return null;
  const tone = STATUS_TONE[status];
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: tone.color,
        background: tone.tint,
        padding: "2px 8px",
        borderRadius: 20,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

/** "ref. 700-1600 mg/dL" / "ref. >57 mg/dL" / "ref. <5 mg/dL" — null si el informe no trae ningún extremo del rango. */
function formatReferenceRange(range: LabReferenceRange | null, unit: string | null): string | null {
  if (!range || (range.low == null && range.high == null)) return null;
  const u = unit ? ` ${unit}` : "";
  if (range.low != null && range.high != null) return `ref. ${range.low}–${range.high}${u}`;
  if (range.low != null) return `ref. >${range.low}${u}`;
  return `ref. <${range.high}${u}`;
}

function HistoryPoint({ point }: { point: LabParameterPoint }) {
  const ref = formatReferenceRange(point.referenceRange, point.unit);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, flexWrap: "wrap" }}>
      <span style={{ color: COLORS.slateLight, minWidth: 76 }}>{formatDate(point.date)}</span>
      <span className="pv-mono" style={{ fontWeight: 600, color: COLORS.ink }}>
        {point.valueText}
      </span>
      <StatusBadge status={point.status} />
      {ref && <span style={{ color: COLORS.slateLight, fontSize: 11.5 }}>({ref})</span>}
    </div>
  );
}

function ParameterRow({ series }: { series: LabParameterSeries }) {
  const [expanded, setExpanded] = useState(false);
  const latest = latestPoint(series);
  if (!latest) return null;
  const history = [...series.points].reverse();
  const hasHistory = series.points.length > 1;

  return (
    <div data-testid={`lab-param-${series.category}-${series.name}`} style={{ borderBottom: `1px solid ${COLORS.line}`, padding: "10px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>{series.name}</span>
          <span className="pv-mono" style={{ fontSize: 13 }}>
            <Val value={latest.valueText} />
          </span>
          <StatusBadge status={latest.status} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 11.5, color: COLORS.slateLight }}>{formatDate(latest.date)}</span>
          {hasHistory && (
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={{ display: "flex", alignItems: "center", gap: 3, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, color: COLORS.tealDeep }}
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Histórico ({series.points.length})
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, paddingLeft: 4 }}>
          {history.map((p, i) => (
            <HistoryPoint key={p.eventId + i} point={p} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Un bloque arranca abierto solo si algún parámetro está "alterado" en su punto más reciente — señal ya calculada aguas arriba, no una inferencia nueva; solo decide el estado inicial de plegado. */
function hasRecentAltered(series: LabParameterSeries[]): boolean {
  return series.some((s) => latestPoint(s)?.status === "alterado");
}

function PanelSection({ label, series }: { label: string; series: LabParameterSeries[] }) {
  return (
    <CollapsibleGroup label={label} color={COLORS.tealDeep} tint={COLORS.tealTint} count={series.length} defaultOpen={hasRecentAltered(series)}>
      <Card style={{ padding: "0 16px" }}>
        {series.map((s) => (
          <ParameterRow key={`${s.category}-${s.name}`} series={s} />
        ))}
      </Card>
    </CollapsibleGroup>
  );
}

export function AnalyticsTab({ patient }: { patient: Patient }) {
  const labResults = selectLabResults(patient.events);
  if (!labResults.length) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin analíticas registradas.</div>;
  }

  const byPanel = groupLabParametersByPanel(labResults);
  const unstructured = selectUnstructuredLabResults(labResults);
  const hasAnyStructured = PANELS.some((p) => byPanel[p.key]?.length);

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!hasAnyStructured && !unstructured.length && (
        <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin analíticas registradas.</div>
      )}

      {PANELS.map(({ key, label }) => {
        const series = byPanel[key];
        return series?.length ? <PanelSection key={key} label={label} series={series} /> : null;
      })}

      {!!unstructured.length && (
        <div>
          <CollapsibleGroup label="Otras analíticas sin desglose" color={COLORS.slate} tint={COLORS.paper} count={unstructured.length} defaultOpen={!hasAnyStructured}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...unstructured].reverse().map((e) => (
                <Card key={e.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>{e.label}</span>
                    <span style={{ fontSize: 11.5, color: COLORS.slateLight, whiteSpace: "nowrap" }}>{formatDate(e.date)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.slate, lineHeight: 1.5 }}>{e.text}</div>
                </Card>
              ))}
            </div>
          </CollapsibleGroup>
        </div>
      )}
    </div>
  );
}
