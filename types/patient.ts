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
 * listado). Hoy depende únicamente de SentinelEngine — ver
 * `patientStatus()` en engines/sentinel/index.ts, incluida la nota
 * LEGACY sobre su desalineación conocida con el badge de alertas (que
 * también suma Turning Points y contradicciones).
 *
 * "sin_tendencia": sin historia longitudinal suficiente para comparar
 * (0 eventos, una sola fecha clínica, o datos por debajo del mínimo de
 * cualquier detector de tendencia) — nunca se infiere "estable" por la
 * mera ausencia de un hallazgo objetivo.
 */
export type PatientStatus = "estable" | "revision" | "deterioro" | "sin_tendencia";

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
