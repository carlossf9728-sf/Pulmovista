import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { buildDemoPatients } from "@/data/demoPatients";
import { computeSentinelFindings, patientStatus } from "@/engines/sentinel";
import { detectObjectiveSentinelSignals } from "@/engines/sentinel/objectiveDetectors";
import { buildGuidelineInterpretations } from "@/engines/sentinel/guidelineInterpretation";
import type { ExacerbationEvent, MicrobiologyEvent, PulmonaryFunctionEvent, RespiratorySupportEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";
import type { ObjectiveSentinelSignal } from "@/types/sentinel";

function basePatient(events: Patient["events"], extra: Partial<Patient> = {}): Patient {
  return {
    id: "p1",
    code: "PV-TEST-0004",
    sex: "Mujer",
    age: 58,
    primaryDiagnosis: "Bronquiectasias",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
    ...extra,
  };
}

/** Fecha ISO relativa a "hoy", para caer siempre dentro de la ventana de 365 días que usa matchPatientToGuidelines (evita fechas literales que dejarían de estar en ventana con el paso del tiempo). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ============================================================================
   Capa objetiva (engines/sentinel/objectiveDetectors.ts) — determinista,
   con fechas históricas literales: no depende de la fecha de ejecución.
   ========================================================================== */
describe("detectObjectiveSentinelSignals — capa objetiva, sin interpretación clínica", () => {
  it("fev1-trend-decline: no dispara con menos de 3 determinaciones", () => {
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-06-01", { FEV1Percent: 70 }),
    ]);
    expect(detectObjectiveSentinelSignals(patient).find((s) => s.signalId === "fev1-trend-decline")).toBeUndefined();
  });

  it("fev1-trend-decline: dispara con 3 determinaciones consecutivas descendentes, sin interpretación ni confianza adjunta", () => {
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-06-01", { FEV1Percent: 72 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 65 }),
    ]);
    const signal = detectObjectiveSentinelSignals(patient).find((s) => s.signalId === "fev1-trend-decline");
    expect(signal).toBeDefined();
    expect(signal?.datum).toBe("FEV1: 80% → 72% → 65% (01/01/2023 – 01/01/2024).");
    // El tipo ObjectiveSentinelSignal no tiene campo de interpretación, recomendación ni confianza.
    expect(signal).not.toHaveProperty("interpretacion");
    expect(signal).not.toHaveProperty("confidence");
  });

  it("exacerbation-rate-increase: dispara cuando el conteo anual aumenta respecto al año previo", () => {
    const patient = basePatient([
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2023-07-01", { severity: "Leve", hospitalization: false }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-04-01", { severity: "Leve", hospitalization: false }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-09-01", { severity: "Leve", hospitalization: false }),
    ]);
    const signal = detectObjectiveSentinelSignals(patient).find((s) => s.signalId === "exacerbation-rate-increase");
    expect(signal?.datum).toBe("Exacerbaciones: 1 (2023) → 2 (2024).");
  });

  it("persistent-organism: dispara UNA señal por organismo repetido (no las combina)", () => {
    const patient = basePatient([
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-01-01", { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-06-01", { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2023-09-01", { sampleType: "Esputo", organism: "Haemophilus influenzae", sensitivity: [], resistance: [] }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", { sampleType: "Esputo", organism: "Haemophilus influenzae", sensitivity: [], resistance: [] }),
    ]);
    const persistent = detectObjectiveSentinelSignals(patient).filter((s) => s.signalId === "persistent-organism");
    expect(persistent).toHaveLength(2);
    expect(persistent.map((s) => s.subject).sort()).toEqual(["Haemophilus influenzae", "Pseudomonas aeruginosa"]);
  });

  it("new-respiratory-support: dispara con el primer evento de soporte respiratorio", () => {
    const patient = basePatient([mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2024-01-01", { drug: "oxígeno domiciliario" })]);
    const signal = detectObjectiveSentinelSignals(patient).find((s) => s.signalId === "new-respiratory-support");
    expect(signal?.datum).toContain("Oxígeno domiciliario");
  });
});

