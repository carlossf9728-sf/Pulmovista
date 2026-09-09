import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryTab } from "@/components/patient-detail/SummaryTab";
import { TimelineTab } from "@/components/patient-detail/TimelineTab";
import { MicrobiologyTab } from "@/components/patient-detail/MicrobiologyTab";
import { AnalyticsTab } from "@/components/patient-detail/AnalyticsTab";
import { TreatmentsTab } from "@/components/patient-detail/TreatmentsTab";
import { ImagingTab } from "@/components/patient-detail/ImagingTab";
import { ConsultsTab } from "@/components/patient-detail/ConsultsTab";
import { AlertsTab } from "@/components/patient-detail/AlertsTab";
import { GuidelinesReviewTab } from "@/components/patient-detail/GuidelinesReviewTab";
import { buildDemoPatients } from "@/data/demoPatients";
import { CLINICAL_EVENT_TYPES, mkEvent } from "@/domain/clinicalEvent";
import type { ConsultationEvent, ExacerbationEvent, ImagingEvent, MicrobiologyEvent, PulmonaryFunctionEvent, TreatmentStartedEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";

function basePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "p-timeline",
    code: "PV-TEST-TIMELINE",
    sex: "Mujer",
    age: 55,
    primaryDiagnosis: "Bronquiectasias",
    secondaryDiagnoses: "",
    createdAt: "2023-01-01",
    events: [],
    ...overrides,
  };
}

const [p1, p2, p3] = buildDemoPatients();

