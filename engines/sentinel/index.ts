/**
 * SentinelEngine — migrado de heurísticas legacy a GuidelineMatch.
 * ----------------------------------------------------------------------
 *   datos del paciente → objectiveDetectors.ts (cambio objetivo)
 *     → guidelineInterpretation.ts (GuidelineMatch → interpretación,
 *       cuando la base de conocimiento la respalda) → SentinelFinding[]
 *
 * Ninguna interpretación clínica ni recomendación mostrada por Sentinel
 * procede ya de heurísticas legacy (`legacyRules.ts`, eliminado): cuando
 * no hay una GuidelineRecommendation relacionada dentro del alcance
 * actual de GuidelineMatch, el hallazgo se muestra solo con su dato
 * objetivo y `noSupportMessage`, nunca con una interpretación inventada.
 *
 * Turning Points, Missing Information y Review Opportunities NO se han
 * tocado en esta migración — siguen usando sus heurísticas legacy.
 */
import { buildGuidelineInterpretations, NO_SUPPORT_MESSAGE } from "./guidelineInterpretation";
import { detectObjectiveSentinelSignals } from "./objectiveDetectors";
import type { Patient, PatientStatus } from "@/types/patient";
import type { SentinelFinding } from "@/types/sentinel";

export function computeSentinelFindings(patient: Patient): SentinelFinding[] {
  return detectObjectiveSentinelSignals(patient).map((signal) => {
    const guidelineInterpretations = buildGuidelineInterpretations(patient, signal);
    return {
      ...signal,
      guidelineInterpretations,
      noSupportMessage: guidelineInterpretations.length ? null : NO_SUPPORT_MESSAGE,
    };
  });
}

/**
 * Estado agregado del paciente para la UI (pill de estado, orden del
 * listado). "deterioro" ahora requiere una interpretación respaldada por
 * guía con estado "Cumple" (no un umbral heurístico arbitrario);
 * "revisión" cubre cualquier otro hallazgo objetivo, con o sin soporte de
 * guía; "estable" cuando no hay ningún hallazgo.
 *
 * LEGACY / incoherencia conocida (documentada, no corregida en esta
 * fase): el badge de "alertas" que se muestra en la UI (sidebar, pestaña
 * Alertas) suma Sentinel + Turning Points + contradicciones, mientras que
 * `patientStatus` solo mira Sentinel. Un paciente puede aparecer como
 * "Estable" y aun así tener un badge de alertas > 0.
 */
export function patientStatus(patient: Patient): PatientStatus {
  const findings = computeSentinelFindings(patient);
  if (findings.some((f) => f.guidelineInterpretations.some((gi) => gi.statusLabel === "Cumple"))) return "deterioro";
  if (findings.length) return "revision";
  return "estable";
}