/* ============================================================================
   Capa de interpretación respaldada por guía
   (engines/sentinel/guidelineInterpretation.ts) — usa fechas relativas a
   "hoy" (daysAgo) porque matchPatientToGuidelines evalúa una ventana móvil
   de 365 días. No modifica match.ts: solo vincula señal -> criterios ya
   citados -> GuidelineMatch ya calculado.
   ========================================================================== */
describe("buildGuidelineInterpretations — vínculo señal objetiva -> GuidelineMatch", () => {
  const fev1Signal: ObjectiveSentinelSignal = {
    signalId: "fev1-trend-decline",
    label: "Tendencia descendente de FEV1",
    datum: "FEV1: 80% → 72% → 65%.",
    evidence: [],
  };

  const respSupportSignal: ObjectiveSentinelSignal = {
    signalId: "new-respiratory-support",
    label: "Inicio de soporte respiratorio",
    datum: "Inicio de oxígeno domiciliario.",
    evidence: [],
  };

  it("fev1-trend-decline y new-respiratory-support nunca tienen soporte de guía (fuera del alcance de los 5 temas actuales)", () => {
    const patient = basePatient([
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, daysAgo(30), { severity: "Grave", hospitalization: true }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, daysAgo(200), { severity: "Grave", hospitalization: true }),
    ]);
    expect(buildGuidelineInterpretations(patient, fev1Signal)).toEqual([]);
    expect(buildGuidelineInterpretations(patient, respSupportSignal)).toEqual([]);
  });

  it("exacerbation-rate-increase: con ≥2 exacerbaciones en el año previo, hay interpretación respaldada con status 'Cumple'", () => {
    const signal: ObjectiveSentinelSignal = {
      signalId: "exacerbation-rate-increase",
      label: "Aumento de la tasa de exacerbaciones",
      datum: "Exacerbaciones: 1 → 2.",
      evidence: [],
    };
    const patient = basePatient([
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, daysAgo(30), { severity: "Leve", hospitalization: false }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, daysAgo(200), { severity: "Leve", hospitalization: false }),
    ]);
    const interpretations = buildGuidelineInterpretations(patient, signal);
    expect(interpretations.length).toBeGreaterThan(0);
    // Todas las interpretaciones proceden de guías reales, con cita completa.
    for (const gi of interpretations) {
      expect(["ers-bronchiectasis-2025", "separ-bronchiectasis-2018"]).toContain(gi.guidelineId);
      expect(gi.sourceText.length).toBeGreaterThan(0);
    }
    expect(interpretations.some((gi) => gi.recommendationId === "ers-rec-pico3-without-pa" && gi.statusLabel === "Cumple")).toBe(true);
  });

  it("persistent-organism: Pseudomonas aeruginosa tiene soporte de guía; otro organismo no", () => {
    const paSignal: ObjectiveSentinelSignal = {
      signalId: "persistent-organism",
      label: "Aislamiento microbiológico persistente",
      datum: "2 aislamientos de Pseudomonas aeruginosa.",
      subject: "Pseudomonas aeruginosa",
      evidence: [],
    };
    const otherSignal: ObjectiveSentinelSignal = {
      signalId: "persistent-organism",
      label: "Aislamiento microbiológico persistente",
      datum: "2 aislamientos de Haemophilus influenzae.",
      subject: "Haemophilus influenzae",
      evidence: [],
    };
    const patient = basePatient([
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, daysAgo(300), { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] }),
      mkEvent<MicrobiologyEvent>("p1", CLINICAL_EVENT_TYPES.MICROBIOLOGY, daysAgo(30), { sampleType: "Esputo", organism: "Pseudomonas aeruginosa", sensitivity: [], resistance: [] }),
    ]);
    expect(buildGuidelineInterpretations(patient, paSignal).length).toBeGreaterThan(0);
    expect(buildGuidelineInterpretations(patient, otherSignal)).toEqual([]);
  });

  it("la cadena del botón '¿Por qué?' sigue exactamente: dato → criterio → evaluación → recomendación → guía → sección → página → fragmento", () => {
    const signal: ObjectiveSentinelSignal = {
      signalId: "exacerbation-rate-increase",
      label: "Aumento de la tasa de exacerbaciones",
      datum: "Exacerbaciones: 1 → 2.",
      evidence: [],
    };
    const patient = basePatient([
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, daysAgo(30), { severity: "Leve", hospitalization: false }),
      mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, daysAgo(200), { severity: "Leve", hospitalization: false }),
    ]);
    const [interpretation] = buildGuidelineInterpretations(patient, signal);
    expect(interpretation.explanation.source.kind).toBe("guideline");
    expect(interpretation.explanation.sections.map((s) => s.label)).toEqual([
      "Dato del paciente",
      "Criterio de la guía",
      "Evaluación",
      "Recomendación",
      "Guía",
      "Sección",
      "Página",
      "Fragmento fuente",
    ]);
    // El término técnico "GuidelineMatch" nunca aparece en ningún texto mostrable.
    const allText = JSON.stringify(interpretation.explanation);
    expect(allText).not.toContain("GuidelineMatch");
  });
});

