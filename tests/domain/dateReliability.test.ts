/**
 * Un evento con datePrecision "unresolved" (ver types/clinicalEvent.ts y
 * engines/extraction/resolveDates.ts) conserva `date` solo por
 * compatibilidad técnica — nunca debe comportarse como una fecha
 * clínica real. Este archivo prueba, con escenarios donde una fecha NO
 * fiable produciría una tendencia FALSA si se usara sin filtrar, que
 * cada motor longitudinal la excluye: PFR (Sentinel/Turning Points),
 * microbiología longitudinal, exacerbaciones por año, comparaciones
 * entre visitas (LongitudinalEngine) y comparePft. El evento en sí sigue
 * existiendo (visible en Cronología/pestañas vía los selectores SIN
 * filtrar) — solo se excluye de la aritmética de tendencia.
 */
import { describe, expect, it } from "vitest";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import { comparePft } from "@/domain/pft";
import { microbiologyObjectiveChange } from "@/domain/microbiologyTrend";
import { computeChangesSinceLastVisit, detectContradictions } from "@/engines/longitudinal";
import { detectObjectiveSentinelSignals } from "@/engines/sentinel/objectiveDetectors";
import { detectObjectiveTurningPoints } from "@/engines/turningPoints/objectiveDetectors";
import { exacerbationsByYear, isDateReliable, selectPFT, selectPFTWithFEV1, selectPFTWithFVC } from "@/domain/selectors";
import type {
  ClinicalEventPayload,
  ConsultationEvent,
  ExacerbationEvent,
  MicrobiologyEvent,
  PulmonaryFunctionEvent,
  RespiratorySupportEvent,
} from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function pft(date: string, payload: Partial<PulmonaryFunctionEvent>, unresolved = false): PulmonaryFunctionEvent {
  return mkEvent<PulmonaryFunctionEvent>("p1", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, date, payload, unresolved ? { datePrecision: "unresolved" } : {});
}

function culture(date: string, organism: string, unresolved = false): MicrobiologyEvent {
  return mkEvent<MicrobiologyEvent>(
    "p1",
    CLINICAL_EVENT_TYPES.MICROBIOLOGY,
    date,
    { sampleType: "Esputo", organism, sensitivity: [], resistance: [] },
    unresolved ? { datePrecision: "unresolved" } : {},
  );
}

function exac(date: string, payload: ClinicalEventPayload<ExacerbationEvent>, unresolved = false): ExacerbationEvent {
  return mkEvent<ExacerbationEvent>("p1", CLINICAL_EVENT_TYPES.EXACERBATION, date, payload, unresolved ? { datePrecision: "unresolved" } : {});
}

function basePatient(events: Patient["events"]): Patient {
  return {
    id: "p1",
    code: "PV-TEST-0099",
    sex: "Mujer",
    age: 55,
    primaryDiagnosis: "Bronquiectasias",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events,
  };
}

