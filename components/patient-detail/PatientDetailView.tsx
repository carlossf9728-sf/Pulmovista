"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { selectConsultations } from "@/domain/selectors";
import { computeSentinelFindings, patientStatus } from "@/engines/sentinel";
import { computeTurningPoints } from "@/engines/turningPoints";
import { detectContradictions } from "@/engines/longitudinal";
import { usePatients } from "@/app/providers";
import { StatusPill, WhyModal } from "@/components/ui";
import { AddConsultationModal } from "@/components/patients/AddConsultationModal";
import { SummaryTab } from "./SummaryTab";
import { TimelineTab } from "./TimelineTab";
import { PFTTab } from "./PFTTab";
import { MicrobiologyTab } from "./MicrobiologyTab";
import { TreatmentsTab } from "./TreatmentsTab";
import { ImagingTab } from "./ImagingTab";
import { ConsultsTab } from "./ConsultsTab";
import { AlertsTab } from "./AlertsTab";
import { GuidelinesReviewTab } from "./GuidelinesReviewTab";
import type { Patient } from "@/types/patient";
import type { ClinicalExplanation } from "@/types/evidence";

type TabKey = "resumen" | "timeline" | "funcion" | "micro" | "tratamientos" | "radiologia" | "consultas" | "alertas" | "guias";

const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "timeline", label: "Cronología" },
  { key: "funcion", label: "Función pulmonar" },
  { key: "micro", label: "Microbiología" },
  { key: "tratamientos", label: "Tratamientos" },
  { key: "radiologia", label: "Radiología" },
  { key: "consultas", label: "Consultas" },
  { key: "alertas", label: "Alertas" },
  { key: "guias", label: "Revisión según guías" },
];

function isTabKey(v: string | null): v is TabKey {
  return !!v && TABS.some((t) => t.key === v);
}

export function PatientDetailView({ patient }: { patient: Patient }) {
  const { addConsultation } = usePatients();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabKey>(isTabKey(initialTab) ? initialTab : "resumen");
  const [why, setWhy] = useState<ClinicalExplanation | null>(null);
  const [showAddConsult, setShowAddConsult] = useState(false);

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
            <span>{patient.age ?? "Edad no disponible"} años</span>
            <span>{patient.sex}</span>
            <span>Primera valoración: {formatDate(patient.createdAt)}</span>
            <span>Última actualización: {formatDate(lastConsult?.date)}</span>
          </div>
        </div>
        <StatusPill status={status} />
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
      {tab === "resumen" && <SummaryTab patient={patient} />}
      {tab === "timeline" && <TimelineTab patient={patient} />}
      {tab === "funcion" && <PFTTab patient={patient} />}
      {tab === "micro" && <MicrobiologyTab patient={patient} />}
      {tab === "tratamientos" && <TreatmentsTab patient={patient} />}
      {tab === "radiologia" && <ImagingTab patient={patient} />}
      {tab === "consultas" && <ConsultsTab patient={patient} onAddConsultation={() => setShowAddConsult(true)} />}
      {tab === "alertas" && <AlertsTab patient={patient} onWhy={setWhy} />}
      {tab === "guias" && <GuidelinesReviewTab patient={patient} onWhy={setWhy} />}
      <WhyModal data={why} onClose={() => setWhy(null)} />
      {showAddConsult && (
        <AddConsultationModal
          onClose={() => setShowAddConsult(false)}
          onAdd={(text) => {
            addConsultation(patient.id, text);
            setShowAddConsult(false);
            setTab("resumen");
          }}
        />
      )}
    </div>
  );
}