/* ============================================================================
   Integración completa (computeSentinelFindings / patientStatus) sobre los
   pacientes sintéticos existentes (data/demoPatients.ts).
   ========================================================================== */
describe("computeSentinelFindings / patientStatus — pacientes sintéticos existentes", () => {
  const [p1, p2, p3] = buildDemoPatients();

  it("paciente sin eventos: 'sin_tendencia' (nunca 'estable' por ausencia de hallazgos, sin historia que comparar)", () => {
    const empty = basePatient([]);
    expect(computeSentinelFindings(empty)).toEqual([]);
    expect(patientStatus(empty)).toBe("sin_tendencia");
  });

  it("p1 (bronquiectasias, PA persistente, exacerbaciones al alza): 'deterioro', con interpretación 'Cumple' respaldada por ERS", () => {
    const findings = computeSentinelFindings(p1);
    expect(patientStatus(p1)).toBe("deterioro");

    const exacFinding = findings.find((f) => f.signalId === "exacerbation-rate-increase");
    expect(exacFinding?.guidelineInterpretations.some((gi) => gi.statusLabel === "Cumple")).toBe(true);
    expect(exacFinding?.noSupportMessage).toBeNull();

    // fev1-trend-decline sigue sin soporte de guía: no se inventa una interpretación.
    const fev1Finding = findings.find((f) => f.signalId === "fev1-trend-decline");
    expect(fev1Finding?.guidelineInterpretations).toEqual([]);
    expect(fev1Finding?.noSupportMessage).toBe("Sin interpretación basada en guía disponible");
  });

  it("p2 (EPOC) y p3 (fibrosis pulmonar): 'revisión' — hay hallazgos objetivos, pero ninguno con soporte de guía (la base de conocimiento solo cubre bronquiectasias)", () => {
    expect(patientStatus(p2)).toBe("revision");
    expect(patientStatus(p3)).toBe("revision");
    for (const finding of [...computeSentinelFindings(p2), ...computeSentinelFindings(p3)]) {
      expect(finding.guidelineInterpretations).toEqual([]);
      expect(finding.noSupportMessage).not.toBeNull();
    }
  });

  it("ERS y SEPAR nunca se fusionan en una misma interpretación", () => {
    const findings = computeSentinelFindings(p1);
    for (const f of findings) {
      for (const gi of f.guidelineInterpretations) {
        expect(["ers-bronchiectasis-2025", "separ-bronchiectasis-2018"]).toContain(gi.guidelineId);
      }
    }
  });

  /**
   * Capa de interpretación corta de Argos (engines/sentinel/interpretation.ts) — separada tanto del
   * dato objetivo (`datum`) como de `guidelineInterpretations`: nunca lleva kindLabel "guideline", y su
   * "¿Por qué?" deja explícito que es una heurística interna, no una recomendación de guía.
   */
  it("cada SentinelFinding lleva una interpretación corta propia, con su '¿Por qué?' marcado como heurística interna (no guía)", () => {
    const findings = computeSentinelFindings(p1);
    const exacFinding = findings.find((f) => f.signalId === "exacerbation-rate-increase");
    expect(exacFinding?.interpretation).toBe("Aumento longitudinal de exacerbaciones. Requiere revisión.");
    expect(exacFinding?.explanation.kindLabel).toBe("heurística experimental");
    expect(exacFinding?.explanation.source).toMatchObject({ kind: "legacy_heuristic" });
    const explanationText = exacFinding?.explanation.sections.map((s) => s.text).join(" ") ?? "";
    expect(explanationText).toContain("regla longitudinal interna");
    expect(explanationText).toMatch(/no.*recomendación de guía/i);
    expect(explanationText).toMatch(/no equivale a una conclusión clínica definitiva/i);

    // fev1-trend-decline no tiene soporte de guía, pero SÍ tiene su propia interpretación corta de Argos.
    const fev1Finding = findings.find((f) => f.signalId === "fev1-trend-decline");
    expect(fev1Finding?.interpretation).toBe("Descenso longitudinal objetivo de FEV1. Requiere revisión.");
    expect(fev1Finding?.explanation.kindLabel).toBe("heurística experimental");
  });
});

