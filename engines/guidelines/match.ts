/**
 * GuidelineMatch — motor de evaluación.
 * ----------------------------------------------------------------------
 * Relaciona los datos estructurados de un paciente (`Patient.events`,
 * `Patient.age`, `Patient.primaryDiagnosis`/`secondaryDiagnoses`) con los
 * `GuidelineCriterion`/`GuidelineRecommendation` reales de la base de
 * conocimiento (ver engines/guidelines/knowledge/). NO usa
 * engines/*​/legacyRules.ts ni legacyInterpretations.ts para decidir si
 * una recomendación aplica — la única fuente de verdad clínica es la
 * base de conocimiento citada.
 *
 * NO conectado todavía a Sentinel, Turning Points, Missing Information,
 * Review Opportunities ni a ningún componente de UI.
 *
 * Alcance de esta fase — 5 temas (ver SUPPORTED_RECOMMENDATION_IDS):
 *   macrólidos · antibióticos inhalados · erradicación de Pseudomonas ·
 *   corticoides inhalados · fisioterapia/aclaramiento de vía aérea
 *
 * Tres categorías de GuidelineCriterion en una GuidelineRecommendation,
 * con polaridad distinta (ver types/guideline.ts):
 * - `criteria` (indicación): cumplido = contribuye a `applies`.
 * - `exclusions` (contraindicación): la PRESENCIA confirmada bloquea; no
 *   poder confirmarla NO bloquea (se asume ausente salvo evidencia en
 *   contra, como en la práctica clínica habitual — por eso un
 *   `exclusions` en "missing" no tiene efecto en `status`).
 * - `prerequisites` (comprobación de seguridad exigida explícitamente por
 *   el texto antes de aplicar la recomendación, p. ej. "NTM infection
 *   should be excluded before initiating..."): sigue la MISMA polaridad
 *   que `criteria` (nunca la de `exclusions`) — cumplido no bloquea, no
 *   cumplido/con evidencia en contra bloquea, y sin datos fuerza
 *   `insufficient_data` en vez de ignorarse.
 *
 * Diseño de `status` (GuidelineMatchStatus):
 * - `does_not_apply` — algún GuidelineCriterion de `exclusions` se
 *   cumple (conflictingCriteria), o algún GuidelineCriterion de
 *   `criteria`/`prerequisites` está confirmado como NO cumplido
 *   (unmatchedCriteria). Las condiciones de `criteria`/`prerequisites` se
 *   combinan en AND: basta con que una esté confirmada como no cumplida
 *   para descartar la recomendación, aunque otras falten.
 * - `insufficient_data` — ningún criterio/prerrequisito confirmado como
 *   no cumplido, pero al menos uno de `criteria`/`prerequisites` no se
 *   puede evaluar por falta de datos estructurados. Nunca se asume que
 *   el paciente cumple.
 * - `possibly_applies` — todos los criterios/prerrequisitos evaluables se
 *   cumplen, pero al menos uno se apoya en evidencia de confianza baja:
 *   bien porque la propia guía no cuantifica el umbral (p. ej. "infección
 *   crónica" o "periodo prolongado sin detectarse" — ver notas de
 *   fidelidad en ers2025.ts/separ2018.ts), bien porque el dato del
 *   paciente es una inferencia (p. ej. ausencia de mención de una
 *   comorbilidad en el diagnóstico registrado, no una negación explícita).
 * - `applies` — o bien no hay `criteria` ni `prerequisites` que evaluar
 *   (recomendación sin población acotada, p. ej. ers-rec-pico1) y no hay
 *   conflicto, o bien todos se cumplen con evidencia de confianza alta.
 *
 * Cada evaluador de criterio documenta, en su propio comentario, de qué
 * campo(s) de ClinicalEvent/Patient procede el dato y qué parte del
 * GuidelineCriterion NO puede verificar el modelo de datos actual —
 * nunca se inventa un campo ni un umbral que la guía no declare.
 */
import { activeProblemCategories } from "@/domain/diagnosis";
import { isSevereExacerbation, selectExacerbations, selectMicrobiology } from "@/domain/selectors";
import { KNOWLEDGE_BASE_RECOMMENDATIONS, findCriterionById } from "./knowledge";
import type { DiagnosisCategory } from "@/domain/diagnosis";
import type { EvidenceItem } from "@/types/evidence";
import type { GuidelineMatch, GuidelineMatchStatus, GuidelineRecommendation } from "@/types/guideline";
import type { Patient } from "@/types/patient";

