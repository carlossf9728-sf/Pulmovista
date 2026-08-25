import type { ClinicalEvent } from "./clinicalEvent";

export type PatientSex = "Mujer" | "Hombre" | "Otro / no consta";

export interface Patient {
  id: string;
  /** Código PulmoVista, formato "PV-XXXX-XXXX". */
  code: string;
  sex: PatientSex;
  age: number | null;
  primaryDiagnosis: string;
  secondaryDiagnoses: string;
  /** Fecha ISO de creación del expediente. */
  createdAt: string;
  events: ClinicalEvent[];
}

/**
 * Estado agregado del paciente para la UI (pill de estado, orden del
 * listado). Hoy depende únicamente de SentinelEngine — ver nota LEGACY en
 * domain/patientStatus.ts sobre su desalineación conocida con el badge de
 * alertas (que también suma Turning Points y contradicciones).
 */
export type PatientStatus = "estable" | "revision" | "deterioro";

/**
 * Datos demográficos del formulario "Nuevo paciente" — sin el texto
 * clínico inicial: ese texto se separa en ClinicalEvent[] ya revisados
 * antes de llegar a createPatient() (ver NewPatientModal), igual que
 * "Añadir información clínica" para un paciente existente.
 */
export interface NewPatientInput {
  sex: PatientSex;
  age: number | null;
  primaryDiagnosis: string;
  secondaryDiagnoses: string;
}
