"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronRight, Copy, Plus } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { formatAge } from "@/utils/text";
import { selectConsultations } from "@/domain/selectors";
import { buildPatientSummaryText } from "@/domain/patientSummary";
import { computeSentinelFindings, patientStatus } from "@/engines/sentinel";
import { computeTurningPoints } from "@/engines/turningPoints";
import { detectContradictions } from "@/engines/longitudinal";
import { usePatients } from "@/app/providers";
import { StatusPill, WhyModal } from "@/components/ui";
import { AddClinicalInfoModal } from "@/components/patients/AddClinicalInfoModal";
import { SummaryTab } from "./SummaryTab";
import { TimelineTab } from "./TimelineTab";
import { PFTTab } from "./PFTTab";
import { MicrobiologyTab } from "./MicrobiologyTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { TreatmentsTab } from "./TreatmentsTab";
import { ImagingTab } from "./ImagingTab";
import { ConsultsTab } from "./ConsultsTab";
import { AlertsTab } from "./AlertsTab";
import { GuidelinesReviewTab } from "./GuidelinesReviewTab";
import type { Patient } from "@/types/patient";
import type { ClinicalExplanation } from "@/types/evidence";

type TabKey = "resumen" | "timeline" | "funcion" | "micro" | "analiticas" | "tratamientos" | "radiologia" | "consultas" | "alertas" | "guias";

const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "timeline", label: "Cronología" },
  { key: "funcion", label: "Función pulmonar" },
  { key: "micro", label: "Microbiología" },
  { key: "analiticas", label: "Analíticas" },
  { key: "tratamientos", label: "Tratamientos" },
  { key: "radiologia", label: "Radiología" },
  { key: "consultas", label: "Consultas" },
  { key: "alertas", label: "Argos" },
  { key: "guias", label: "Revisión según guías" },
];

function isTabKey(v: string | null): v is TabKey {
  return !!v && TABS.some((t) => t.key === v);
}

export function PatientDetailView({ patient }: { patient: Patient }) {
  const { addClinicalEvents } = usePatients();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "resumen");
  const [why, setWhy] = useState<ClinicalExplanation | ClinicalExplanation[] | null>(null);
  const [showAddClinicalInfo, setShowAddClinicalInfo] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildPatientSummaryText(patient));
      setCopyState("copied");
    } catch {
      // Sin permiso de portapapeles (o contexto no seguro): se avisa en vez de fallar en silencio.
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  }

  const status = patientStatus(patient);
  const alertCount = computeSentinelFindings(patient).length + computeTurningPoints(patient).length + detectContradictions(patient).length;
  const lastConsult = selectConsultations(patient.events).slice(-1)[0];

  return (
    <div className="pv-fade-in">
      <Link href="/pacientes" style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, marginBottom: 14, padding: 0, width: "fit-content" }}>
        <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} /> Volver a pacientes
      </Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="pv-mono" style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy }}>
            {patient.code}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12.5, color: COLORS.slate }}>
            <span>
              <strong style={{ color: COLORS.ink }}>{patient.primaryDiagnosis}</strong>
            </span>
            <span>{formatAge(patient.age)}</span>
            <span>{patient.sex}</span>
            <span>Primera valoración: {formatDate(patient.createdAt)}</span>
            <span>Última actualización: {formatDate(lastConsult?.date)}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <StatusPill status={status} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={copySummary}
              aria-live="polite"
              style={{ display: "flex", alignItems: "center", gap: 6, background: "white", color: copyState === "error" ? COLORS.red : COLORS.navy, border: `1px solid ${COLORS.line}`, borderRadius: 9, padding: "8px 14px", fontWeight: 600, fontSize: 12.5 }}
            >
              {copyState === "copied" ? <Check size={14} /> : <Copy size={14} />}
              {copyState === "copied" ? "Resumen copiado" : copyState === "error" ? "No se pudo copiar" : "Copiar resumen"}
            </button>
            <button
              onClick={() => setShowAddClinicalInfo(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "white", border: "none", borderRadius: 9, padding: "8px 14px", fontWeight: 700, fontSize: 12.5 }}
            >
              <Plus size={14} /> Añadir información clínica
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.line}`, marginBottom: 20, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              color: tab === t.key ? COLORS.tealDeep : COLORS.slate,
              borderBottom: tab === t.key ? `2px solid ${COLORS.teal}` : "2px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {t.key === "alertas" && !!alertCount && (
              <span style={{ background: COLORS.red, color: "white", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "1px 6px" }}>{alertCount}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "resumen" && <SummaryTab patient={patient} onWhy={setWhy} />}
      {tab === "timeline" && <TimelineTab patient={patient} />}
      {tab === "funcion" && <PFTTab patient={patient} />}
      {tab === "micro" && <MicrobiologyTab patient={patient} />}
      {tab === "analiticas" && <AnalyticsTab patient={patient} />}
      {tab === "tratamientos" && <TreatmentsTab patient={patient} />}
      {tab === "radiologia" && <ImagingTab patient={patient} />}
      {tab === "consultas" && <ConsultsTab patient={patient} onAddClinicalInfo={() => setShowAddClinicalInfo(true)} />}
      {tab === "alertas" && <AlertsTab patient={patient} onWhy={setWhy} />}
      {/*
        A diferencia de las demás pestañas, esta se mantiene siempre montada
        (solo oculta con CSS) en vez de montar/desmontar con la pestaña
        activa: así su detección de "cambios recientes" (ver
        useGuidelineMatches en GuidelinesReviewTab, memoria de sesión vía
        estado ajustado durante el renderizado) sobrevive a cambiar de
        pestaña — p. ej. añadir información clínica nueva desde
        "Consultas" y volver — en vez de reiniciarse cada vez que se
        vuelve a "Revisión según guías".
      */}
      <div style={{ display: tab === "guias" ? "block" : "none" }}>
        <GuidelinesReviewTab patient={patient} onWhy={setWhy} />
      </div>
      <WhyModal data={why} onClose={() => setWhy(null)} />
      {showAddClinicalInfo && (
        <AddClinicalInfoModal
          onClose={() => setShowAddClinicalInfo(false)}
          onAdd={(events) => {
            addClinicalEvents(patient.id, events);
            setShowAddClinicalInfo(false);
            setTab("resumen");
          }}
        />
      )}
    </div>
  );
}