type CriterionOutcome = "matched" | "unmatched" | "missing";

interface CriterionEvaluation {
  criterionId: string;
  outcome: CriterionOutcome;
  /** Solo relevante cuando outcome === "matched": la guía no cuantifica el umbral, o el dato es una inferencia, no una confirmación explícita. */
  uncertain: boolean;
  evidence: EvidenceItem[];
}

type CriterionEvaluator = (patient: Patient, asOfDate: string) => CriterionEvaluation;

/* ============================================================================
   Helpers de datos (sin juicio clínico — solo lectura/filtrado de eventos)
   ========================================================================== */

function withinPriorYear(dateStr: string, asOfDate: string): boolean {
  const d = new Date(dateStr);
  const asOf = new Date(asOfDate);
  const oneYearBefore = new Date(asOf);
  oneYearBefore.setDate(oneYearBefore.getDate() - 365);
  return d <= asOf && d > oneYearBefore;
}

function upTo(asOfDate: string) {
  const asOf = new Date(asOfDate);
  return (dateStr: string) => new Date(dateStr) <= asOf;
}

function diagnosisText(patient: Patient): string {
  return `${patient.primaryDiagnosis} ${patient.secondaryDiagnoses}`.toLowerCase();
}

/* ============================================================================
   Evaluadores de GuidelineCriterion — uno por criterionId soportado
   ========================================================================== */

/**
 * ers-crit-high-risk-exacerbation: "⩾2 exacerbations in the prior year OR
 * ⩾1 severe exacerbation OR 1 exacerbation plus severe daily symptoms."
 * Las dos primeras ramas son evaluables con ExacerbationEvent. La tercera
 * ("severe daily symptoms") no tiene campo estructurado — con exactamente
 * 1 exacerbación no severa no se puede confirmar ni descartar esa rama.
 */
const evalHighRiskExacerbation: CriterionEvaluator = (patient, asOfDate) => {
  const criterionId = "ers-crit-high-risk-exacerbation";
  const exacs = selectExacerbations(patient.events).filter((e) => withinPriorYear(e.date, asOfDate));
  const evidence: EvidenceItem[] = exacs.map((e) => ({
    label: `Exacerbación ${e.severity}${e.hospitalization ? " con ingreso hospitalario" : ""}`,
    date: e.date,
  }));

  if (exacs.length >= 2) {
    return { criterionId, outcome: "matched", uncertain: false, evidence };
  }
  if (exacs.some(isSevereExacerbation)) {
    return { criterionId, outcome: "matched", uncertain: false, evidence };
  }
  if (exacs.length === 1) {
    return {
      criterionId,
      outcome: "missing",
      uncertain: false,
      evidence: [
        ...evidence,
        {
          label:
            'La guía también considera de alto riesgo "1 exacerbación + síntomas diarios graves"; el modelo de datos no registra gravedad de síntomas diarios, así que esa rama no se puede confirmar ni descartar.',
          date: null,
        },
      ],
    };
  }
  return {
    criterionId,
    outcome: "unmatched",
    uncertain: false,
    evidence: [{ label: "Sin exacerbaciones registradas en el año previo a la fecha de evaluación.", date: null }],
  };
};

/**
 * ers-crit-chronic-pseudomonas: "chronic infection with P. aeruginosa
 * despite standard care" — la propia guía no cuantifica "chronic" (ver
 * nota de fidelidad en ers2025.ts). Con un único aislamiento no hay
 * evidencia longitudinal; con ≥2 se marca como posible (uncertain), nunca
 * como confirmado, precisamente porque la guía no define el umbral.
 */