describe("SummaryTab", () => {
  it("muestra el estado actual y los cambios desde la última consulta", () => {
    render(<SummaryTab patient={p1} onWhy={() => {}} />);
    expect(screen.getByText("Estado actual")).toBeInTheDocument();
    expect(screen.getByText("Qué ha cambiado desde la última consulta")).toBeInTheDocument();
    // p1 tiene 4 consultas: debe haber comparación, no el mensaje de "aún no hay suficientes".
    expect(screen.queryByText("Aún no hay suficientes consultas para comparar.")).not.toBeInTheDocument();
  });

  it("'Qué ha cambiado' se limita a 3 filas, priorizando Empeoramiento sobre el resto, y remite el resto a Cronología", () => {
    // p1 tiene 6 cambios entre sus dos últimas consultas: FEV1, FVC, DLCO, Exacerbaciones, Hospitalizaciones (única con Empeoramiento) y Tratamiento.
    render(<SummaryTab patient={p1} onWhy={() => {}} />);
    const changesCard = screen.getByText("Qué ha cambiado desde la última consulta").parentElement!;
    // Empeoramiento (Hospitalizaciones) siempre visible, sea cual sea su posición original.
    expect(within(changesCard).getByText("Hospitalizaciones (acumuladas)")).toBeInTheDocument();
    expect(within(changesCard).getByText("FEV1")).toBeInTheDocument();
    expect(within(changesCard).getByText("FVC")).toBeInTheDocument();
    // Las 3 restantes quedan fuera de las 3 visibles.
    expect(within(changesCard).queryByText("DLCO")).not.toBeInTheDocument();
    expect(within(changesCard).queryByText("Exacerbaciones (12 meses)")).not.toBeInTheDocument();
    expect(within(changesCard).queryByText("Tratamiento")).not.toBeInTheDocument();
    expect(within(changesCard).getByText("Ver todo en “Cronología”.")).toBeInTheDocument();
  });

  it("'Qué revisar hoy' muestra título corto + estado + motivo en una línea, nunca el texto verbatim completo de la guía", () => {
    render(<SummaryTab patient={p1} onWhy={() => {}} />);
    const card = screen.getByText("Qué revisar hoy").parentElement!;
    // Título clínico corto (topic ya clasificado), no el recommendationText verbatim.
    expect(within(card).getByText(/Antibióticos inhalados/)).toBeInTheDocument();
    expect(within(card).getByText(/Aclaramiento mucociliar/)).toBeInTheDocument();
    expect(within(card).getByText("Cumple")).toBeInTheDocument();
    expect(within(card).getByText("Aplica")).toBeInTheDocument();
    // Motivo resumido en una línea (mismo resumen que patientDatumLines ya usa en el modal).
    expect(within(card).getByText(/4 exacerbaciones en el último año, incluida 1 grave con ingreso hospitalario\./)).toBeInTheDocument();
    // El texto verbatim de la guía queda fuera de la vista principal — solo en el modal "¿Por qué?".
    expect(within(card).queryByText(/patients with bronchiectasis should be taught airway clearance techniques/i)).not.toBeInTheDocument();
    expect(within(card).queryByText("Texto original de la guía")).not.toBeInTheDocument();
  });

  it("'Momentos clave' usa una formulación corta y directa, sin la cláusula explicativa larga", () => {
    render(<SummaryTab patient={p1} onWhy={() => {}} />);
    const card = screen.getByText("Momentos clave").parentElement!;
    expect(within(card).getByText("Primera hospitalización por exacerbación")).toBeInTheDocument();
    expect(within(card).getByText("Primer aislamiento persistente de Pseudomonas aeruginosa")).toBeInTheDocument();
    // Ninguna de las dos incluye la cláusula explicativa larga de la interpretación completa (esa sigue en Alertas).
    expect(within(card).queryByText(/hito relevante en la trayectoria/)).not.toBeInTheDocument();
    expect(within(card).queryByText(/posible colonización crónica/)).not.toBeInTheDocument();
  });

  it("muestra los problemas activos (diagnóstico principal + secundarios) como chips", () => {
    render(<SummaryTab patient={p3} onWhy={() => {}} />);
    expect(screen.getByText("Fibrosis pulmonar idiopática")).toBeInTheDocument();
    expect(screen.getByText("Reflujo gastroesofágico")).toBeInTheDocument();
  });

  it("'Qué ha cambiado' muestra el cambio numérico directo (sin badges genéricos de dirección) y ninguna etiqueta clínica sin un Turning Point real (FVC de p2, que no tiene restrictive-decline)", () => {
    render(<SummaryTab patient={p2} onWhy={() => {}} />);
    const changesCard = screen.getByText("Qué ha cambiado desde la última consulta").parentElement!;
    const fvcRow = within(changesCard).getByText("FVC").parentElement!;
    expect(within(fvcRow).getByText("57%")).toBeInTheDocument();
    expect(within(fvcRow).getByText("53%")).toBeInTheDocument();
    expect(within(fvcRow).queryByText("Disminuido")).not.toBeInTheDocument();
    expect(within(fvcRow).queryByText("Aumentado")).not.toBeInTheDocument();
    expect(within(fvcRow).queryByText("Empeoramiento")).not.toBeInTheDocument();
    expect(within(fvcRow).queryByText("Mejoría")).not.toBeInTheDocument();
  });

  it("una nueva exacerbación grave/hospitalización eleva 'Hospitalizaciones (acumuladas)' y se etiqueta Empeoramiento, sin depender de un Turning Point", () => {
    const patient = basePatient({
      events: [
        mkEvent<ConsultationEvent>("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-01-01"),
        mkEvent<ConsultationEvent>("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-06-01"),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-03-01", { severity: "Grave", hospitalization: true }),
      ],
    });
    render(<SummaryTab patient={patient} onWhy={() => {}} />);
    const changesCard = screen.getByText("Qué ha cambiado desde la última consulta").parentElement!;
    expect(within(changesCard).getByText("Hospitalizaciones (acumuladas)")).toBeInTheDocument();
    expect(within(changesCard).getByText("Empeoramiento")).toBeInTheDocument();
  });

  it("un salto en la tasa de exacerbaciones (Turning Point ya existente dentro de la ventana) etiqueta 'Exacerbaciones (12 meses)' como Empeoramiento", () => {
    const patient = basePatient({
      events: [
        mkEvent<ConsultationEvent>("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-06-01"),
        mkEvent<ConsultationEvent>("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2025-06-01"),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-02-01", { severity: "Leve", hospitalization: false }),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2025-02-01", { severity: "Leve", hospitalization: false }),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2025-03-01", { severity: "Leve", hospitalization: false }),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2025-04-01", { severity: "Leve", hospitalization: false }),
      ],
    });
    render(<SummaryTab patient={patient} onWhy={() => {}} />);
    const changesCard = screen.getByText("Qué ha cambiado desde la última consulta").parentElement!;
    expect(within(changesCard).getByText("Exacerbaciones (12 meses)")).toBeInTheDocument();
    expect(within(changesCard).getByText("Empeoramiento")).toBeInTheDocument();
  });

  it("'Qué información falta' muestra como mucho 3 ítems y remite a Alertas para el resto", () => {
    // Paciente Bronquiectasias sin eventos: las 8 reglas legacy fallan todas.
    render(<SummaryTab patient={basePatient()} onWhy={() => {}} />);
    expect(screen.getAllByText(/No consta/).length).toBe(3);
    expect(screen.getByText(/\+5 más en/)).toBeInTheDocument();
  });

  it("'Qué revisar hoy' distingue 'sin guía cargada' de 'sin prioridades' — un diagnóstico no soportado (Asma) nunca dispara ni una recomendación GENERAL, a diferencia de Bronquiectasias", () => {
    render(<SummaryTab patient={basePatient({ primaryDiagnosis: "Asma", secondaryDiagnoses: "" })} onWhy={() => {}} />);
    expect(
      screen.getByText("PulmoVista todavía no tiene una guía clínica cargada para este diagnóstico. No es un fallo del sistema: es una limitación de cobertura actual, que iremos ampliando."),
    ).toBeInTheDocument();
    expect(screen.getByText("No se han identificado puntos de inflexión relevantes.")).toBeInTheDocument();
  });

  it("'Qué revisar hoy' muestra el estado 'sin prioridades' (no el de cobertura) para un diagnóstico SÍ soportado, incluso sin eventos", () => {
    // Bronquiectasias está soportado por matchPatientToGuidelines: dispara al menos la recomendación GENERAL de aclaramiento de vía aérea.
    render(<SummaryTab patient={basePatient()} onWhy={() => {}} />);
    expect(screen.queryByText(/todavía no tiene una guía clínica cargada/)).not.toBeInTheDocument();
  });
});