describe("isDateReliable", () => {
  it("es false solo para datePrecision 'unresolved'; 'documented' y 'derived' son fiables", () => {
    expect(isDateReliable(mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { datePrecision: "documented" }))).toBe(true);
    expect(isDateReliable(mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { datePrecision: "derived" }))).toBe(true);
    expect(isDateReliable(mkEvent("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { datePrecision: "unresolved" }))).toBe(false);
  });
});

describe("selectPFT vs selectPFTWithFEV1/FVC — visible pero excluido de tendencia", () => {
  it("un PFT unresolved sigue apareciendo en selectPFT (Cronología/pestaña) pero desaparece de selectPFTWithFEV1/FVC (tendencia)", () => {
    const events = [pft("2024-01-01", { FEV1Percent: 70, FVCPercent: 80 }, true)];
    expect(selectPFT(events)).toHaveLength(1);
    expect(selectPFTWithFEV1(events)).toHaveLength(0);
    expect(selectPFTWithFVC(events)).toHaveLength(0);
  });
});

describe("comparePft — no compara si alguna de las dos fechas no es fiable", () => {
  it("con la prueba actual unresolved, no hay comparación (una caída de FEV1 no fiable no debe mostrarse como delta real)", () => {
    const previous = pft("2024-01-01", { FEV1Percent: 80 });
    const current = pft("2024-06-01", { FEV1Percent: 50 }, true); // caída dramática, pero fecha no fiable
    expect(comparePft(current, previous)).toEqual([]);
  });

  it("con la prueba previa unresolved, tampoco hay comparación", () => {
    const previous = pft("2024-01-01", { FEV1Percent: 80 }, true);
    const current = pft("2024-06-01", { FEV1Percent: 50 });
    expect(comparePft(current, previous)).toEqual([]);
  });

  it("con ambas fiables, sí compara (caso de control: el filtro no bloquea comparaciones legítimas)", () => {
    const previous = pft("2024-01-01", { FEV1Percent: 80 });
    const current = pft("2024-06-01", { FEV1Percent: 50 });
    expect(comparePft(current, previous).length).toBeGreaterThan(0);
  });
});

describe("microbiologyObjectiveChange — no etiqueta 'Nuevo aislamiento'/'Persistencia' sobre una posición cronológica no fiable", () => {
  it("si el cultivo actual tiene datePrecision unresolved, devuelve null (ni 'Nuevo aislamiento' ni 'Persistencia')", () => {
    const first = culture("2024-01-01", "Pseudomonas aeruginosa");
    const current = culture("2024-06-01", "Pseudomonas aeruginosa", true);
    expect(microbiologyObjectiveChange(current, [first, current])).toBeNull();
  });

  it("un aislamiento previo unresolved no cuenta como 'hueco' que convertiría una reaparición en 'Nuevo aislamiento' en vez de 'Persistencia'", () => {
    const first = culture("2024-01-01", "Pseudomonas aeruginosa");
    const unresolvedGap = culture("2024-03-01", "Haemophilus influenzae", true); // fecha no fiable: no debe contar como el cultivo "más reciente antes"
    const reappearance = culture("2024-06-01", "Pseudomonas aeruginosa");
    expect(microbiologyObjectiveChange(reappearance, [first, unresolvedGap, reappearance])).toBe("Persistencia");
  });
});

describe("exacerbationsByYear — una fecha no fiable no puede inflar el recuento de un año", () => {
  it("excluye exacerbaciones unresolved del recuento anual", () => {
    const patient = basePatient([
      exac("2023-06-01", { severity: "Leve", hospitalization: false }),
      exac("2024-01-01", { severity: "Leve", hospitalization: false }),
      // Sin esta fecha "unresolved", 2024 tendría 2 exacerbaciones (aumento respecto a 2023) — con el
      // filtro, se queda en 1, y no debe generar un falso "aumento de la tasa de exacerbaciones".
      exac("2024-03-01", { severity: "Leve", hospitalization: false }, true),
    ]);
    expect(exacerbationsByYear(patient)).toEqual([
      { year: 2023, count: 1 },
      { year: 2024, count: 1 },
    ]);
  });

  it("Sentinel no señala 'exacerbation-rate-increase' cuando el único aumento viene de una exacerbación con fecha no fiable", () => {
    const patient = basePatient([
      exac("2023-01-01", { severity: "Leve", hospitalization: false }),
      exac("2024-01-01", { severity: "Leve", hospitalization: false }),
      exac("2024-06-01", { severity: "Leve", hospitalization: false }, true),
    ]);
    const signals = detectObjectiveSentinelSignals(patient);
    expect(signals.find((s) => s.signalId === "exacerbation-rate-increase")).toBeUndefined();
  });
});

describe("Sentinel — fev1-trend-decline no se dispara con una fecha no fiable como una de las tres determinaciones", () => {
  it("3 valores en descenso pero uno con fecha unresolved: no hay suficientes puntos fiables, no se genera la señal", () => {
    const patient = basePatient([
      pft("2023-01-01", { FEV1Percent: 80 }),
      pft("2023-06-01", { FEV1Percent: 75 }, true), // sin este punto (excluido), solo quedan 2 determinaciones fiables
      pft("2024-01-01", { FEV1Percent: 70 }),
    ]);
    const signals = detectObjectiveSentinelSignals(patient);
    expect(signals.find((s) => s.signalId === "fev1-trend-decline")).toBeUndefined();
  });

  it("caso de control: con las 3 fiables sí se dispara (el filtro no rompe la detección legítima)", () => {
    const patient = basePatient([pft("2023-01-01", { FEV1Percent: 80 }), pft("2023-06-01", { FEV1Percent: 75 }), pft("2024-01-01", { FEV1Percent: 70 })]);
    const signals = detectObjectiveSentinelSignals(patient);
    expect(signals.find((s) => s.signalId === "fev1-trend-decline")).toBeDefined();
  });
});

describe("Sentinel — persistent-organism y new-respiratory-support ignoran fechas no fiables", () => {
  it("un 2º aislamiento con fecha unresolved no cuenta para 'aislamiento persistente'", () => {
    const patient = basePatient([culture("2023-01-01", "Pseudomonas aeruginosa"), culture("2023-06-01", "Pseudomonas aeruginosa", true)]);
    const signals = detectObjectiveSentinelSignals(patient);
    expect(signals.find((s) => s.signalId === "persistent-organism")).toBeUndefined();
  });

  it("un soporte respiratorio con fecha unresolved no se toma como el 'inicio' real", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2023-01-01", { drug: "oxígeno domiciliario" }, { datePrecision: "unresolved" }),
    ]);
    const signals = detectObjectiveSentinelSignals(patient);
    expect(signals.find((s) => s.signalId === "new-respiratory-support")).toBeUndefined();
  });
});

