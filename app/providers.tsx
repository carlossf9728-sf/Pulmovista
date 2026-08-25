"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildDemoPatients } from "@/data/demoPatients";
import { runExtractionEngine } from "@/engines/extraction";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { uid, generatePulmoVistaCode } from "@/utils/id";
import { todayISO } from "@/utils/date";
import type { ClinicalEvent, ConsultationEvent } from "@/types/clinicalEvent";
import type { NewPatientInput, Patient } from "@/types/patient";

/**
 * Almacén de pacientes en memoria del cliente. Reemplaza al estado del
 * componente App() raíz del prototipo (useState + handlers) ahora que la
 * app está repartida en varias rutas de Next.js. Sigue sin backend: los
 * datos viven solo en memoria del navegador y se reinician al recargar,
 * igual que en el prototipo original.
 */
interface PatientsContextValue {
  patients: Patient[];
  createPatient(input: NewPatientInput): Patient;
  /**
   * Añade los ClinicalEvent que el médico ya confirmó/corrigió en la
   * vista de revisión de "Añadir información clínica" (ver
   * AddClinicalInfoModal) — a diferencia del antiguo addConsultation(),
   * no vuelve a ejecutar el motor de extracción aquí: eso ya se hizo (y
   * se revisó) antes de llegar a esta función.
   */
  addClinicalEvents(patientId: string, events: ClinicalEvent[]): void;
}

const PatientsContext = createContext<PatientsContextValue | null>(null);

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(() => buildDemoPatients());

  function createPatient(input: NewPatientInput): Patient {
    const id = uid("p");
    const code = generatePulmoVistaCode();
    const date = todayISO();
    const extracted = input.rawText ? runExtractionEngine(input.rawText, date) : [];
    const consultEvent = mkEvent<ConsultationEvent>(
      id,
      CLINICAL_EVENT_TYPES.CONSULTATION,
      date,
      {},
      { rawText: input.rawText || "Sin texto clínico inicial.", source: "manual" },
    );
    const events: ClinicalEvent[] = [consultEvent, ...extracted.map((e) => ({ ...e, patientId: id }))];
    const newPatient: Patient = {
      id,
      code,
      sex: input.sex,
      age: input.age,
      primaryDiagnosis: input.primaryDiagnosis,
      secondaryDiagnoses: input.secondaryDiagnoses,
      createdAt: date,
      events,
    };
    setPatients((prev) => [newPatient, ...prev]);
    return newPatient;
  }

  function addClinicalEvents(patientId: string, events: ClinicalEvent[]) {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return { ...p, events: [...p.events, ...events.map((e) => ({ ...e, patientId }))] };
      }),
    );
  }

  const value = useMemo<PatientsContextValue>(
    () => ({ patients, createPatient, addClinicalEvents }),
    [patients],
  );

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients(): PatientsContextValue {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error("usePatients() debe usarse dentro de <PatientsProvider>");
  return ctx;
}
