"use client";

import type { CSSProperties } from "react";
import { COLORS } from "@/utils/theme";
import type { ClinicalEvent } from "@/types/clinicalEvent";

/**
 * Edición mínima por tipo de evento — solo los campos que de verdad se
 * usan aguas abajo (Sentinel, GuidelineMatch, timeline…), no un
 * formulario completo por categoría. Los "formularios manuales
 * específicos" siguen siendo una opción aparte; esto es la corrección
 * puntual de un dato mal extraído antes de guardar, no una segunda vía
 * de captura.
 */

const fieldLabel: CSSProperties = { fontSize: 11, fontWeight: 700, color: COLORS.slateLight, marginBottom: 4, display: "block" };
const fieldInput: CSSProperties = { width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 13, fontFamily: "inherit" };

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={fieldInput} />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...fieldInput, resize: "vertical", lineHeight: 1.45 }} />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div>
      <span style={fieldLabel}>{label}</span>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={fieldInput}
      />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: COLORS.ink, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function splitList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CandidateFields({ event, onChange }: { event: ClinicalEvent; onChange: (updated: ClinicalEvent) => void }) {
  switch (event.type) {
    case "consultation":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextAreaField label="Texto de la consulta" value={event.rawText ?? ""} onChange={(v) => onChange({ ...event, rawText: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <NumberField label="SatO₂ (%)" value={event.oxygenSaturationPercent} onChange={(v) => onChange({ ...event, oxygenSaturationPercent: v })} />
            <NumberField label="FR (rpm)" value={event.respiratoryRate} onChange={(v) => onChange({ ...event, respiratoryRate: v })} />
            <NumberField label="FC (lpm)" value={event.heartRate} onChange={(v) => onChange({ ...event, heartRate: v })} />
            <NumberField label="Temperatura (°C)" value={event.temperatureCelsius} onChange={(v) => onChange({ ...event, temperatureCelsius: v })} />
            <TextField label="TA" value={event.bloodPressure ?? ""} onChange={(v) => onChange({ ...event, bloodPressure: v || null })} />
            <TextField label="Oxigenoterapia" value={event.oxygenTherapy ?? ""} onChange={(v) => onChange({ ...event, oxygenTherapy: v || null })} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <CheckboxField label="Afebril" checked={!!event.afebrile} onChange={(v) => onChange({ ...event, afebrile: v || null })} />
            <CheckboxField label="Hemodinámicamente estable" checked={!!event.hemodynamicallyStable} onChange={(v) => onChange({ ...event, hemodynamicallyStable: v || null })} />
          </div>
        </div>
      );

    case "pulmonary_function":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <NumberField label="FEV1 %" value={event.FEV1Percent} onChange={(v) => onChange({ ...event, FEV1Percent: v })} />
          <NumberField label="FEV1 z-score" value={event.FEV1zScore} onChange={(v) => onChange({ ...event, FEV1zScore: v })} />
          <NumberField label="FVC %" value={event.FVCPercent} onChange={(v) => onChange({ ...event, FVCPercent: v })} />
          <NumberField label="FVC z-score" value={event.FVCzScore} onChange={(v) => onChange({ ...event, FVCzScore: v })} />
          <NumberField label="FEV1/FVC %" value={event.FEV1FVCRatio} onChange={(v) => onChange({ ...event, FEV1FVCRatio: v })} />
          <NumberField label="FEV1/FVC z-score" value={event.FEV1FVCzScore} onChange={(v) => onChange({ ...event, FEV1FVCzScore: v })} />
          <NumberField label="DLCO %" value={event.DLCOPercent} onChange={(v) => onChange({ ...event, DLCOPercent: v })} />
        </div>
      );

    case "microbiology":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextField label="Microorganismo" value={event.organism} onChange={(v) => onChange({ ...event, organism: v })} />
          <TextField label="Sensible a (separado por comas)" value={event.sensitivity.join(", ")} onChange={(v) => onChange({ ...event, sensitivity: splitList(v) })} />
          <TextField label="Resistente a (separado por comas)" value={event.resistance.join(", ")} onChange={(v) => onChange({ ...event, resistance: splitList(v) })} />
        </div>
      );

    case "exacerbation":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextField label="Gravedad" value={event.severity} onChange={(v) => onChange({ ...event, severity: v })} />
          <CheckboxField label="Con ingreso hospitalario" checked={event.hospitalization} onChange={(v) => onChange({ ...event, hospitalization: v })} />
        </div>
      );

    case "hospitalization":
      return (
        <TextField
          label="Procedimiento (si aplica)"
          value={event.procedureLabel ?? ""}
          onChange={(v) => onChange({ ...event, procedureLabel: v || null })}
        />
      );

    case "treatment_started":
    case "respiratory_support":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextField label="Fármaco / tratamiento" value={event.drug} onChange={(v) => onChange({ ...event, drug: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <TextField label="Dosis" value={event.dose ?? ""} onChange={(v) => onChange({ ...event, dose: v || null })} />
            <TextField label="Frecuencia" value={event.frequency ?? ""} onChange={(v) => onChange({ ...event, frequency: v || null })} />
            <TextField label="Duración" value={event.duration ?? ""} onChange={(v) => onChange({ ...event, duration: v || null })} />
            <TextField label="Pauta (días de la semana)" value={event.schedule ?? ""} onChange={(v) => onChange({ ...event, schedule: v || null })} />
          </div>
          <TextField label="Cambio (si no es un inicio nuevo)" value={event.changeNote ?? ""} onChange={(v) => onChange({ ...event, changeNote: v || null })} />
        </div>
      );

    case "treatment_stopped":
      return <TextField label="Fármaco / soporte retirado" value={event.drug} onChange={(v) => onChange({ ...event, drug: v })} />;

    case "lab_results":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextField label="Etiqueta" value={event.label} onChange={(v) => onChange({ ...event, label: v })} />
          <TextAreaField label="Texto del informe" value={event.text} onChange={(v) => onChange({ ...event, text: v })} />
          {!!event.parameters?.length && (
            <div style={{ fontSize: 11.5, color: COLORS.slate }}>
              {event.parameters.length} parámetro{event.parameters.length === 1 ? "" : "s"} estructurado{event.parameters.length === 1 ? "" : "s"} automáticamente.
            </div>
          )}
          {!!event.unparsedLines?.length && (
            <div>
              <span style={fieldLabel}>Líneas sin interpretar — revisar antes de guardar</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {event.unparsedLines.map((l, i) => (
                  <div key={i} className="pv-mono" style={{ fontSize: 12, color: COLORS.slate, background: COLORS.paper, borderRadius: 6, padding: "5px 8px" }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case "imaging":
    case "exercise_test":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextField label="Etiqueta" value={event.label} onChange={(v) => onChange({ ...event, label: v })} />
          <TextAreaField label="Texto del informe" value={event.text} onChange={(v) => onChange({ ...event, text: v })} />
        </div>
      );

    case "diagnosis":
      return null;
  }
}
