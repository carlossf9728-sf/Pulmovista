"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildDemoPatients } from "@/data/demoPatients";
import { uid, generatePulmoVistaCode } from "@/utils/id";
import { todayISO } from "@/utils/date";
import type { ClinicalEvent } from "@/types/clinicalEvent";
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
  /**
   * Crea el paciente con los datos demográficos y los ClinicalEvent que
   * el médico ya confirmó/corrigió en la vista de revisión de "Nuevo
   * paciente" (ver NewPatientModal) — igual que addClinicalEvents(), no
   * vuelve a ejecutar el motor de extracción aquí.
   */
  createPatient(input: NewPatientInput, events: ClinicalEvent[]): Patient;
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

  function createPatient(input: NewPatientInput, events: ClinicalEvent[]): Patient {
    const id = uid("p");
    const newPatient: Patient = {
      id,
      code: generatePulmoVistaCode(),
      sex: input.sex,
      age: input.age,
      primaryDiagnosis: input.primaryDiagnosis,
      secondaryDiagnoses: input.secondaryDiagnoses,
      createdAt: todayISO(),
      events: events.map((e) => ({ ...e, patientId: id })),
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
