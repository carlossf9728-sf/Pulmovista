/**
 * Detección OBJETIVA de señales Sentinel — datos, no interpretación
 * clínica. Réplica de la lógica numérica que antes vivía en
 * `legacyRules.ts` (heurísticas legacy, eliminadas tras la migración a
 * GuidelineMatch): mismos umbrales de detección — 3 determinaciones de
 * FEV1 en descenso consecutivo, aumento año a año del número de
 * exacerbaciones, ≥2 aislamientos del mismo organismo, inicio de soporte
 * respiratorio. Ninguno de estos detectores atribuye significado clínico
 * ni recomienda nada: eso es responsabilidad exclusiva de la capa de
 * interpretación respaldada por guía (ver guidelineInterpretation.ts).
 *
 * Cambio respecto a la regla legacy original: "aislamiento microbiológico
 * persistente" se descompone en una señal POR ORGANISMO (antes se
 * combinaba en un único hallazgo con todos los organismos repetidos).
 * Es necesario para el paso siguiente: solo un subconjunto de organismos
 * (Pseudomonas aeruginosa) tiene GuidelineCriterion asociado en el
 * alcance actual de GuidelineMatch, y cada organismo debe poder mostrar
 * su propio soporte (o falta de soporte) de forma independiente.
 */
import { formatDate, sortByDate } from "@/utils/date";
import { cap } from "@/utils/text";
import { CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { exacerbationsByYear, selectMicrobiology, selectPFTWithFEV1 } from "@/domain/selectors";
import type { Patient } from "@/types/patient";
import type { ObjectiveSentinelSignal } from "@/types/sentinel";
import type { RespiratorySupportEvent } from "@/types/clinicalEvent";

function isRespiratorySupport(e: { type: string }): e is RespiratorySupportEvent {
  return e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT;
}

export function detectObjectiveSentinelSignals(patient: Patient): ObjectiveSentinelSignal[] {
  const signals: ObjectiveSentinelSignal[] = [];

  // 1) tendencia descendente de FEV1 (3 determinaciones consecutivas en descenso)
  const pfts = selectPFTWithFEV1(patient.events);
  if (pfts.length >= 3) {
    const last3 = pfts.slice(-3);
    const decreasing = last3[0].FEV1Percent > last3[1].FEV1Percent && last3[1].FEV1Percent > last3[2].FEV1Percent;
    if (decreasing) {
      signals.push({
        signalId: "fev1-trend-decline",
        label: "Tendencia descendente de FEV1",
        datum: `FEV1: ${last3.map((p) => p.FEV1Percent + "%").join(" → ")} (${formatDate(last3[0].date)} – ${formatDate(last3[2].date)}).`,
        evidence: last3.map((p) => ({ label: `FEV1 ${p.FEV1Percent}%`, date: p.date })),
      });
    }
  }

  // 2) aumento de la tasa de exacerbaciones año a año
  const years = exacerbationsByYear(patient);
  if (years.length >= 2) {
    const lastTwo = years.slice(-2);
    if (lastTwo[1].count > lastTwo[0].count) {
      signals.push({
        signalId: "exacerbation-rate-increase",
        label: "Aumento de la tasa de exacerbaciones",
        datum: `Exacerbaciones: ${years.map((y) => `${y.count} (${y.year})`).join(" → ")}.`,
        evidence: years.map((y) => ({ label: `${y.year}: ${y.count} exacerbación(es)`, date: null })),
      });
    }
  }

  // 3) aislamiento microbiológico persistente (mismo organismo ≥2 veces), una señal por organismo
  const micro = selectMicrobiology(patient.events);
  const counts: Record<string, number> = {};
  micro.forEach((m) => {
    counts[m.organism] = (counts[m.organism] || 0) + 1;
  });
  Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .forEach(([organism, count]) => {
      signals.push({
        signalId: "persistent-organism",
        label: "Aislamiento microbiológico persistente",
        datum: `${count} aislamientos de ${organism}.`,
        subject: organism,
        evidence: micro.filter((m) => m.organism === organism).map((m) => ({ label: m.organism, date: m.date })),
      });
    });

  // 4) inicio de soporte respiratorio
  const support = sortByDate(patient.events.filter(isRespiratorySupport));
  if (support.length) {
    const first = support[0];
    signals.push({
      signalId: "new-respiratory-support",
      label: "Inicio de soporte respiratorio",
      datum: `Inicio de ${cap(first.drug)} el ${formatDate(first.date)}.`,
      subject: first.drug,
      evidence: [{ label: `Inicio de ${cap(first.drug)}`, date: first.date }],
    });
  }

  return signals;
}
