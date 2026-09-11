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
import { argosInterpretation, buildArgosExplanation } from "./interpretation";
import { exacerbationsByYear, selectMicrobiology, selectPFTWithFEV1 } from "@/domain/selectors";
import type { Patient, PatientStatus } from "@/types/patient";
import type { SentinelFinding } from "@/types/sentinel";

export function computeSentinelFindings(patient: Patient): SentinelFinding[] {
  return detectObjectiveSentinelSignals(patient).map((signal) => {
    const guidelineInterpretations = buildGuidelineInterpretations(patient, signal);
    const interpretation = argosInterpretation(signal);
    return {
      ...signal,
      interpretation,
      explanation: buildArgosExplanation(signal, interpretation),
      guidelineInterpretations,
      noSupportMessage: guidelineInterpretations.length ? null : NO_SUPPORT_MESSAGE,
    };
  });
}

/**
 * ¿Hay suficiente historia longitudinal para que la AUSENCIA de un
 * hallazgo objetivo (ver objectiveDetectors.ts) signifique algo? Usa
 * EXACTAMENTE los mismos umbrales que ya exige cada detector de
 * tendencia — 3 determinaciones de FEV1, 2 años con exacerbaciones
 * registradas, 2 aislamientos del mismo organismo — nunca un umbral
 * nuevo: solo comprueba si al menos uno de los detectores YA existentes
 * tenía datos suficientes para haber podido dispararse. Si ninguno los
 * tiene, "no se ha detectado nada" no es evidencia de estabilidad, es
 * ausencia de comparación posible.
 *
 * El detector de "inicio de soporte respiratorio" no entra aquí a
 * propósito: no es una comparación longitudinal (no necesita un
 * "antes"), así que en cuanto existe YA genera su propio hallazgo — la
 * función nunca llega a este chequeo con soporte respiratorio presente.
 */
function hasEvaluableLongitudinalData(patient: Patient): boolean {
  if (selectPFTWithFEV1(patient.events).length >= 3) return true;
  if (exacerbationsByYear(patient).length >= 2) return true;
  const organismCounts: Record<string, number> = {};
  selectMicrobiology(patient.events).forEach((m) => {
    organismCounts[m.organism] = (organismCounts[m.organism] || 0) + 1;
  });
  return Object.values(organismCounts).some((count) => count >= 2);
}

/**
 * Estado agregado del paciente para la UI (pill de estado, orden del
 * listado). "deterioro" requiere una interpretación respaldada por guía
 * con estado "Cumple" (no un umbral heurístico arbitrario); "revisión"
 * cubre cualquier otro hallazgo objetivo, con o sin soporte de guía.
 *
 * "estable" NUNCA es el valor por defecto ante la ausencia de
 * hallazgos: "no se ha detectado deterioro" y "el paciente está
 * estable" son cosas distintas (ver hasEvaluableLongitudinalData). Sin
 * historia longitudinal evaluable — 0 eventos, una sola fecha clínica,
 * o datos que no alcanzan el mínimo de ningún detector de tendencia —
 * el estado es "sin_tendencia": no se infiere estabilidad por ausencia
 * de deterioro detectado.
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
  if (!hasEvaluableLongitudinalData(patient)) return "sin_tendencia";
  return "estable";
}
