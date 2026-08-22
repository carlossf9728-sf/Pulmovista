/**
 * TurningPointsEngine
 * ----------------------------------------------------------------------
 * Compone detección objetiva (objectiveDetectors.ts) + interpretación
 * LEGACY (legacyInterpretations.ts) en el `TurningPoint` que consume la
 * UI. Cuando exista una interpretación derivada de guías, solo hace
 * falta cambiar qué función rellena `interpretation`/`source` aquí — el
 * detector objetivo y el tipo `TurningPoint` no cambian.
 */
import { detectObjectiveTurningPoints } from "./objectiveDetectors";
import { interpretTurningPointLegacy, turningPointCriterionLabel } from "./legacyInterpretations";
import type { Patient } from "@/types/patient";
import type { ClinicalExplanation, ClinicalSource } from "@/types/evidence";
import type { TurningPoint } from "@/types/turningPoints";

export { detectObjectiveTurningPoints };

export function computeTurningPoints(patient: Patient): TurningPoint[] {
  return detectObjectiveTurningPoints(patient).map((tp) => {
    const interpretation = interpretTurningPointLegacy(tp);
    const source: ClinicalSource = {
      kind: "legacy_heuristic",
      ruleId: tp.criterion,
      label: turningPointCriterionLabel(tp.criterion),
    };
    const beforeAfterText = `${Object.entries(tp.before)
      .map(([k, v]) => `${k}: ${v ?? "No disponible"}`)
      .join(" · ")}  →  ${Object.entries(tp.after)
      .map(([k, v]) => `${k}: ${v ?? "No disponible"}`)
      .join(" · ")}`;
    const explanation: ClinicalExplanation = {
      kindLabel: "heurística experimental",
      source,
      sections: [
        { label: "Antes / Después", text: beforeAfterText, emphasis: true },
        { label: "Interpretación", text: interpretation },
      ],
      evidence: tp.evidence,
    };
    return { ...tp, source, interpretation, explanation };
  });
}
