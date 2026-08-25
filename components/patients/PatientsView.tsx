"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { usePatients } from "@/app/providers";
import { Eyebrow } from "@/components/ui";
import { PatientCard } from "./PatientCard";
import { NewPatientModal } from "./NewPatientModal";

export function PatientsView() {
  const { patients, createPatient } = usePatients();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showNewPatient, setShowNewPatient] = useState(false);

  const filtered = patients.filter(
    (p) => p.code.toLowerCase().includes(query.toLowerCase()) || p.primaryDiagnosis.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="pv-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <Eyebrow>Pacientes</Eyebrow>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>Mis pacientes</h1>
        </div>
        <button
          onClick={() => setShowNewPatient(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "white", border: "none", borderRadius: 9, padding: "10px 16px", fontWeight: 700, fontSize: 13 }}
        >
          <Plus size={15} /> Nuevo paciente
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por código PulmoVista o diagnóstico…"
        style={{ width: "100%", maxWidth: 420, padding: "10px 13px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, marginBottom: 20 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {filtered.map((p) => (
          <PatientCard key={p.id} patient={p} />
        ))}
        {!filtered.length && <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>Ningún paciente coincide con la búsqueda.</div>}
      </div>

      {showNewPatient && (
        <NewPatientModal
          onClose={() => setShowNewPatient(false)}
          onCreate={(input, events) => {
            const patient = createPatient(input, events);
            setShowNewPatient(false);
            router.push(`/pacientes/${patient.id}`);
          }}
        />
      )}
    </div>
  );
}
