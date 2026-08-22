"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { COLORS } from "@/utils/theme";
import { formatDate, todayISO } from "@/utils/date";
import { selectHospitalizationCount, selectMicrobiology, selectPFT, selectTreatments, exacerbationsByYear } from "@/domain/selectors";
import { computeChangesSinceLastVisit } from "@/engines/longitudinal";
import { Card, Eyebrow, Val } from "@/components/ui";
import type { Patient } from "@/types/patient";
import type { ChangeKind } from "@/types/longitudinal";

const KIND_STYLE: Record<ChangeKind, { c: string; icon: ReactNode }> = {
  nuevo: { c: COLORS.teal, icon: <Plus size={13} /> },
  aumentado: { c: COLORS.red, icon: <ArrowUpRight size={13} /> },
  disminuido: { c: COLORS.green, icon: <ArrowDownRight size={13} /> },
  desaparecido: { c: COLORS.slate, icon: <Minus size={13} /> },
};

export function SummaryTab({ patient }: { patient: Patient }) {
  const pft = selectPFT(patient.events).slice(-1)[0];
  const years = exacerbationsByYear(patient);
  const lastYearCount = years.length ? years[years.length - 1].count : null;
  const hospTotal = selectHospitalizationCount(patient.events, null) || selectHospitalizationCount(patient.events, todayISO());
  const lastMicro = selectMicrobiology(patient.events).slice(-1)[0];
  const activeTreatments = selectTreatments(patient.events).filter((t) => t.status === "Activo");
  const changes = computeChangesSinceLastVisit(patient);

  const fields: [string, string | null][] = [
    ["Diagnóstico principal", patient.primaryDiagnosis],
    ["FEV1 más reciente", pft ? `${pft.FEV1Percent ?? "—"}%${pft.FEV1Liters ? ` (${pft.FEV1Liters} L)` : ""}` : null],
    ["FVC", pft && pft.FVCPercent != null ? `${pft.FVCPercent}%${pft.FVCLiters ? ` (${pft.FVCLiters} L)` : ""}` : null],
    ["DLCO", pft && pft.DLCOPercent != null ? `${pft.DLCOPercent}%` : null],
    ["Exacerbaciones último año", lastYearCount != null ? `${lastYearCount}/año` : null],
    ["Hospitalizaciones (acumuladas)", hospTotal != null ? `${hospTotal}` : null],
    ["Microbiología relevante", lastMicro ? `${lastMicro.organism} (${formatDate(lastMicro.date)})` : null],
    ["Tratamiento actual", activeTreatments.length ? activeTreatments.map((t) => t.name).join(", ") : null],
  ];

  return (
    <div className="pv-fade-in" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <Eyebrow>Situación actual</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginTop: 12 }}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                <Val value={value} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card accent={COLORS.teal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Eyebrow>Qué ha cambiado desde la última consulta</Eyebrow>
          {changes && (
            <span style={{ fontSize: 11.5, color: COLORS.slateLight }}>
              {formatDate(changes.fromDate)} → {formatDate(changes.toDate)}
            </span>
          )}
        </div>
        {!changes && <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 10 }}>Aún no hay suficientes consultas para comparar.</div>}
        {changes && !changes.changes.length && (
          <div style={{ fontSize: 13, color: COLORS.slateLight, marginTop: 10 }}>Sin cambios relevantes detectados entre ambas consultas.</div>
        )}
        {changes && !!changes.changes.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {changes.changes.map((c, i) => {
              const ks = KIND_STYLE[c.kind];
              return (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, padding: "8px 0", borderBottom: i < changes.changes.length - 1 ? `1px solid ${COLORS.line}` : "none" }}
                >
                  <span style={{ fontWeight: 700, minWidth: 190 }}>{c.label}</span>
                  <span className="pv-mono" style={{ color: COLORS.slate }}>
                    {c.from}
                  </span>
                  <ArrowRight size={12} color={COLORS.slateLight} />
                  <span className="pv-mono" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 3, color: ks.c }}>
                    {ks.icon} {c.to}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: ks.c, background: `${ks.c}14`, padding: "2px 8px", borderRadius: 20, textTransform: "capitalize" }}>
                    {c.kind}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {changes && !!changes.unchanged.length && (
          <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginTop: 12 }}>Sin cambios en: {changes.unchanged.join(", ")}.</div>
        )}
      </Card>
    </div>
  );
}