/* ==========================================================================
   patientStatus — semántica de "estable" (regla: "no detectar deterioro" !=
   "paciente estable"). "estable" solo cuando hay historia longitudinal
   suficiente para comparar Y no hay ningún hallazgo relevante; sin esa
   historia, el estado es "sin_tendencia", nunca "estable" por defecto.
   ========================================================================== */
describe("patientStatus — 'estable' nunca es el valor por defecto ante la ausencia de hallazgos", () => {
  it("paciente con 0 eventos: 'sin_tendencia'", () => {
    expect(patientStatus(basePatient([]))).toBe("sin_tendencia");
  });

  it("paciente con una única fecha clínica: 'sin_tendencia' — no hay nada con qué comparar, aunque no se detecte ningún hallazgo", () => {
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 78 }),
    ]);
    expect(computeSentinelFindings(patient)).toEqual([]);
    expect(patientStatus(patient)).toBe("sin_tendencia");
  });

  it("paciente con 2+ fechas pero SIN datos suficientes para ningún detector de tendencia (p. ej. solo consultas, sin PFR/exacerbaciones/microbiología): 'sin_tendencia', no 'estable'", () => {
    const patient = basePatient([
      mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2023-06-01", {}, { rawText: "Consulta de revisión. Estable." }),
      mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { rawText: "Consulta de revisión. Estable." }),
    ]);
    expect(computeSentinelFindings(patient)).toEqual([]);
    expect(patientStatus(patient)).toBe("sin_tendencia");
  });

  it("paciente con 2+ fechas y datos suficientes para un detector de tendencia, sin cambios relevantes: 'estable'", () => {
    // 3 PFT (mínimo del detector fev1-trend-decline) sin descenso — hay historia suficiente para comparar y no hay nada que señalar.
    const patient = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-07-01", { FEV1Percent: 82 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 81 }),
    ]);
    expect(computeSentinelFindings(patient)).toEqual([]);
    expect(patientStatus(patient)).toBe("estable");
  });

  it("paciente con empeoramiento detectado: sigue siendo 'deterioro'/'revisión' — el chequeo de historia suficiente nunca oculta un hallazgo real", () => {
    // p1 (data/demoPatients.ts) tiene exacerbaciones al alza con soporte de guía "Cumple".
    const [p1] = buildDemoPatients();
    expect(patientStatus(p1)).toBe("deterioro");

    // Un caso más simple: 3 PFT en descenso consecutivo (fev1-trend-decline, sin soporte de guía en el alcance actual) → 'revisión', nunca 'sin_tendencia' ni 'estable'.
    const declining = basePatient([
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-01-01", { FEV1Percent: 80 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2023-07-01", { FEV1Percent: 72 }),
      mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 65 }),
    ]);
    expect(patientStatus(declining)).toBe("revision");
  });

  it("paciente con información insuficiente (varias consultas, ningún dato objetivo de ningún detector): 'sin_tendencia', igual que con una sola fecha — más fechas no equivalen a suficiente información", () => {
    const patient = basePatient([
      mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2022-01-01", {}, { rawText: "Primera valoración." }),
      mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2022-06-01", {}, { rawText: "Revisión." }),
      mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2023-01-01", {}, { rawText: "Revisión." }),
    ]);
    expect(patientStatus(patient)).toBe("sin_tendencia");
  });
});
