"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectLabResults } from "@/domain/selectors";
import { groupLabParameters, latestPoint, selectUnstructuredLabResults } from "@/domain/labParameters";
import { Card, CollapsibleGroup, Val } from "@/components/ui";
import type { LabParameterPoint, LabParameterSeries } from "@/domain/labParameters";
import type { LabParameterStatus, LabReferenceRange } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

/**
 * Pestaña "Analíticas" — dos niveles (analítica general / estudio
 * etiológico de bronquiectasias), agrupados por `LabParameter.category`.
 * Vista compacta: nombre + valor + fecha más reciente, con un badge de
 * estado SOLO cuando `status` viene explícito en el dato (nunca
 * inferido). Detalle expandible: histórico completo del parámetro,
 * fecha a fecha, sin clasificar el sentido del cambio — ver
 * domain/labParameters.ts. Las analíticas sin desglose estructurado
 * (formato antiguo, o texto que no permite aislar parámetros) se siguen
 * mostrando íntegras al final, nunca ocultas.
 */

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

function ParameterSection({ title, color, tint, series, emptyText }: { title: string; color: string; tint: string; series: LabParameterSeries[]; emptyText: string }) {
  return (
    <CollapsibleGroup label={title} color={color} tint={tint} count={series.length} defaultOpen>
      {!series.length && <div style={{ fontSize: 13, color: COLORS.slateLight }}>{emptyText}</div>}
      {!!series.length && (
        <Card style={{ padding: "0 16px" }}>
          {series.map((s) => (
            <ParameterRow key={`${s.category}-${s.name}`} series={s} />
          ))}
        </Card>
      )}
    </CollapsibleGroup>
  );
}

export function AnalyticsTab({ patient }: { patient: Patient }) {
  const labResults = selectLabResults(patient.events);
  if (!labResults.length) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: sin analíticas registradas.</div>;
  }

  const general = groupLabParameters(labResults, "general");
  const etiologico = groupLabParameters(labResults, "etiologico");
  const unstructured = selectUnstructuredLabResults(labResults);

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ParameterSection
        title="Analítica general"
        color={COLORS.violet}
        tint={COLORS.violetTint}
        series={general}
        emptyText="No se han registrado parámetros de analítica general desglosados."
      />
      <ParameterSection
        title="Estudio etiológico / cribado de bronquiectasias"
        color={COLORS.tealDeep}
        tint={COLORS.tealTint}
        series={etiologico}
        emptyText="No se han registrado parámetros del estudio etiológico desglosados."
      />

      {!!unstructured.length && (
        <div>
          <CollapsibleGroup label="Otras analíticas sin desglose" color={COLORS.slate} tint={COLORS.paper} count={unstructured.length} defaultOpen={!general.length && !etiologico.length}>
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
