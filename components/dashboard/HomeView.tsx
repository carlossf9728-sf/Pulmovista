"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, X } from "lucide-react";
import type { CSSProperties } from "react";
import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { computeChangesSinceLastVisit } from "@/engines/longitudinal";
import { patientStatus } from "@/engines/sentinel";
import { usePatients } from "@/app/providers";
import { Card, Eyebrow } from "@/components/ui";
import { PatientCard } from "@/components/patients/PatientCard";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import type { Patient, PatientStatus } from "@/types/patient";
import type { ClinicalChange } from "@/types/longitudinal";

function actionCardStyle(): CSSProperties {
  return { textAlign: "left", background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 18, display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" };
}

export function HomeView() {
  const { patients, createPatient } = usePatients();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState<string | null>(null);
  const [showNewPatient, setShowNewPatient] = useState(false);

  const statuses = patients.map(patientStatus);
  const stats = {
    total: patients.length,
    estables: statuses.filter((s) => s === "estable").length,
    revision: statuses.filter((s) => s === "revision").length,
    sentinel: statuses.filter((s) => s === "deterioro").length,
  };

  const recentChanges: { patient: Patient; date: string; headline: ClinicalChange }[] = patients
    .map((p) => ({ patient: p, changes: computeChangesSinceLastVisit(p) }))
    .filter((x) => x.changes !== null && x.changes.changes.length > 0)
    .map((x) => ({ patient: x.patient, date: x.changes!.toDate, headline: x.changes!.changes[0] }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const order: Record<PatientStatus, number> = { deterioro: 0, revision: 1, estable: 2 };
  const sorted = [...patients].sort((a, b) => order[patientStatus(a)] - order[patientStatus(b)]);

  const handleSearch = () => {
    const q = query.trim().toUpperCase();
    const found = patients.find((p) => p.code === q);
    if (found) {
      setNotFound(null);
      router.push(`/pacientes/${found.id}`);
    } else {
      setNotFound(q);
    }
  };

  return (
    <div className="pv-fade-in">
      {notFound && (
        <div style={{ background: COLORS.redTint, color: COLORS.red, borderRadius: 9, padding: "10px 14px", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span>
            No se ha encontrado ningún paciente con el código <strong className="pv-mono">{notFound}</strong>.
          </span>
          <button onClick={() => setNotFound(null)} style={{ background: "none", border: "none", color: COLORS.red }}>
            <X size={14} />
          </button>
        </div>
      )}

      <Eyebrow>PulmoVista</Eyebrow>
      <h1 style={{ fontSize: 27, fontWeight: 800, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>Seguimiento longitudinal de pacientes respiratorios</h1>
      <p style={{ color: COLORS.slate, fontSize: 14, marginBottom: 22, maxWidth: 560 }}>
        Detecta cambios relevantes en la evolución de la enfermedad a partir de la historia clínica de cada paciente.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {(
          [
            ["Pacientes", stats.total, COLORS.navy],
            ["Estables", stats.estables, COLORS.green],
            ["Requieren revisión", stats.revision, COLORS.orange],
            ["Sentinel (alta confianza)", stats.sentinel, COLORS.red],
          ] as const
        ).map(([label, val, color]) => (
          <Card key={label} accent={color} hover={false}>
            <div style={{ fontSize: 11.5, color: COLORS.slate, fontWeight: 600 }}>{label}</div>
            <div className="pv-mono" style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>
              {val}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
        <button onClick={() => setShowNewPatient(true)} style={actionCardStyle()}>
          <Plus size={20} color={COLORS.teal} />
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Nuevo paciente</div>
          <div style={{ fontSize: 12, color: COLORS.slate }}>Crea un nuevo expediente PulmoVista</div>
        </button>
        <div style={actionCardStyle()}>
          <Search size={20} color={COLORS.navy} />
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Buscar paciente</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="PV-XXXX-XXXX"
            className="pv-mono"
            style={{ marginTop: 6, width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 12.5 }}
          />
        </div>
        <div style={actionCardStyle()}>
          <Users size={20} color={COLORS.slate} />
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Mis pacientes</div>
          <div style={{ fontSize: 12, color: COLORS.slate }}>{patients.length} pacientes ficticios almacenados</div>
        </div>
      </div>

      {!!recentChanges.length && (
        <div style={{ marginBottom: 28 }}>
          <Eyebrow color={COLORS.slate}>Cambios recientes</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {recentChanges.map((rc, i) => (
              <Link
                key={i}
                href={`/pacientes/${rc.patient.id}`}
                className="pv-card-hover"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="pv-mono" style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.navy }}>
                    {rc.patient.code}
                  </span>
                  <span style={{ fontSize: 13, color: COLORS.ink }}>
                    {rc.headline.label}: <strong>{rc.headline.to}</strong>
                  </span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.slateLight }}>{formatDate(rc.date)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Eyebrow color={COLORS.slate}>Mis pacientes</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginTop: 10 }}>
        {sorted.map((p) => (
          <PatientCard key={p.id} patient={p} />
        ))}
      </div>

      {showNewPatient && (
        <NewPatientModal
          onClose={() => setShowNewPatient(false)}
          onCreate={(input) => {
            const patient = createPatient(input);
            setShowNewPatient(false);
            router.push(`/pacientes/${patient.id}`);
          }}
        />
      )}
    </div>
  );
}
