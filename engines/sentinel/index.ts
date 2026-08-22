/**
 * SentinelEngine
 * ----------------------------------------------------------------------
 * `computeSentinelFindings()` ejecuta hoy únicamente las reglas legacy de
 * `legacyRules.ts` (ver aviso LEGACY/EXPERIMENTAL ahí). La forma de
 * salida (`SentinelFinding`) ya separa `source` del contenido, así que en
 * la fase de guías este módulo podrá sustituir el cuerpo de
 * `computeSentinelFindings()` por:
 *
 *   datos del paciente → GuidelineEngine.matchGuidelines() → GuidelineMatch[]
 *     → SentinelFinding[] (con source: { kind: "guideline", ... })
 *
 * sin cambiar la interfaz que consumen SentinelView/AlertsTab.
 */
import { SENTINEL_LEGACY_RULES } from "./legacyRules";
import type { Patient, PatientStatus } from "@/types/patient";
import type { ClinicalExplanation, ClinicalSource, EvidenceItem } from "@/types/evidence";
import type { SentinelFinding } from "@/types/sentinel";

export { SENTINEL_LEGACY_RULES };

export function computeSentinelFindings(patient: Patient): SentinelFinding[] {
  const findings: SentinelFinding[] = [];
  for (const rule of SENTINEL_LEGACY_RULES) {
    const result = rule.evaluate(patient);
    if (!result) continue;

    const source: ClinicalSource = { kind: "legacy_heuristic", ruleId: rule.ruleId, label: rule.label };
    const evidence: EvidenceItem[] = result.evidence.map((label) => ({ label }));
    const explanation: ClinicalExplanation = {
      kindLabel: "heurística experimental",
      source,
      sections: [
        { label: "Dato", text: result.dato, emphasis: true },
        { label: "Interpretación", text: result.interpretacion },
        { label: "Recomendación", text: result.recomendacion },
      ],
      evidence,
    };

    findings.push({
      ruleId: rule.ruleId,
      label: rule.label,
      source,
      datum: result.dato,
      interpretation: result.interpretacion,
      recommendation: result.recomendacion,
      evidence,
      confidence: result.confidence,
      explanation,
    });
  }
  return findings;
}

/**
 * Estado agregado del paciente para la UI (pill de estado, orden del
 * listado). Depende únicamente de la confianza de los hallazgos Sentinel.
 *
 * LEGACY / incoherencia conocida (documentada, no corregida en esta
 * fase): el badge de "alertas" que se muestra en la UI (sidebar, pestaña
 * Alertas) suma Sentinel + Turning Points + contradicciones, mientras que
 * `patientStatus` solo mira Sentinel. Un paciente puede aparecer como
 * "Estable" y aun así tener un badge de alertas > 0. Revisar cuando se
 * sustituya Sentinel por GuidelineEngine.
 */
export function patientStatus(patient: Patient): PatientStatus {
  const findings = computeSentinelFindings(patient);
  if (!findings.length) return "estable";
  if (findings.some((f) => f.confidence === "Alta")) return "deterioro";
  return "revision";
}
