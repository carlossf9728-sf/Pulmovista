/**
 * Modelado de episodios: un episodio clínico real = un único
 * ExacerbationEvent principal. Antes de esto, el mismo ingreso podía
 * representarse varias veces a partir de frases distintas del mismo
 * bloque (narrativa de consulta fusionada con la admisión real, "durante
 * el ingreso"/"al alta" repitiendo la agudización, un HospitalizationEvent
 * standalone duplicando el contenedor) y "sin ingresos previos" se leía
 * como una hospitalización real (HOSPITALIZATION_TRIGGER no distinguía
 * negación). Cubre los 9 escenarios pedidos, más la consistencia entre
 * los selectores que usan Resumen, Cronología y Argos (nº 10).
 */
import { describe, expect, it } from "vitest";
import { buildClinicalCandidates } from "@/engines/extraction";
import { exacerbationsByYear, selectExacerbations, selectHospitalizationCount } from "@/domain/selectors";
import type { ClinicalEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function byType<T extends ClinicalEvent["type"]>(events: ClinicalEvent[], type: T): Extract<ClinicalEvent, { type: T }>[] {
  return events.filter((e): e is Extract<ClinicalEvent, { type: T }> => e.type === type);
}

describe("1) Exacerbación ambulatoria simple", () => {
  it("produce un único ExacerbationEvent con hospitalization=false", () => {
    const text = "Presenta agudización leve de bronquiectasias con aumento de expectoración purulenta, se pauta ciprofloxacino oral.";
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(1);
    expect(exacs[0].hospitalization).toBe(false);
  });
});

describe("2) Exacerbación con ingreso", () => {
  it("produce un único ExacerbationEvent con hospitalization=true, que actúa como contenedor del episodio", () => {
    const text = "Ingreso hospitalario por agudización grave de bronquiectasias con fiebre, se inicia antibiótico IV.";
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(1);
    expect(exacs[0].hospitalization).toBe(true);
    expect(exacs[0].episodeId).toBe(exacs[0].id);
    // Nunca se crea además un HospitalizationEvent independiente para el mismo ingreso.
    expect(byType(events, "hospitalization")).toHaveLength(0);
  });
});

describe("3) Varias frases del mismo ingreso", () => {
  it("una narrativa de consulta fusionada con la admisión real, seguida de más frases del mismo episodio, sigue siendo 1 solo episodio", () => {
    const text = `Antecedentes: Refiere 2 exacerbaciones tratadas con antibiótico en el último año, sin ingresos previos.

Consulta de seguimiento: nuevo episodio de aumento de disnea y expectoración purulenta.

Ingresa por agudización de bronquiectasias con fiebre y aumento de expectoración purulenta, se inicia antibiótico IV ceftazidima.

Durante el ingreso: se realiza TC tórax, sin hallazgos nuevos relevantes.

Al alta: paciente estable, se retira oxígeno suplementario, tras 7 días de ingreso.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");

    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(1);
    expect(exacs[0].hospitalization).toBe(true);
    expect(exacs[0].severity).toBe("Grave");

    // Nunca un HospitalizationEvent duplicado, ni otra exacerbación "no especificada" desde "durante el ingreso"/"al alta".
    expect(byType(events, "hospitalization")).toHaveLength(0);

    // Todos los eventos secundarios (imaging, treatment_stopped, la Consulta con la narrativa distinta)
    // comparten el mismo episodeId que el contenedor — nunca uno propio ni null.
    const container = exacs[0];
    const secondaryTypes: ClinicalEvent["type"][] = ["imaging", "treatment_stopped"];
    for (const type of secondaryTypes) {
      const found = byType(events, type);
      expect(found.length).toBeGreaterThan(0);
      for (const e of found) expect(e.episodeId).toBe(container.id);
    }

    // El antecedente agregado nunca aumenta el recuento de hospitalizaciones ni de exacerbaciones.
    expect(selectHospitalizationCount(events, null)).toBe(1);
  });
});

describe("4) 'Al alta' no crea otra exacerbación", () => {
  it("una frase de alta que repite 'ingreso' (con o sin duración) no genera un segundo ExacerbationEvent ni un HospitalizationEvent", () => {
    const text = `Ingreso hospitalario por agudización grave de bronquiectasias, se inicia antibiótico IV.

Al alta: paciente estable, se retira oxígeno suplementario, tras 5 días de ingreso.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    expect(byType(events, "exacerbation")).toHaveLength(1);
    expect(byType(events, "hospitalization")).toHaveLength(0);
  });
});

describe("5) 'Durante el ingreso' no crea otra exacerbación", () => {
  it("una frase 'durante el ingreso' con signos de empeoramiento + antibiótico no genera una segunda exacerbación 'posible'", () => {
    const text = `Ingreso hospitalario por agudización grave de bronquiectasias, se inicia antibiótico IV ceftazidima.

Durante el ingreso: se objetiva empeoramiento respiratorio con fiebre, se ajusta antibiótico.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(1);
    expect(exacs[0].hospitalization).toBe(true);
  });
});

describe("6) Antecedentes agregados no crean eventos individuales", () => {
  it("'2 exacerbaciones en el último año' no genera ningún ExacerbationEvent fechado — el dato se conserva como narrativa de consulta", () => {
    const text = "Refiere 2 exacerbaciones tratadas con antibiótico en el último año, sin ingresos previos.";
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    expect(byType(events, "exacerbation")).toHaveLength(0);
    // El dato no se pierde: sigue constando en la narrativa de la Consulta.
    const consult = byType(events, "consultation");
    expect(consult.length).toBeGreaterThan(0);
    expect(consult.some((c) => c.rawText?.includes("2 exacerbaciones"))).toBe(true);
  });

  it("un número mayor y otra redacción ('tres agudizaciones... previas') tampoco genera eventos individuales", () => {
    const text = "Antecedente de tres agudizaciones previas tratadas de forma ambulatoria, sin ingresos.";
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    expect(byType(events, "exacerbation")).toHaveLength(0);
  });
});

describe("7) 'Sin ingresos previos' no aumenta el contador de hospitalizaciones", () => {
  it("una exacerbación real que niega expresamente un ingreso previo se marca hospitalization=false", () => {
    const text = "Presenta nueva agudización de bronquiectasias con aumento de expectoración, sin ingresos previos, se trata con antibiótico oral.";
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(1);
    expect(exacs[0].hospitalization).toBe(false);
    expect(selectHospitalizationCount(events, null)).toBe(0);
  });
});

describe("8) Dos exacerbaciones realmente distintas en fechas diferentes", () => {
  it("dos episodios separados por transiciones temporales con cantidad reconocible producen 2 eventos con fechas distintas", () => {
    const text = `Consulta inicial. Estable.

Tres meses después: nueva agudización de bronquiectasias con fiebre, se pauta azitromicina.

6 meses después: nueva agudización de bronquiectasias, se pauta ciprofloxacino.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(2);
    expect(new Set(exacs.map((e) => e.date)).size).toBe(2);
  });
});

describe("9) Un ingreso real + antecedentes ambulatorios agregados", () => {
  it("el antecedente agregado y el ingreso real en el MISMO bloque producen 1 sola hospitalización", () => {
    const text = `Antecedentes: refiere 3 agudizaciones en el último año tratadas ambulatoriamente, sin ingresos previos.

Ingreso hospitalario por agudización grave de bronquiectasias, se inicia antibiótico IV.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exacs = byType(events, "exacerbation");
    expect(exacs).toHaveLength(1);
    expect(exacs[0].hospitalization).toBe(true);
    expect(selectHospitalizationCount(events, null)).toBe(1);
  });
});

describe("10) Resumen, Cronología y Argos usan el mismo recuento", () => {
  it("selectExacerbations (Cronología), exacerbationsByYear (Argos/Sentinel) y selectHospitalizationCount (Resumen) coinciden para el mismo paciente", () => {
    const text = `Antecedentes: Refiere 2 exacerbaciones tratadas con antibiótico en el último año, sin ingresos previos.

Ingreso hospitalario por agudización grave de bronquiectasias con fiebre, se inicia antibiótico IV ceftazidima.

Durante el ingreso: se realiza TC tórax.

Al alta: paciente estable, tras 7 días de ingreso.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const patient: Patient = {
      id: "p1",
      code: "PV-TEST-EPISODE",
      sex: "Mujer",
      age: 55,
      primaryDiagnosis: "Bronquiectasias",
      secondaryDiagnoses: "",
      createdAt: "2026-09-11",
      events,
    };

    // Cronología: la lista cruda de exacerbaciones (sin duplicados).
    expect(selectExacerbations(patient.events)).toHaveLength(1);
    // Argos/Sentinel: el recuento anual usado por exacerbation-rate-increase y el propio Resumen.
    const years = exacerbationsByYear(patient);
    expect(years).toHaveLength(1);
    expect(years[0].count).toBe(1);
    // Resumen: el total de hospitalizaciones acumuladas.
    expect(selectHospitalizationCount(patient.events, null)).toBe(1);
  });
});