const evalChronicPseudomonas: CriterionEvaluator = (patient, asOfDate) => {
  const criterionId = "ers-crit-chronic-pseudomonas";
  const paIsolations = selectMicrobiology(patient.events)
    .filter((m) => upTo(asOfDate)(m.date))
    .filter((m) => /pseudomonas aeruginosa/i.test(m.organism));
  const evidence: EvidenceItem[] = paIsolations.map((m) => ({ label: `Cultivo positivo: ${m.organism}`, date: m.date }));

  if (paIsolations.length === 0) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: [{ label: "Ningún cultivo con Pseudomonas aeruginosa registrado.", date: null }],
    };
  }
  if (paIsolations.length === 1) {
    return {
      criterionId,
      outcome: "missing",
      uncertain: false,
      evidence: [
        ...evidence,
        { label: 'Un único aislamiento registrado; sin evidencia longitudinal suficiente para "infección crónica".', date: null },
      ],
    };
  }
  return {
    criterionId,
    outcome: "matched",
    uncertain: true,
    evidence: [
      ...evidence,
      {
        label: `${paIsolations.length} aislamientos de P. aeruginosa en el historial; la guía no cuantifica el umbral de "crónica" (ver nota de fidelidad), así que esta evaluación es orientativa, no una confirmación exacta.`,
        date: null,
      },
    ],
  };
};

/**
 * ers-crit-ntm-excluded-before-macrolide (PRERREQUISITO de seguridad para
 * macrólidos, no exclusión): el criterio, en su propio sentido literal,
 * es "la infección por NTM ha sido excluida antes de iniciar macrólidos".
 * Por eso su polaridad sigue la misma convención que un `criteria` normal
 * (nunca la de `exclusions`, que está invertida): "matched" = prerrequisito
 * CUMPLIDO (NTM excluida, no bloquea); "unmatched" = prerrequisito NO
 * cumplido (hay evidencia de NTM, o no se ha excluido — bloquea igual que
 * una exclusión); "missing" = no consta que se haya hecho la comprobación
 * (fuerza insufficient_data, nunca se asume cumplido). Con el modelo de
 * datos actual, "matched" no es alcanzable: no existe un evento
 * estructurado de "cultivo específico de NTM negativo", solo cultivos de
 * esputo estándar que no descartan NTM de forma fiable (requiere medios
 * de cultivo específicos) — así que la ausencia de NTM en los cultivos
 * disponibles se queda en "missing", nunca sube a "matched".
 */
const evalNtmExcluded: CriterionEvaluator = (patient, asOfDate) => {
  const criterionId = "ers-crit-ntm-excluded-before-macrolide";
  const ntm = selectMicrobiology(patient.events)
    .filter((m) => upTo(asOfDate)(m.date))
    .filter((m) => /mycobacterium/i.test(m.organism) && !/tuberculosis/i.test(m.organism));

  if (ntm.length > 0) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: ntm.map((m) => ({ label: `Cultivo positivo: ${m.organism} — NTM no excluida.`, date: m.date })),
    };
  }
  return {
    criterionId,
    outcome: "missing",
    uncertain: false,
    evidence: [
      {
        label:
          "No consta cultivo positivo a micobacterias no tuberculosas, pero un cultivo de esputo estándar no descarta NTM de forma fiable (requiere medios específicos) — no se puede confirmar que la exclusión de NTM se haya realizado.",
        date: null,
      },
    ],
  };
};

/**
 * ers-crit-new-pseudomonas-isolation: "first time isolated, OR a further
 * isolation following a prolonged period during which P. aeruginosa was
 * not detected" (la guía no cuantifica "prolonged"). Se compara cada
 * aislamiento de PA con el cultivo inmediatamente anterior (de cualquier
 * organismo): sin cultivos → missing; nunca aislada → unmatched; primer
 * aislamiento de la historia → matched; reaislamiento tras un cultivo
 * negativo intermedio → matched pero uncertain (el hueco es real, pero no
 * hay forma de confirmar que cuenta como "prolongado"); positividad
 * continuada sin cultivo negativo intermedio → unmatched (no es "nuevo").
 */
