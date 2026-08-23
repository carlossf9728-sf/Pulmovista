/**
 * Vincula señales Sentinel objetivas con GuidelineMatch — sin modificar
 * engines/guidelines/match.ts y sin inventar ninguna regla clínica nueva.
 *
 * Para cada señal objetiva, `relatedCriteriaFor()` identifica qué
 * GuidelineCriterion de la base de conocimiento están temáticamente
 * relacionados con ese tipo de cambio (p. ej. "aumento de exacerbaciones"
 * con el criterio de "alto riesgo de exacerbación" que ya usan varias
 * GuidelineRecommendation reales). No es una regla clínica nueva: es la
 * relación entre el propio contenido de la señal y el criterio ya citado
 * y auditado en ers2025.ts/separ2018.ts.
 *
 * A partir de ahí, se muestran las GuidelineRecommendation (dentro del
 * alcance ya soportado por matchPatientToGuidelines — ver match.ts) que
 * referencian esos criterios, con el estado REAL que el motor ya calculó
 * — cumpla, no cumpla o falte información — nunca solo las que "cumplen".
 * Si ningún criterio de la base de conocimiento se relaciona con la
 * señal (fev1-trend-decline, new-respiratory-support, o un organismo
 * persistente que no sea Pseudomonas aeruginosa), no hay interpretación
 * posible dentro del alcance actual de las guías cargadas.
 */
import { criteriaSummaryText } from "@/engines/guidelines/explain";
import { findRecommendationById, KNOWLEDGE_BASE_DOCUMENTS } from "@/engines/guidelines/knowledge";
import { matchPatientToGuidelines } from "@/engines/guidelines/match";
import { todayISO } from "@/utils/date";
import type { Patient } from "@/types/patient";
import type { GuidelineMatch, GuidelineMatchStatus } from "@/types/guideline";
import type { ClinicalExplanation } from "@/types/evidence";
import type { ObjectiveSentinelSignal, SentinelGuidelineInterpretation, SentinelStatusLabel } from "@/types/sentinel";

export const NO_SUPPORT_MESSAGE = "No se ha encontrado soporte suficiente en las guías cargadas para interpretar clínicamente este hallazgo.";

/** Traducción a lenguaje clínico de GuidelineMatchStatus — la UI nunca muestra el término técnico "GuidelineMatch". */
const STATUS_LABEL: Record<GuidelineMatchStatus, SentinelStatusLabel> = {
  applies: "Cumple",
  possibly_applies: "Posiblemente cumple",
  insufficient_data: "Información insuficiente",
  does_not_apply: "No cumple",
};

function relatedCriteriaFor(signal: ObjectiveSentinelSignal): string[] {
  switch (signal.signalId) {
    case "exacerbation-rate-increase":
      return ["ers-crit-high-risk-exacerbation", "separ-crit-macrolidos-poblacion"];
    case "persistent-organism":
      // Solo Pseudomonas aeruginosa tiene GuidelineCriterion asociado dentro del alcance actual (5 temas soportados).
      return /pseudomonas aeruginosa/i.test(signal.subject ?? "")
        ? ["ers-crit-chronic-pseudomonas", "ers-crit-new-pseudomonas-isolation", "separ-crit-primoinfeccion-pa"]
        : [];
    case "fev1-trend-decline":
    case "new-respiratory-support":
      return [];
  }
}

function buildExplanation(signal: ObjectiveSentinelSignal, match: GuidelineMatch, statusLabel: SentinelStatusLabel): ClinicalExplanation {
  const recommendation = findRecommendationById(match.recommendationId);
  const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === match.guidelineCitation.guidelineId);

  return {
    kindLabel: "guideline",
    source: {
      kind: "guideline",
      guidelineId: match.guidelineCitation.guidelineId,
      recommendationId: match.recommendationId,
      society: document?.source.society ?? match.guidelineCitation.guidelineId,
      year: document?.source.year ?? 0,
      section: match.guidelineCitation.section,
      page: match.guidelineCitation.page,
    },
    sections: [
      { label: "Dato del paciente", emphasis: true, text: signal.datum },
      { label: "Criterio de la guía", text: criteriaSummaryText(match) },
      { label: "Evaluación", text: `${statusLabel} para este criterio.` },
      { label: "Recomendación", text: recommendation?.recommendationText ?? "Texto no disponible." },
      { label: "Guía", text: document ? `${document.source.society} · ${document.source.year}` : match.guidelineCitation.guidelineId },
      { label: "Sección", text: match.guidelineCitation.section ?? "No documentada por la guía." },
      { label: "Página", text: match.guidelineCitation.page != null ? `p. ${match.guidelineCitation.page}` : "No documentada por la guía." },
      { label: "Fragmento fuente", text: match.guidelineCitation.sourceText },
    ],
    evidence: match.patientEvidence,
  };
}

/**
 * Interpretaciones respaldadas por guía para una señal objetiva de
 * Sentinel. ERS y SEPAR se mantienen siempre separadas (nunca se
 * fusionan) — cada recomendación relacionada aparece como su propia
 * entrada, con su propio estado real y su propia cita exacta.
 */
export function buildGuidelineInterpretations(patient: Patient, signal: ObjectiveSentinelSignal): SentinelGuidelineInterpretation[] {
  const relatedCriteria = relatedCriteriaFor(signal);
  if (!relatedCriteria.length) return [];

  const matches = matchPatientToGuidelines(patient, todayISO());
  return matches.flatMap((match): SentinelGuidelineInterpretation[] => {
    const recommendation = findRecommendationById(match.recommendationId);
    const document = KNOWLEDGE_BASE_DOCUMENTS.find((d) => d.guidelineId === match.guidelineCitation.guidelineId);
    if (!recommendation || !document) return [];

    const referencedIds = [...recommendation.criteria, ...recommendation.exclusions, ...recommendation.prerequisites];
    if (!referencedIds.some((id) => relatedCriteria.includes(id))) return [];

    const statusLabel = STATUS_LABEL[match.status];
    return [
      {
        guidelineId: match.guidelineCitation.guidelineId,
        society: document.source.society,
        year: document.source.year,
        recommendationId: match.recommendationId,
        recommendationText: recommendation.recommendationText,
        statusLabel,
        strength: recommendation.strength,
        evidenceQuality: recommendation.evidenceQuality,
        section: match.guidelineCitation.section,
        page: match.guidelineCitation.page,
        sourceText: match.guidelineCitation.sourceText,
        explanation: buildExplanation(signal, match, statusLabel),
      },
    ];
  });
}