describe("TimelineTab", () => {
  it("permite filtrar por grupo de evento", async () => {
    render(<TimelineTab patient={p1} />);
    expect(screen.getByText("Filtrar:")).toBeInTheDocument();
    const micText = screen.getAllByText("Microbiología");
    expect(micText.length).toBeGreaterThan(0);
    const filterButton = screen.getByRole("button", { name: "Microbiología" });
    await userEvent.click(filterButton);
    // Tras desactivar el filtro de Microbiología no deberían quedar eventos de ese grupo en la línea de tiempo.
    expect(screen.queryAllByText((_, el) => el?.textContent === "Microbiología" && el.tagName === "SPAN")).toHaveLength(0);
  });

  it("agrupa varios eventos del mismo día en una única tarjeta de episodio con una cabecera clínica resumida, no un contador genérico", () => {
    const patient = basePatient({
      events: [
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-03-10", { severity: "Moderada", hospitalization: false }),
        mkEvent<MicrobiologyEvent>("p-timeline", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-03-10", {
          sampleType: "Esputo",
          organism: "Pseudomonas aeruginosa",
          sensitivity: [],
          resistance: [],
        }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByText(/elementos de la misma visita/)).not.toBeInTheDocument();
    // La Cronología muestra lo más reciente primero; dentro del mismo día, el orden interno sigue el mismo criterio que ya usaba la lista antes de agrupar.
    expect(screen.getByText("Cultivo de Pseudomonas aeruginosa + exacerbación")).toBeInTheDocument();
    // "Exacerbación"/"Microbiología" aparecen también como chip de filtro y como etiqueta de categoría de la fila.
    expect(screen.getAllByText("Exacerbación").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Microbiología").length).toBeGreaterThan(1);
  });

  it("con más de 3 elementos, la cabecera del episodio corta y cuenta los que faltan en vez de alargarse sin límite", () => {
    const patient = basePatient({
      events: [
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-03-10", { severity: "Moderada", hospitalization: false }),
        mkEvent<MicrobiologyEvent>("p-timeline", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-03-10", { sampleType: "Esputo", organism: "P. aeruginosa", sensitivity: [], resistance: [] }),
        mkEvent<PulmonaryFunctionEvent>("p-timeline", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-03-10", { FEV1Percent: 70 }),
        mkEvent("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-03-10", {}, { rawText: "Consulta de revisión." }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.getByText("Consulta + función pulmonar + cultivo de P. aeruginosa +1 más")).toBeInTheDocument();
  });

  it("un único evento en su fecha se muestra igual que antes, sin cabecera de episodio", () => {
    const patient = basePatient({
      events: [mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-03-10", { severity: "Moderada", hospitalization: false })],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByText(/elementos de la misma visita/)).not.toBeInTheDocument();
    // Sin cabecera de episodio: "Exacerbación" solo aparece como chip de filtro y como etiqueta de categoría de la única fila.
    expect(screen.getAllByText("Exacerbación")).toHaveLength(2);
  });

  it("trunca una consulta/evolución larga con 'Ver más', y permite revelarla completa", async () => {
    const longText = "Consulta de revisión muy detallada. ".repeat(10);
    const patient = basePatient({
      events: [mkEvent("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-03-10", {}, { rawText: longText })],
    });
    render(<TimelineTab patient={patient} />);
    await userEvent.click(screen.getByText("Consulta / evolución"));
    expect(screen.getByText(/…/)).toBeInTheDocument();
    const verMas = screen.getByRole("button", { name: "Ver más" });
    // El texto completo todavía no está en el documento — solo la versión truncada.
    expect(screen.queryByText(longText.trim())).not.toBeInTheDocument();

    await userEvent.click(verMas);
    expect(screen.getByText(longText.trim(), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver menos" })).toBeInTheDocument();
  });

  it("una consulta/evolución corta se muestra entera, sin 'Ver más'", async () => {
    const patient = basePatient({
      events: [mkEvent("p-timeline", CLINICAL_EVENT_TYPES.CONSULTATION, "2024-03-10", {}, { rawText: "Consulta breve, sin novedades." })],
    });
    render(<TimelineTab patient={patient} />);
    await userEvent.click(screen.getByText("Consulta / evolución"));
    expect(screen.getByText("Consulta breve, sin novedades.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });

  it("marca 'Momento clave' solo en el episodio cuya fecha coincide con un Turning Point ya detectado — reutiliza computeTurningPoints(), no una regla nueva", () => {
    // first-persistent-organism: se dispara en la fecha del SEGUNDO aislamiento del mismo organismo — determinista, no depende de la fecha de hoy.
    const patient = basePatient({
      events: [
        mkEvent<MicrobiologyEvent>("p-timeline", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", {
          sampleType: "Esputo",
          organism: "Pseudomonas aeruginosa",
          sensitivity: [],
          resistance: [],
        }),
        mkEvent<MicrobiologyEvent>("p-timeline", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-06-01", {
          sampleType: "Esputo",
          organism: "Pseudomonas aeruginosa",
          sensitivity: [],
          resistance: [],
        }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.getAllByText("Momento clave")).toHaveLength(1);
  });

  it("agrupa por año cuando hay más de un año de historia, con solo el año más reciente abierto por defecto", async () => {
    const patient = basePatient({
      events: [
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2023-05-01", { severity: "Leve", hospitalization: false }),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-05-01", { severity: "Leve", hospitalization: false }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    const toggle2023 = screen.getByRole("button", { name: /2023/ });
    expect(toggle2023).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle2023);
    expect(toggle2023).toHaveAttribute("aria-expanded", "true");
  });

  it("una sola fecha con historia no muestra ninguna cabecera de año", () => {
    const patient = basePatient({
      events: [mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-05-01", { severity: "Leve", hospitalization: false })],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByRole("button", { name: /2024/ })).not.toBeInTheDocument();
  });

  it("muestra el z-score de FEV1/FVC junto al % del predicho, y la comparación longitudinal con la prueba anterior al expandir", async () => {
    render(<TimelineTab patient={p1} />);
    // p1 tiene z-score a partir de la prueba de 2026-01-14 (ver data/demoPatients.ts) — la de 2026-06-20 ya tiene con qué comparar.
    const title = screen.getByText(/FEV1 68% \(z −2\.0\)/);
    await userEvent.click(title);
    expect(screen.getByText(/FEV1: 1\.74 L \(−0\.03 L\)/)).toBeInTheDocument();
    expect(screen.getByText(/68% predicho \(−1 puntos\)/)).toBeInTheDocument();
    expect(screen.getByText(/z −2\.0 \(−0\.1\)/)).toBeInTheDocument();
  });

  it("radiología: Empeoramiento se deduce del propio texto del informe (domain/radiologyTrend), no de un Turning Point", () => {
    const patient = basePatient({
      events: [
        mkEvent<ImagingEvent>("p-timeline", CLINICAL_EVENT_TYPES.IMAGING, "2024-01-01", {
          label: "TC tórax",
          text: "Progresión de bronquiectasias con nueva impactación mucosa.",
        }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.getByText("Empeoramiento")).toBeInTheDocument();
  });

  it("radiología: un informe sin lenguaje de cambio claro no se etiqueta", () => {
    const patient = basePatient({
      events: [mkEvent<ImagingEvent>("p-timeline", CLINICAL_EVENT_TYPES.IMAGING, "2024-01-01", { label: "TC tórax", text: "Sin cambios significativos." })],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByText("Empeoramiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Mejoría")).not.toBeInTheDocument();
  });

  it("exacerbación grave/hospitalizada: Empeoramiento en cada ocurrencia, no solo la primera (isSevereExacerbation, reutilizada de engines/guidelines)", () => {
    const patient = basePatient({
      events: [
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true }),
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-06-01", { severity: "Grave", hospitalization: true }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.getAllByText("Empeoramiento")).toHaveLength(2);
  });

  it("exacerbación leve sin criterio de Turning Point ya existente: sin etiqueta", () => {
    const patient = basePatient({
      events: [mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false })],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByText("Empeoramiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Mejoría")).not.toBeInTheDocument();
  });

  it("función pulmonar: variabilidad de 3 valores consecutivos que no cumple el criterio restrictive-decline no se etiqueta (no se reutiliza la regla de 3 lecturas de Sentinel)", () => {
    const patient = basePatient({
      events: [
        mkEvent<PulmonaryFunctionEvent>("p-timeline", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-01-01", { FEV1Percent: 80, FVCPercent: 90 }),
        mkEvent<PulmonaryFunctionEvent>("p-timeline", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-04-01", { FEV1Percent: 78, FVCPercent: 89 }),
        mkEvent<PulmonaryFunctionEvent>("p-timeline", CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION, "2024-07-01", { FEV1Percent: 76, FVCPercent: 88 }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByText("Empeoramiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Mejoría")).not.toBeInTheDocument();
  });

  it("microbiología: nunca muestra una etiqueta de interpretación (Empeoramiento/Mejoría), solo el cambio objetivo ('Nuevo aislamiento')", () => {
    const patient = basePatient({
      events: [
        mkEvent<MicrobiologyEvent>("p-timeline", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2024-01-01", {
          sampleType: "Esputo",
          organism: "Pseudomonas aeruginosa",
          sensitivity: [],
          resistance: [],
        }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.getByText("Nuevo aislamiento")).toBeInTheDocument();
    expect(screen.queryByText("Empeoramiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Mejoría")).not.toBeInTheDocument();
  });

  it("tratamientos: un cambio de tratamiento nunca se etiqueta automáticamente como Empeoramiento/Mejoría", () => {
    const patient = basePatient({
      events: [mkEvent<TreatmentStartedEvent>("p-timeline", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2024-01-01", { drug: "azitromicina" })],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByText("Empeoramiento")).not.toBeInTheDocument();
    expect(screen.queryByText("Mejoría")).not.toBeInTheDocument();
  });

  it("una exacerbación sin hospitalización nunca muestra 'Ver episodio'", () => {
    const patient = basePatient({
      events: [mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Leve", hospitalization: false })],
    });
    render(<TimelineTab patient={patient} />);
    expect(screen.queryByRole("button", { name: "Ver episodio" })).not.toBeInTheDocument();
  });

  it("una exacerbación hospitalizada SIN datos de episodio (sin episodeId ni fecha de alta) igualmente se representa como episodio, sin inventar lo que falta", async () => {
    const patient = basePatient({
      events: [mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true })],
    });
    render(<TimelineTab patient={patient} />);
    // Sin dischargeDate: el titular omite la duración.
    expect(screen.getByText("Exacerbación grave")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver episodio" }));
    expect(screen.getByText(/Sin fecha de alta registrada/)).toBeInTheDocument();
    expect(screen.getByText("No se han registrado cambios clínicos relevantes después de este episodio.")).toBeInTheDocument();
    // Sin datos vinculados: ninguna de estas secciones opcionales aparece.
    expect(screen.queryByText("Motivo de ingreso")).not.toBeInTheDocument();
    expect(screen.queryByText("Soporte respiratorio")).not.toBeInTheDocument();
    expect(screen.queryByText("Diagnósticos del episodio")).not.toBeInTheDocument();
  });

  it("tratamiento vinculado sin fecha de fin ni dose/schedule documentados: 'Inicio {fecha} · Continúa', nunca una duración inventada", async () => {
    const patient = basePatient({
      events: [
        mkEvent<ExacerbationEvent>("p-timeline", CLINICAL_EVENT_TYPES.EXACERBATION, "2024-01-01", { severity: "Grave", hospitalization: true }, { episodeId: "ep-a" }),
        mkEvent<TreatmentStartedEvent>("p-timeline", CLINICAL_EVENT_TYPES.TREATMENT_STARTED, "2024-01-01", { drug: "azitromicina" }, { episodeId: "ep-a" }),
      ],
    });
    render(<TimelineTab patient={patient} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver episodio" }));
    expect(screen.getByText("Azitromicina · Inicio 01/01/2024 · Continúa")).toBeInTheDocument();
  });

  it("episodio de ingreso con datos completos (p2, 19/01/2026): titular con duración, línea de aviso, y detalle completo tras 'Ver episodio'", async () => {
    render(<TimelineTab patient={p2} />);
    const headline = screen.getByText("Exacerbación grave · ingreso 7 días");
    expect(screen.getByText("Precisó VMNI · alta a domicilio")).toBeInTheDocument();

    const card = headline.closest("div")!.parentElement!;
    await userEvent.click(within(card).getByRole("button", { name: "Ver episodio" }));

    expect(screen.getByText("Diagnósticos del episodio")).toBeInTheDocument();
    expect(screen.getByText("Agudización grave de EPOC con insuficiencia respiratoria hipercápnica")).toBeInTheDocument();
    expect(screen.getByText("Soporte respiratorio")).toBeInTheDocument();
    expect(screen.getByText("Pruebas complementarias")).toBeInTheDocument();
    expect(screen.getByText("Analítica y gasometría de ingreso")).toBeInTheDocument();
    expect(screen.getByText("Rx tórax (ingreso)")).toBeInTheDocument();
    expect(screen.getByText("Tratamiento durante el ingreso")).toBeInTheDocument();
    // Duración cerrada calculada por fechas (inicio 19/01, fin 25/01 vinculados) — no una fila de inicio y otra de fin por separado.
    expect(screen.getByText("Piperacilina-tazobactam IV · 19/01/2026–25/01/2026 · 6 días")).toBeInTheDocument();
    expect(screen.queryByText(/Finalizado: Piperacilina/)).not.toBeInTheDocument();
    expect(screen.getByText("Tratamiento al alta")).toBeInTheDocument();
    // Sin fecha de fin (tratamiento al alta): se muestra la pauta ya documentada, no una duración inventada.
    expect(screen.getByText("Prednisona oral · pauta descendente, 5 días")).toBeInTheDocument();
    expect(screen.getByText("Situación al alta")).toBeInTheDocument();
    expect(screen.getByText("Recomendaciones / plan de seguimiento")).toBeInTheDocument();
    // Único cambio defendible tras este episodio con criterios ya existentes (ver domain/episode.ts#changesAfterEpisode).
    expect(screen.getByText("Nuevo aislamiento microbiológico: Haemophilus influenzae")).toBeInTheDocument();
  });

  it("episodio de ingreso del paciente demo principal (p1, 05/02/2026): motivo, duración, pruebas y tratamiento durante el ingreso — sin soporte respiratorio ni diagnóstico (no procedían, no se inventan)", async () => {
    render(<TimelineTab patient={p1} />);
    const headline = screen.getByText("Exacerbación grave · ingreso 5 días");
    expect(screen.getByText("Alta a domicilio")).toBeInTheDocument();

    const card = headline.closest("div")!.parentElement!;
    await userEvent.click(within(card).getByRole("button", { name: "Ver episodio" }));

    expect(screen.getByText(/aumento de expectoración purulenta/)).toBeInTheDocument();
    const testsSection = screen.getByText("Pruebas complementarias").parentElement!;
    // El mismo evento sigue apareciendo también como fila independiente en Cronología — no una copia, sino el mismo dato referenciado, por eso puede haber más de una coincidencia fuera de esta sección.
    expect(within(testsSection).getByText("Cultivo: Pseudomonas aeruginosa")).toBeInTheDocument();
    expect(within(testsSection).getByText("Analítica de ingreso")).toBeInTheDocument();
    expect(screen.getByText("Tratamiento durante el ingreso")).toBeInTheDocument();
    expect(screen.getByText("Ceftazidima IV · 05/02/2026–09/02/2026 · 4 días")).toBeInTheDocument();
    expect(screen.getByText("Situación al alta")).toBeInTheDocument();
    expect(screen.getByText("Recomendaciones / plan de seguimiento")).toBeInTheDocument();
    // No se fuerza ningún dato que el caso no tiene.
    expect(screen.queryByText("Soporte respiratorio")).not.toBeInTheDocument();
    expect(screen.queryByText("Diagnósticos del episodio")).not.toBeInTheDocument();
    expect(screen.queryByText("Tratamiento al alta")).not.toBeInTheDocument();
    expect(screen.getByText("No se han registrado cambios clínicos relevantes después de este episodio.")).toBeInTheDocument();
  });
});

describe("MicrobiologyTab", () => {
  it("muestra una fila por cada aislamiento microbiológico", () => {
    render(<MicrobiologyTab patient={p1} />);
    expect(screen.getAllByText("Pseudomonas aeruginosa").length).toBeGreaterThan(0);
  });
  it("muestra el mensaje de ausencia cuando no hay microbiología (p3)", () => {
    render(<MicrobiologyTab patient={p3} />);
    expect(screen.getByText("No disponible: sin muestras microbiológicas registradas.")).toBeInTheDocument();
  });
  it("muestra el cambio objetivo (capa 1) de cada aislamiento: 'Nuevo aislamiento' en el primero, 'Persistencia' en los repetidos", () => {
    render(<MicrobiologyTab patient={p1} />);
    expect(screen.getAllByText("Nuevo aislamiento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Persistencia").length).toBeGreaterThan(0);
  });
});

describe("AnalyticsTab", () => {
  it("separa 'Analítica general' de 'Estudio etiológico / cribado de bronquiectasias', cada una con sus propios parámetros (p1)", () => {
    render(<AnalyticsTab patient={p1} />);
    expect(screen.getByText("Analítica general")).toBeInTheDocument();
    expect(screen.getByText("Estudio etiológico / cribado de bronquiectasias")).toBeInTheDocument();
    // Parámetro de la analítica general.
    expect(screen.getByText("PCR")).toBeInTheDocument();
    // Parámetros del estudio etiológico — no aparecen en el mismo bloque que PCR.
    expect(screen.getByText("IgG")).toBeInTheDocument();
    expect(screen.getByText("Alfa-1-antitripsina")).toBeInTheDocument();
  });

  it("muestra el badge de estado solo cuando el parámetro trae status explícito, con el color correspondiente ('alterado' en PCR, 'normal' en el resto del estudio etiológico)", () => {
    render(<AnalyticsTab patient={p1} />);
    expect(screen.getAllByText("alterado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("normal").length).toBeGreaterThan(0);
  });

  it("PCR tiene histórico (2 determinaciones) y se expande para mostrar ambas fechas y valores, sin inventar un veredicto de mejoría/empeoramiento", async () => {
    render(<AnalyticsTab patient={p1} />);
    // Leucocitos también tiene 2 determinaciones (mismo patrón) — se acota la búsqueda a la fila de PCR.
    const pcrRow = screen.getByTestId("lab-param-general-PCR");
    const historyToggle = within(pcrRow).getByRole("button", { name: /histórico \(2\)/i });
    // "8 mg/L" (el valor más reciente) ya se ve en la fila compacta antes de expandir; "95 mg/L" solo aparece en el histórico.
    expect(within(pcrRow).getByText("8 mg/L")).toBeInTheDocument();
    expect(within(pcrRow).queryByText("95 mg/L")).not.toBeInTheDocument();
    await userEvent.click(historyToggle);
    expect(within(pcrRow).getByText("95 mg/L")).toBeInTheDocument();
    expect(within(pcrRow).queryByText(/mejoría|empeoramiento/i)).not.toBeInTheDocument();
  });

  it("una analítica antigua sin desglose estructurado (p2) se sigue mostrando íntegra, con su texto original", () => {
    render(<AnalyticsTab patient={p2} />);
    expect(screen.getByText("Otras analíticas sin desglose")).toBeInTheDocument();
    expect(screen.getByText(/Gasometría arterial/)).toBeInTheDocument();
  });

  it("un paciente sin ninguna analítica registrada (p3) muestra el estado de ausencia, no una pestaña vacía sin explicación", () => {
    render(<AnalyticsTab patient={p3} />);
    expect(screen.getByText("No disponible: sin analíticas registradas.")).toBeInTheDocument();
  });

  it("una categoría sin ningún parámetro registrado muestra su propio texto de ausencia, no un hueco silencioso", () => {
    // p2 solo tiene una analítica sin desglosar: ambas categorías (general/etiológico) están vacías de series.
    render(<AnalyticsTab patient={p2} />);
    expect(screen.getByText("No se han registrado parámetros de analítica general desglosados.")).toBeInTheDocument();
    expect(screen.getByText("No se han registrado parámetros del estudio etiológico desglosados.")).toBeInTheDocument();
  });
});

describe("TreatmentsTab", () => {
  it("muestra el estado Activo/Finalizado de cada tratamiento", () => {
    render(<TreatmentsTab patient={p1} />);
    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
  });
});

describe("ImagingTab", () => {
  it("clasifica Empeoramiento cuando el propio informe indica progresión/aumento, reutilizando domain/radiologyTrend", () => {
    render(<ImagingTab patient={p1} />);
    expect(screen.getAllByText("Empeoramiento").length).toBeGreaterThan(0);
  });

  it("no etiqueta un informe sin lenguaje de cambio claro ('sin cambios significativos')", () => {
    render(<ImagingTab patient={p1} />);
    expect(screen.queryByText("Mejoría")).not.toBeInTheDocument();
  });
});

describe("ConsultsTab", () => {
  it("invoca onAddClinicalInfo al pulsar el botón", async () => {
    const onAdd = vi.fn();
    render(<ConsultsTab patient={p1} onAddClinicalInfo={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: /añadir información clínica/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe("AlertsTab", () => {
  it("usa 'Argos · Aspectos a revisar' como rótulo visible — nunca el nombre interno del motor ('Sentinel')", () => {
    render(<AlertsTab patient={p1} onWhy={vi.fn()} />);
    expect(screen.getByText("Argos · Aspectos a revisar")).toBeInTheDocument();
    expect(screen.queryByText("Sentinel")).not.toBeInTheDocument();
    expect(screen.queryByText("PulmoVista Sentinel")).not.toBeInTheDocument();
  });

  it("Sentinel muestra hallazgos objetivos con interpretación respaldada por guía (ya no heurística legacy) y permite abrir '¿Por qué?'", async () => {
    const onWhy = vi.fn();
    render(<AlertsTab patient={p1} onWhy={onWhy} />);
    expect(screen.getByText("Aislamiento microbiológico persistente")).toBeInTheDocument();
    // El dato objetivo de FEV1 se muestra sin interpretación respaldada (sin soporte de guía para ese cambio).
    expect(screen.getByText("No se ha encontrado soporte suficiente en las guías cargadas para interpretar clínicamente este hallazgo.")).toBeInTheDocument();
    // Traducción a lenguaje clínico — nunca el término técnico "GuidelineMatch".
    expect(screen.getByText("Cumple")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("GuidelineMatch");
    // La interpretación en español es el texto principal; el verbatim de la guía queda como cita secundaria.
    expect(screen.getAllByText("Texto original de la guía").length).toBeGreaterThan(0);

    const [firstWhyButton] = screen.getAllByRole("button", { name: /por qué/i });
    await userEvent.click(firstWhyButton);
    expect(onWhy).toHaveBeenCalledOnce();
    const explanation = onWhy.mock.calls[0][0];
    expect(explanation.source.kind).toBe("guideline");
    expect(explanation.sections.map((s: { label: string }) => s.label)).toEqual([
      "Dato del paciente",
      "Criterio de la guía",
      "Evaluación",
      "Recomendación",
      "Guía",
      "Sección",
      "Página",
      "Fragmento fuente",
    ]);
  });

  it("Turning Points sigue mostrando su fuente legacy (no migrado en esta fase)", () => {
    render(<AlertsTab patient={p1} onWhy={vi.fn()} />);
    expect(screen.getAllByText("heurística experimental").length).toBeGreaterThan(0);
  });
});

describe("GuidelinesReviewTab", () => {
  it("agrupa las recomendaciones en 3 bloques por bucket y permite abrir '¿Por qué?' con trazabilidad completa en el modal", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    // p1 tiene bronquiectasias con asma, exacerbaciones y aislamientos de P. aeruginosa.
    expect(screen.getByText("Aplicables")).toBeInTheDocument();
    expect(screen.getByText("Pendientes de información")).toBeInTheDocument();
    expect(screen.getByText("No indicadas / desaconsejadas")).toBeInTheDocument();
    // ers-rec-pico1 (sin criterios acotados) siempre aplica a un paciente con bronquiectasias, y en una única tarjeta.
    // El texto verbatim de la guía (aquí en inglés, ERS 2025) se muestra siempre como cita secundaria, nunca como titular.
    expect(screen.getByText(/patients with bronchiectasis should be taught airway clearance techniques/i)).toBeInTheDocument();
    expect(screen.getAllByText("Texto original de la guía").length).toBeGreaterThan(0);

    // La tarjeta ya no muestra el detalle fino directamente: solo recomendación + motivo resumido + guía + estado + botón.
    expect(screen.queryByText("Dato del paciente")).not.toBeInTheDocument();
    expect(screen.queryByText("Interpretación de PulmoVista")).not.toBeInTheDocument();
    expect(screen.queryByText("Recomendación de la guía")).not.toBeInTheDocument();
    expect(screen.queryByText("Fuerza")).not.toBeInTheDocument();

    const [firstWhyButton] = screen.getAllByRole("button", { name: /por qué/i });
    await userEvent.click(firstWhyButton);
    expect(onWhy).toHaveBeenCalledOnce();
    const explanation = onWhy.mock.calls[0][0];
    expect(explanation.source.kind).toBe("guideline");
    // El detalle fino (incluida fuerza/calidad de evidencia, antes en la tarjeta) vive ahora en el modal.
    expect(explanation.sections.map((s: { label: string }) => s.label)).toEqual([
      "Dato del paciente",
      "Criterio clínico de la guía",
      "Interpretación de PulmoVista",
      "Recomendación",
      "Fuerza de la recomendación",
      "Calidad de la evidencia",
    ]);
    expect(explanation.citation).toBeDefined();
    expect(explanation.citation.sourceText.length).toBeGreaterThan(0);
    expect(explanation.citation.year).toBeGreaterThan(2000);
    // "GuidelineMatch" nunca aparece como término visible.
    expect(JSON.stringify(explanation)).not.toContain("GuidelineMatch");
  });

  it("'No indicadas / desaconsejadas' está plegado por defecto y se puede expandir", async () => {
    render(<GuidelinesReviewTab patient={p1} onWhy={vi.fn()} />);
    // separ-rec-corticoides-no-rutina: p1 tiene asma como diagnóstico secundario, así que la exclusión
    // siempre se cumple (no depende de la fecha de hoy) — cae siempre en "No indicadas / desaconsejadas".
    const notIndicatedText = /No se recomienda el uso rutinario de corticosteroides inhalados/i;
    expect(screen.queryByText(notIndicatedText)).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /No indicadas \/ desaconsejadas/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(notIndicatedText)).toBeInTheDocument();
  });

  it("muestra un estado informativo (no un error) cuando ningún problema clínico activo tiene guía compatible", () => {
    render(<GuidelinesReviewTab patient={p2} onWhy={vi.fn()} />);
    expect(screen.queryByText("Aplicables")).not.toBeInTheDocument();
    expect(screen.getByText("No hay una guía compatible disponible para este problema clínico")).toBeInTheDocument();
    // El diagnóstico real del paciente (EPOC) aparece explícitamente, no un mensaje genérico de error.
    expect(screen.getByText(/EPOC/)).toBeInTheDocument();
    expect(screen.getByText(/no es un error/i)).toBeInTheDocument();
  });

  it("aplica recomendaciones cuando bronquiectasias consta como diagnóstico SECUNDARIO, no solo como principal", () => {
    const patientWithSecondaryBx: Patient = { ...p2, secondaryDiagnoses: "Bronquiectasias por tracción" };
    render(<GuidelinesReviewTab patient={patientWithSecondaryBx} onWhy={vi.fn()} />);
    expect(screen.queryByText("No hay una guía compatible disponible para este problema clínico")).not.toBeInTheDocument();
    expect(screen.getByText("Aplicables")).toBeInTheDocument();
  });

  it("una recomendación GENERAL (ers-rec-pico1) resume el motivo en la tarjeta sin decir 'cumple el criterio clínico', y el diagnóstico aparece como dato en el modal", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    const generalCardText = screen.getByText(/patients with bronchiectasis should be taught airway clearance techniques/i);
    const card = generalCardText.closest(".pv-card-hover") as HTMLElement;
    expect(card).toBeTruthy();
    expect(within(card).getByText(/aplica de forma general/i)).toBeInTheDocument();
    expect(within(card).queryByText(/cumple el criterio clínico/i)).not.toBeInTheDocument();

    const whyButton = within(card).getByRole("button", { name: /por qué/i });
    await userEvent.click(whyButton);
    const explanation = onWhy.mock.calls.at(-1)?.[0];
    expect(explanation.sections.find((s: { label: string }) => s.label === "Dato del paciente").text).toContain(p1.primaryDiagnosis);
    expect(explanation.sections.find((s: { label: string }) => s.label === "Interpretación de PulmoVista").text).not.toContain("cumple el criterio clínico");
  });

  it("nunca muestra el encabezado 'Evidencias' ni una lista cruda de eventos en el modal, para ninguna tarjeta visible", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    // Nunca debe aparecer un bloque "Ninguno."/"Ninguna." en ninguna tarjeta.
    expect(screen.queryByText("Ninguno.")).not.toBeInTheDocument();
    expect(screen.queryByText("Ninguna.")).not.toBeInTheDocument();

    const whyButtons = screen.getAllByRole("button", { name: /por qué/i });
    for (const button of whyButtons) {
      await userEvent.click(button);
      const explanation = onWhy.mock.calls.at(-1)?.[0];
      const datoDelPaciente = explanation.sections.find((s: { label: string }) => s.label === "Dato del paciente").text;
      expect(datoDelPaciente).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
    expect(screen.queryByText("Evidencias")).not.toBeInTheDocument();
  });

  it("cuando una recomendación cambia de estado con nueva información, se marca 'Actualizada' y aparece en 'Cambios recientes' sin duplicar la tarjeta", async () => {
    const patientNoCulture: Patient = {
      id: "p-track",
      code: "PV-TEST-TRACK",
      sex: "Mujer",
      age: 50,
      primaryDiagnosis: "Bronquiectasias",
      secondaryDiagnoses: "",
      createdAt: "2020-01-01",
      events: [],
    };
    const { rerender } = render(<GuidelinesReviewTab patient={patientNoCulture} onWhy={vi.fn()} />);
    // Primera vez que se ve a este paciente en la sesión: nunca hay "Cambios recientes" todavía (no hay "antes" con qué comparar).
    expect(screen.queryByText("Cambios recientes")).not.toBeInTheDocument();

    const eradicationText = /offer eradication treatment to patients with a new isolation/i;
    // Sin ningún cultivo registrado, ers-rec-pico6 (erradicación) no puede confirmarse: cae en un estado distinto de "applies".
    const beforeUpdatedBadges = screen.queryAllByText("Actualizada").length;
    expect(beforeUpdatedBadges).toBe(0);

    const cultureEvent = mkEvent<MicrobiologyEvent>("p-track", CLINICAL_EVENT_TYPES.MICROBIOLOGY, "2020-01-02", {
      sampleType: "Esputo",
      organism: "Pseudomonas aeruginosa",
      sensitivity: [],
      resistance: [],
    });
    const patientWithCulture: Patient = { ...patientNoCulture, events: [cultureEvent] };
    rerender(<GuidelinesReviewTab patient={patientWithCulture} onWhy={vi.fn()} />);

    // Primer aislamiento de P. aeruginosa registrado: ers-rec-pico6 pasa a "applies" — cambio real de estado.
    expect(screen.getByText("Cambios recientes")).toBeInTheDocument();
    expect(screen.getAllByText("Actualizada").length).toBeGreaterThan(0);
    // La misma recomendación aparece en su bucket habitual y en el digest de "Cambios recientes" — nunca más de esas dos veces.
    expect(screen.getAllByText(eradicationText)).toHaveLength(2);
  });
});