const evalNewPseudomonasIsolation: CriterionEvaluator = (patient, asOfDate) => {
  const criterionId = "ers-crit-new-pseudomonas-isolation";
  const micro = selectMicrobiology(patient.events).filter((m) => upTo(asOfDate)(m.date));
  if (micro.length === 0) {
    return { criterionId, outcome: "missing", uncertain: false, evidence: [{ label: "No hay cultivos microbiológicos registrados.", date: null }] };
  }

  const paEntries = micro.map((m, index) => ({ m, index })).filter(({ m }) => /pseudomonas aeruginosa/i.test(m.organism));
  if (paEntries.length === 0) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: [{ label: "Ningún cultivo con Pseudomonas aeruginosa registrado.", date: null }],
    };
  }

  const latestPA = paEntries[paEntries.length - 1];
  if (paEntries.length === 1) {
    return {
      criterionId,
      outcome: "matched",
      uncertain: false,
      evidence: [{ label: "Primer cultivo positivo para Pseudomonas aeruginosa registrado en el historial.", date: latestPA.m.date }],
    };
  }

  const priorCulture = micro[latestPA.index - 1];
  const gapObserved = priorCulture && !/pseudomonas aeruginosa/i.test(priorCulture.organism);
  if (gapObserved) {
    return {
      criterionId,
      outcome: "matched",
      uncertain: true,
      evidence: [
        { label: `Cultivo previo sin Pseudomonas aeruginosa (${priorCulture.organism}).`, date: priorCulture.date },
        { label: "Nuevo cultivo positivo para Pseudomonas aeruginosa tras un cultivo negativo para el organismo.", date: latestPA.m.date },
        { label: 'La guía no cuantifica qué periodo sin detectarse cuenta como "prolongado"; se marca como posible, no confirmado.', date: null },
      ],
    };
  }
  return {
    criterionId,
    outcome: "unmatched",
    uncertain: false,
    evidence: [
      { label: "Pseudomonas aeruginosa persiste desde el cultivo anterior sin un cultivo negativo intermedio: infección continuada, no un nuevo aislamiento.", date: latestPA.m.date },
    ],
  };
};

/**
 * ers-crit-no-asthma-copd: "do not have coexisting COPD or asthma". Se
 * busca "asma"/"epoc" en Patient.primaryDiagnosis/secondaryDiagnoses (los
 * únicos campos de diagnóstico del modelo). Si aparecen, confirmado
 * (unmatched). Si no aparecen, es ausencia de mención, no una negación
 * explícita — se marca matched pero uncertain.
 */
const evalNoAsthmaCopd: CriterionEvaluator = (patient) => {
  const criterionId = "ers-crit-no-asthma-copd";
  const text = diagnosisText(patient);
  if (/asma|epoc/.test(text)) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: [{ label: `Diagnóstico registrado: "${patient.primaryDiagnosis}"${patient.secondaryDiagnoses ? ` / "${patient.secondaryDiagnoses}"` : ""} — menciona asma o EPOC.`, date: null }],
    };
  }
  return {
    criterionId,
    outcome: "matched",
    uncertain: true,
    evidence: [
      {
        label: `Diagnóstico registrado ("${patient.primaryDiagnosis}"${patient.secondaryDiagnoses ? `, "${patient.secondaryDiagnoses}"` : ", sin diagnósticos secundarios"}) no menciona asma ni EPOC — ausencia de mención, no una exclusión explícita confirmada.`,
        date: null,
      },
    ],
  };
};

/**
 * ers-crit-airway-clearance-failed: "airway clearance has failed to
 * control symptoms". El modelo de datos no tiene un campo estructurado de
 * eficacia/fracaso de tratamiento — siempre "missing", documentado.
 */
const evalAirwayClearanceFailed: CriterionEvaluator = () => ({
  criterionId: "ers-crit-airway-clearance-failed",
  outcome: "missing",
  uncertain: false,
  evidence: [
    {
      label: "El modelo de datos no registra si el aclaramiento de la vía aérea ha fracasado en controlar los síntomas (no existe un campo estructurado de eficacia de tratamiento).",
      date: null,
    },
  ],
});

/**
 * separ-crit-macrolidos-poblacion: "estabilidad clínica... con al menos 2
 * agudizaciones anuales a pesar del tratamiento de base correcto". La
 * parte numérica (≥2 agudizaciones/año) es evaluable; "estabilidad
 * clínica" y "tratamiento de base correcto" no tienen campo estructurado,
 * así que con ≥2 agudizaciones el resultado es "missing", no "matched".
 */
