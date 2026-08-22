"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { COLORS, STATUS } from "@/utils/theme";
import { selectConsultations } from "@/domain/selectors";
import { patientStatus } from "@/engines/sentinel";
import { formatDate } from "@/utils/date";
import { StatusPill } from "@/components/ui";
import type { Patient } from "@/types/patient";

export function PatientCard({ patient }: { patient: Patient }) {
  const status = patientStatus(patient);
  const s = STATUS[status];
  const last = selectConsultations(patient.events).slice(-1)[0];
  return (
    <Link
      href={`/pacientes/${patient.id}`}
      className="pv-card-hover"
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.line}`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: 12,
        padding: "16px 18px",
        cursor: "pointer",
        display: "block",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="pv-mono" style={{ fontWeight: 700, fontSize: 14.5, color: COLORS.navy }}>
          {patient.code}
        </div>
        <ChevronRight size={16} color={COLORS.slateLight} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, margin: "6px 0 2px" }}>{patient.primaryDiagnosis}</div>
      <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 12 }}>
        {patient.sex} · {patient.age} años
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: COLORS.slateLight }}>
          Última actualización: {formatDate(last ? last.date : patient.createdAt)}
        </span>
        <StatusPill status={status} />
      </div>
    </Link>
  );
}
