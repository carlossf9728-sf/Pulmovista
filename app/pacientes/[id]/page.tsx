"use client";

import { useParams } from "next/navigation";
import { usePatients } from "@/app/providers";
import { PatientDetailView } from "@/components/patient-detail/PatientDetailView";
import { COLORS } from "@/utils/theme";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { patients } = usePatients();
  const patient = patients.find((p) => p.id === id);

  if (!patient) {
    return <div style={{ color: COLORS.slateLight, fontSize: 13.5 }}>No disponible: no se ha encontrado ningún paciente con ese identificador.</div>;
  }
  return <PatientDetailView patient={patient} />;
}