const evalSeparMacrolidosPoblacion: CriterionEvaluator = (patient, asOfDate) => {
  const criterionId = "separ-crit-macrolidos-poblacion";
  const exacs = selectExacerbations(patient.events).filter((e) => withinPriorYear(e.date, asOfDate));
  const evidence: EvidenceItem[] = exacs.map((e) => ({ label: `Exacerbación ${e.severity}`, date: e.date }));

  if (exacs.length < 2) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: evidence.length ? evidence : [{ label: "Sin exacerbaciones registradas en el año previo a la fecha de evaluación.", date: null }],
    };
  }
  return {
    criterionId,
    outcome: "missing",
    uncertain: false,
    evidence: [
      ...evidence,
      { label: "El criterio SEPAR también exige estabilidad clínica y tratamiento de base correcto ya instaurado; el modelo de datos no tiene campos estructurados para ninguno de los dos.", date: null },
    ],
  };
};

/**
 * separ-crit-primoinfeccion-pa: "Primer cultivo positivo por P.
 * aeruginosa (primoinfección)". A diferencia del criterio ERS equivalente,
 * SEPAR no matiza un reaislamiento tras un hueco — cualquier aislamiento
 * posterior al primero deja de ser primoinfección, sin ambigüedad.
 */
const evalSeparPrimoinfeccionPa: CriterionEvaluator = (patient, asOfDate) => {
  const criterionId = "separ-crit-primoinfeccion-pa";
  const micro = selectMicrobiology(patient.events).filter((m) => upTo(asOfDate)(m.date));
  if (micro.length === 0) {
    return { criterionId, outcome: "missing", uncertain: false, evidence: [{ label: "No hay cultivos microbiológicos registrados.", date: null }] };
  }
  const paIsolations = micro.filter((m) => /pseudomonas aeruginosa/i.test(m.organism));
  if (paIsolations.length === 0) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: [{ label: "Ningún cultivo con Pseudomonas aeruginosa registrado.", date: null }],
    };
  }
  if (paIsolations.length === 1) {
    return {
      criterionId,
      outcome: "matched",
      uncertain: false,
      evidence: [{ label: "Primer y único cultivo positivo para Pseudomonas aeruginosa (primoinfección).", date: paIsolations[0].date }],
    };
  }
  return {
    criterionId,
    outcome: "unmatched",
    uncertain: false,
    evidence: [{ label: `${paIsolations.length} cultivos con Pseudomonas aeruginosa registrados: ya no es una primoinfección.`, date: paIsolations[paIsolations.length - 1].date }],
  };
};

/**
 * separ-crit-corticoides-poblacion: "HRB, asma o broncorrea importante no
 * controlable con otros tratamientos" (OR de 3 ramas). Solo "asma" es
 * verificable con los campos de diagnóstico; HRB y broncorrea no tienen
 * campo estructurado — sin mención de asma, el resultado es "missing"
 * (no se puede descartar el resto de ramas).
 */
const evalSeparCorticoidesPoblacion: CriterionEvaluator = (patient) => {
  const criterionId = "separ-crit-corticoides-poblacion";
  const text = diagnosisText(patient);
  if (/asma/.test(text)) {
    return {
      criterionId,
      outcome: "matched",
      uncertain: false,
      evidence: [{ label: `Diagnóstico registrado menciona asma: "${patient.primaryDiagnosis}"${patient.secondaryDiagnoses ? `, "${patient.secondaryDiagnoses}"` : ""}.`, date: null }],
    };
  }
  return {
    criterionId,
    outcome: "missing",
    uncertain: false,
    evidence: [
      {
        label: "El diagnóstico registrado no menciona asma, y el modelo de datos no tiene campos estructurados para hiperreactividad bronquial (HRB) ni broncorrea — no se pueden confirmar ni descartar esas dos ramas del criterio.",
        date: null,
      },
    ],
  };
};

/**
 * separ-crit-drenaje-secreciones-poblacion: "pacientes adultos con BQ
 * clínicamente estables con tos productiva". Solo "adultos" es evaluable
 * (Patient.age); "estabilidad clínica" y "tos productiva" no tienen campo
 * estructurado. Con edad <18 el criterio queda confirmado como no
 * cumplido (basta un factor para descartar); en cualquier otro caso,
 * "missing".
 */
