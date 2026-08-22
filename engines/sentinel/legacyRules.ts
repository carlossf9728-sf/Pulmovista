/**
 * LEGACY / EXPERIMENTAL / PENDIENTE DE SUSTITUCIÓN POR GuidelineEngine.
 * ----------------------------------------------------------------------
 * Estas 4 reglas son heurísticas locales del prototipo original — NO son
 * una recomendación clínica validada. Se conservan sin cambios de
 * comportamiento por paridad funcional, pero NO deben tratarse como la
 * base clínica definitiva del proyecto.
 *
 * Cuando exista GuidelineEngine, el flujo previsto es:
 *
 *   datos del paciente → GuidelineEngine → GuidelineMatch → alerta respaldada por guía
 *
 * y este archivo podrá eliminarse (o quedar como fallback) sin que
 * `engines/sentinel/index.ts` cambie su forma de salida hacia la UI.
 */
import { formatDate } from "@/utils/date";
import { cap } from "@/utils/text";
import { CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { exacerbationsByYear, selectMicrobiology, selectPFTWithFEV1 } from "@/domain/selectors";
import { sortByDate } from "@/utils/date";
import type { Patient } from "@/types/patient";
import type { SentinelConfidence } from "@/types/sentinel";
import type { RespiratorySupportEvent } from "@/types/clinicalEvent";

export interface LegacySentinelRuleResult {
  dato: string;
  interpretacion: string;
  recomendacion: string;
  evidence: string[];
  confidence: SentinelConfidence;
}

export interface LegacySentinelRule {
  ruleId: string;
  label: string;
  evaluate(patient: Patient): LegacySentinelRuleResult | null;
}

function isRespiratorySupport(e: { type: string }): e is RespiratorySupportEvent {
  return e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT;
}

export const SENTINEL_LEGACY_RULES: LegacySentinelRule[] = [
  {
    ruleId: "fev1-trend-decline",
    label: "Tendencia descendente de FEV1",
    evaluate(patient) {
      const pfts = selectPFTWithFEV1(patient.events);
      if (pfts.length < 3) return null;
      const last3 = pfts.slice(-3);
      const decreasing = last3[0].FEV1Percent > last3[1].FEV1Percent && last3[1].FEV1Percent > last3[2].FEV1Percent;
      if (!decreasing) return null;
      const dropRel = (last3[0].FEV1Percent - last3[2].FEV1Percent) / last3[0].FEV1Percent;
      return {
        dato: `FEV1: ${last3.map((p) => p.FEV1Percent + "%").join(" → ")} (${formatDate(last3[0].date)} – ${formatDate(last3[2].date)}).`,
        interpretacion: "Existe una tendencia funcional descendente sostenida en las últimas determinaciones.",
        recomendacion: "Revisar según la guía correspondiente si este cambio cumple criterios de reevaluación terapéutica.",
        evidence: last3.map((p) => `${formatDate(p.date)} — FEV1 ${p.FEV1Percent}%`),
        confidence: dropRel >= 0.15 ? "Alta" : "Moderada",
      };
    },
  },
  {
    ruleId: "exacerbation-rate-increase",
    label: "Aumento de la tasa de exacerbaciones",
    evaluate(patient) {
      const years = exacerbationsByYear(patient);
      if (years.length < 2) return null;
      const lastTwo = years.slice(-2);
      if (lastTwo[1].count <= lastTwo[0].count) return null;
      return {
        dato: `Exacerbaciones: ${years.map((y) => `${y.count} (${y.year})`).join(" → ")}.`,
        interpretacion: "El número de exacerbaciones anuales muestra una tendencia creciente respecto al periodo previo.",
        recomendacion: "Considerar revisión de la estrategia de tratamiento de mantenimiento según la guía aplicable al diagnóstico.",
        evidence: years.map((y) => `${y.year}: ${y.count} exacerbación(es)`),
        confidence: lastTwo[1].count - lastTwo[0].count >= 2 ? "Alta" : "Moderada",
      };
    },
  },
  {
    ruleId: "persistent-organism",
    label: "Aislamiento microbiológico persistente",
    evaluate(patient) {
      const micro = selectMicrobiology(patient.events);
      const counts: Record<string, number> = {};
      micro.forEach((m) => {
        counts[m.organism] = (counts[m.organism] || 0) + 1;
      });
      const repeated = Object.entries(counts).filter(([, c]) => c >= 2);
      if (!repeated.length) return null;
      return {
        dato: repeated.map(([org, c]) => `${c} aislamientos de ${org}`).join("; ") + ".",
        interpretacion: "El mismo microorganismo se ha aislado de forma repetida, compatible con colonización o infección persistente.",
        recomendacion: "Valorar tratamiento supresor o revisión del antibiograma más reciente según la guía correspondiente.",
        evidence: micro.filter((m) => repeated.some(([org]) => org === m.organism)).map((m) => `${formatDate(m.date)} — ${m.organism}`),
        confidence: repeated.some(([, c]) => c >= 3) ? "Alta" : "Moderada",
      };
    },
  },
  {
    ruleId: "new-respiratory-support",
    label: "Inicio de soporte respiratorio",
    evaluate(patient) {
      const support = sortByDate(patient.events.filter(isRespiratorySupport));
      if (!support.length) return null;
      const first = support[0];
      return {
        dato: `Inicio de ${cap(first.drug)} el ${formatDate(first.date)}.`,
        interpretacion: "El inicio de soporte respiratorio suele asociarse a progresión de la enfermedad de base.",
        recomendacion: "Confirmar indicación y reevaluar periódicamente la necesidad de soporte según la guía correspondiente.",
        evidence: [`${formatDate(first.date)} — inicio de ${cap(first.drug)}`],
        confidence: "Moderada",
      };
    },
  },
];