describe("Turning Points — descartan eventos con fecha no fiable de sus detectores", () => {
  it("first-persistent-organism no se dispara si el 2º aislamiento tiene fecha unresolved", () => {
    const patient = basePatient([culture("2023-01-01", "Pseudomonas aeruginosa"), culture("2023-06-01", "Pseudomonas aeruginosa", true)]);
    const points = detectObjectiveTurningPoints(patient);
    expect(points.find((p) => p.criterion === "first-persistent-organism")).toBeUndefined();
  });

  it("first-hospitalization no se dispara si la única hospitalización tiene fecha unresolved", () => {
    const patient = basePatient([exac("2023-01-01", { severity: "Grave", hospitalization: true }, true)]);
    const points = detectObjectiveTurningPoints(patient);
    expect(points.find((p) => p.criterion === "first-hospitalization")).toBeUndefined();
  });

  it("respiratory-support-start no se dispara si el único soporte respiratorio tiene fecha unresolved", () => {
    const patient = basePatient([
      mkEvent<RespiratorySupportEvent>("p1", CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT, "2023-01-01", { drug: "oxígeno domiciliario" }, { datePrecision: "unresolved" }),
    ]);
    const points = detectObjectiveTurningPoints(patient);
    expect(points.find((p) => p.criterion === "respiratory-support-start")).toBeUndefined();
  });

  it("restrictive-decline (FVC) no compara una caída si una de las dos pruebas tiene fecha unresolved", () => {
    const patient = basePatient([pft("2023-01-01", { FVCPercent: 90 }), pft("2023-06-01", { FVCPercent: 70 }, true)]);
    const points = detectObjectiveTurningPoints(patient);
    expect(points.find((p) => p.criterion === "restrictive-decline")).toBeUndefined();
  });
});

describe("LongitudinalEngine — computeChangesSinceLastVisit y detectContradictions ignoran fechas no fiables", () => {
  it("una consulta con fecha unresolved no se toma como 'última visita' para comparar cambios", () => {
    const events: ConsultationEvent[] = [
      mkEvent<ConsultationEvent>("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2023-01-01", {}),
      mkEvent<ConsultationEvent>("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2023-06-01", {}),
      // Si esta se tratara como fiable, sería "la última consulta" y cambiaría por completo la comparación.
      mkEvent<ConsultationEvent>("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01", {}, { datePrecision: "unresolved" }),
    ];
    const patient = basePatient([...events, pft("2023-01-01", { FEV1Percent: 80 }), pft("2023-06-01", { FEV1Percent: 70 })]);
    const result = computeChangesSinceLastVisit(patient);
    // Con solo 2 consultas fiables, from/to deben ser esas dos, nunca la fecha unresolved.
    expect(result?.fromDate).toBe("2023-01-01");
    expect(result?.toDate).toBe("2023-06-01");
  });

  it("con menos de 2 consultas fiables (aunque haya más eventos totales), no hay comparación posible", () => {
    const events: ConsultationEvent[] = [
      mkEvent<ConsultationEvent>("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2023-01-01", {}),
      mkEvent<ConsultationEvent>("p1", CLINICAL_EVENT_TYPES.CONSULTATION, "2023-06-01", {}, { datePrecision: "unresolved" }),
    ];
    const patient = basePatient(events);
    expect(computeChangesSinceLastVisit(patient)).toBeNull();
  });

  it("detectContradictions no compara un par de PFT si alguno tiene fecha unresolved, aunque los valores serían contradictorios", () => {
    const events = [
      pft("2024-01-01", { FEV1Liters: 2.0, FEV1Percent: 80 }),
      // Valores diseñados para disparar una "contradicción" (L sube, % baja) — pero con fecha no fiable,
      // el orden/; intervalo de la comparación no es de fiar, así que no debe generar la alerta.
      pft("2024-01-15", { FEV1Liters: 2.2, FEV1Percent: 60 }, true),
    ];
    const patient = basePatient(events);
    expect(detectContradictions(patient)).toEqual([]);
  });

  it("caso de control: con ambas fiables, sí detecta la contradicción (el filtro no rompe la detección legítima)", () => {
    const events = [pft("2024-01-01", { FEV1Liters: 2.0, FEV1Percent: 80 }), pft("2024-01-15", { FEV1Liters: 2.2, FEV1Percent: 60 })];
    const patient = basePatient(events);
    expect(detectContradictions(patient).length).toBeGreaterThan(0);
  });
});