const evalSeparDrenajeSecrecionesPoblacion: CriterionEvaluator = (patient) => {
  const criterionId = "separ-crit-drenaje-secreciones-poblacion";
  if (patient.age != null && patient.age < 18) {
    return {
      criterionId,
      outcome: "unmatched",
      uncertain: false,
      evidence: [{ label: `Edad registrada: ${patient.age} años — la recomendación se refiere a pacientes adultos.`, date: null }],
    };
  }
  return {
    criterionId,
    outcome: "missing",
    uncertain: false,
    evidence: [
      { label: patient.age != null ? `Edad registrada: ${patient.age} años (cumple "adulto").` : "Edad no registrada.", date: null },
      { label: 'El modelo de datos no tiene campos estructurados para "estabilidad clínica" ni "tos productiva" — no se pueden confirmar.', date: null },
    ],
  };
};

const CRITERION_EVALUATORS: Record<string, CriterionEvaluator> = {
  "ers-crit-high-risk-exacerbation": evalHighRiskExacerbation,
  "ers-crit-chronic-pseudomonas": evalChronicPseudomonas,
  "ers-crit-ntm-excluded-before-macrolide": evalNtmExcluded,
  "ers-crit-new-pseudomonas-isolation": evalNewPseudomonasIsolation,
  "ers-crit-no-asthma-copd": evalNoAsthmaCopd,
  "ers-crit-airway-clearance-failed": evalAirwayClearanceFailed,
  "separ-crit-macrolidos-poblacion": evalSeparMacrolidosPoblacion,
  "separ-crit-primoinfeccion-pa": evalSeparPrimoinfeccionPa,
  "separ-crit-corticoides-poblacion": evalSeparCorticoidesPoblacion,
  "separ-crit-drenaje-secreciones-poblacion": evalSeparDrenajeSecrecionesPoblacion,
};

/**
 * Recomendaciones soportadas en esta fase, agrupadas por los 5 temas
 * pedidos. `separ-rec-inhalados-vs-sistemicos` se deja fuera
 * deliberadamente: su `criteria` quedó vacío a propósito en la auditoría
 * (no se quiso inventar un vínculo a los criterios de infección crónica
 * de los que depende contextualmente — ver separ2018.ts), y este motor
 * tampoco inventa esa vinculación en tiempo de evaluación.
 */
const SUPPORTED_RECOMMENDATION_IDS: Record<string, readonly string[]> = {
  macrólidos: ["ers-rec-pico4", "separ-rec-macrolidos"],
  "antibióticos inhalados": ["ers-rec-pico3-with-pa", "ers-rec-pico3-without-pa"],
  "erradicación de Pseudomonas": ["ers-rec-pico6", "separ-rec-erradicacion-primoinfeccion"],
  "corticoides inhalados": ["ers-rec-pico7", "separ-rec-corticoides-no-rutina"],
  "fisioterapia/aclaramiento de vía aérea": ["ers-rec-pico1", "ers-rec-pico2-mucoactive", "separ-rec-drenaje-secreciones"],
};

export const SUPPORTED_TOPICS = Object.keys(SUPPORTED_RECOMMENDATION_IDS);

/**
 * Categorías de diagnóstico (domain/diagnosis.ts) con una base de
 * conocimiento real conectada a GuidelineMatch. Hoy solo bronquiectasias;
 * añadir una categoría aquí (junto con sus GuidelineCriterion/
 * GuidelineRecommendation y sus evaluadores) es el único cambio que
 * debería hacer falta para dar cobertura a un problema clínico nuevo —
 * ver activeProblemCategories() en domain/diagnosis.ts, que es lo que se
 * compara contra esta lista en vez de leer `primaryDiagnosis` a pelo.
 */
export const SUPPORTED_DIAGNOSIS_CATEGORIES: DiagnosisCategory[] = ["Bronquiectasias"];

const SUPPORTED_RECOMMENDATION_ID_SET = new Set(Object.values(SUPPORTED_RECOMMENDATION_IDS).flat());

function evaluateCriterion(criterionId: string, patient: Patient, asOfDate: string): CriterionEvaluation {
  const evaluator = CRITERION_EVALUATORS[criterionId];
  if (!evaluator) {
    throw new Error(`GuidelineMatch: no hay evaluador implementado para el criterio "${criterionId}" (fuera del alcance de esta fase).`);
  }
  if (!findCriterionById(criterionId)) {
    throw new Error(`GuidelineMatch: criterionId "${criterionId}" no existe en la base de conocimiento.`);
  }
  return evaluator(patient, asOfDate);
}

/**
 * `criteria` y `prerequisites` comparten polaridad (cumplido no bloquea,
 * no cumplido bloquea, sin datos fuerza insufficient_data) y por eso se
 * combinan aquí; `exclusions` tiene la polaridad invertida (solo bloquea
 * si SE CONFIRMA la condición, y "missing" no tiene efecto) y se evalúa
 * aparte, antes.
 */
function deriveStatus(
  criteriaResults: CriterionEvaluation[],
  exclusionResults: CriterionEvaluation[],
  prerequisiteResults: CriterionEvaluation[],
): GuidelineMatchStatus {
  if (exclusionResults.some((r) => r.outcome === "matched")) return "does_not_apply";

  const gated = [...criteriaResults, ...prerequisiteResults];
  if (gated.some((r) => r.outcome === "unmatched")) return "does_not_apply";
  if (gated.some((r) => r.outcome === "missing")) return "insufficient_data";
  if (gated.some((r) => r.outcome === "matched" && r.uncertain)) return "possibly_applies";
  return "applies";
}

/** Evalúa una única GuidelineRecommendation contra un paciente, a fecha `asOfDate` (ISO). */
export function matchPatientToRecommendation(patient: Patient, recommendation: GuidelineRecommendation, asOfDate: string): GuidelineMatch {
  const criteriaResults = recommendation.criteria.map((id) => evaluateCriterion(id, patient, asOfDate));
  const exclusionResults = recommendation.exclusions.map((id) => evaluateCriterion(id, patient, asOfDate));
  const prerequisiteResults = recommendation.prerequisites.map((id) => evaluateCriterion(id, patient, asOfDate));

  const status = deriveStatus(criteriaResults, exclusionResults, prerequisiteResults);
  const gated = [...criteriaResults, ...prerequisiteResults];
  const patientEvidence = [...criteriaResults, ...exclusionResults, ...prerequisiteResults].flatMap((r) =>
    r.evidence.map((e) => ({ ...e, criterionId: r.criterionId })),
  );

  return {
    patientId: patient.id,
    recommendationId: recommendation.recommendationId,
    status,
    matchedCriteria: gated.filter((r) => r.outcome === "matched").map((r) => r.criterionId),
    unmatchedCriteria: gated.filter((r) => r.outcome === "unmatched").map((r) => r.criterionId),
    missingCriteria: gated.filter((r) => r.outcome === "missing").map((r) => r.criterionId),
    conflictingCriteria: exclusionResults.filter((r) => r.outcome === "matched").map((r) => r.criterionId),
    patientEvidence,
    guidelineCitation: {
      guidelineId: recommendation.guidelineId,
      section: recommendation.section,
      page: recommendation.page,
      sourceText: recommendation.sourceText,
    },
  };
}

/**
 * Evalúa todas las recomendaciones soportadas (ver SUPPORTED_TOPICS)
 * contra un paciente, a fecha `asOfDate` (ISO). ERS y SEPAR se evalúan
 * por separado — cada GuidelineMatch cita una única guía (su propio
 * guidelineCitation.guidelineId), nunca una combinación de ambas.
 *
 * Devuelve `[]` si ninguno de los problemas clínicos ACTIVOS del paciente
 * (diagnóstico principal o secundarios — ver activeProblemCategories())
 * está cubierto por SUPPORTED_DIAGNOSIS_CATEGORIES. No mira solo
 * `primaryDiagnosis`: un paciente puede tener bronquiectasias como
 * diagnóstico secundario (p. ej. junto a fibrosis pulmonar idiopática
 * como principal) y sigue teniendo derecho a estas recomendaciones.
 */
export function matchPatientToGuidelines(patient: Patient, asOfDate: string): GuidelineMatch[] {
  const hasSupportedProblem = activeProblemCategories(patient).some((c) => SUPPORTED_DIAGNOSIS_CATEGORIES.includes(c));
  if (!hasSupportedProblem) return [];
  return KNOWLEDGE_BASE_RECOMMENDATIONS.filter((r) => SUPPORTED_RECOMMENDATION_ID_SET.has(r.recommendationId)).map((r) =>
    matchPatientToRecommendation(patient, r, asOfDate),
  );
}
