import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryTab } from "@/components/patient-detail/SummaryTab";
import { TimelineTab } from "@/components/patient-detail/TimelineTab";
import { MicrobiologyTab } from "@/components/patient-detail/MicrobiologyTab";
import { TreatmentsTab } from "@/components/patient-detail/TreatmentsTab";
import { ImagingTab } from "@/components/patient-detail/ImagingTab";
import { ConsultsTab } from "@/components/patient-detail/ConsultsTab";
import { AlertsTab } from "@/components/patient-detail/AlertsTab";
import { GuidelinesReviewTab } from "@/components/patient-detail/GuidelinesReviewTab";
import { buildDemoPatients } from "@/data/demoPatients";
import type { Patient } from "@/types/patient";

const [p1, p2, p3] = buildDemoPatients();

describe("SummaryTab", () => {
  it("muestra la situación actual y los cambios desde la última consulta", () => {
    render(<SummaryTab patient={p1} />);
    expect(screen.getByText("Situación actual")).toBeInTheDocument();
    expect(screen.getByText("Qué ha cambiado desde la última consulta")).toBeInTheDocument();
    // p1 tiene 4 consultas: debe haber comparación, no el mensaje de "aún no hay suficientes".
    expect(screen.queryByText("Aún no hay suficientes consultas para comparar.")).not.toBeInTheDocument();
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
});

describe("TreatmentsTab", () => {
  it("muestra el estado Activo/Finalizado de cada tratamiento", () => {
    render(<TreatmentsTab patient={p1} />);
    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);
  });
});

describe("ImagingTab", () => {
  it("señala un cambio respecto al informe anterior cuando el texto difiere", () => {
    render(<ImagingTab patient={p1} />);
    expect(screen.getAllByText("Cambio respecto al informe anterior").length).toBeGreaterThan(0);
  });
});

describe("ConsultsTab", () => {
  it("invoca onAddConsultation al pulsar el botón", async () => {
    const onAdd = vi.fn();
    render(<ConsultsTab patient={p1} onAddConsultation={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: /añadir nueva consulta/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe("AlertsTab", () => {
  it("Sentinel muestra hallazgos objetivos con interpretación respaldada por guía (ya no heurística legacy) y permite abrir '¿Por qué?'", async () => {
    const onWhy = vi.fn();
    render(<AlertsTab patient={p1} onWhy={onWhy} />);
    expect(screen.getByText("Aislamiento microbiológico persistente")).toBeInTheDocument();
    // El dato objetivo de FEV1 se muestra sin interpretación respaldada (sin soporte de guía para ese cambio).
    expect(screen.getByText("No se ha encontrado soporte suficiente en las guías cargadas para interpretar clínicamente este hallazgo.")).toBeInTheDocument();
    // Traducción a lenguaje clínico — nunca el término técnico "GuidelineMatch".
    expect(screen.getByText("Cumple")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("GuidelineMatch");

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
  it("agrupa las recomendaciones de ERS/SEPAR por estado y permite abrir '¿Por qué?' con trazabilidad completa", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    // p1 tiene bronquiectasias con asma, exacerbaciones y aislamientos de P. aeruginosa:
    // produce ejemplos reales en varios de los 4 estados.
    expect(screen.getByText("Aplicables")).toBeInTheDocument();
    expect(screen.getByText("Posiblemente aplicables")).toBeInTheDocument();
    expect(screen.getByText("Información insuficiente")).toBeInTheDocument();
    expect(screen.getByText("No aplicables")).toBeInTheDocument();
    // ers-rec-pico1 (sin criterios acotados) siempre aplica a un paciente con bronquiectasias.
    expect(screen.getByText(/patients with bronchiectasis should be taught airway clearance techniques/i)).toBeInTheDocument();

    // Cada tarjeta distingue tres cosas con su propio rótulo, no un único bloque indiferenciado.
    expect(screen.getAllByText("Dato del paciente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Interpretación de PulmoVista").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recomendación de la guía").length).toBeGreaterThan(0);

    const [firstWhyButton] = screen.getAllByRole("button", { name: /por qué/i });
    await userEvent.click(firstWhyButton);
    expect(onWhy).toHaveBeenCalledOnce();
    const explanation = onWhy.mock.calls[0][0];
    expect(explanation.source.kind).toBe("guideline");
    // Cadena completa: dato → criterio clínico → interpretación de PulmoVista → recomendación → fuente (bloque aparte, no una sección más).
    expect(explanation.sections.map((s: { label: string }) => s.label)).toEqual([
      "Dato del paciente",
      "Criterio clínico de la guía",
      "Interpretación de PulmoVista",
      "Recomendación",
    ]);
    expect(explanation.citation).toBeDefined();
    expect(explanation.citation.sourceText.length).toBeGreaterThan(0);
    expect(explanation.citation.year).toBeGreaterThan(2000);
    // "GuidelineMatch" nunca aparece como término visible.
    expect(JSON.stringify(explanation)).not.toContain("GuidelineMatch");
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

  it("una recomendación GENERAL (ers-rec-pico1) muestra el diagnóstico como dato y nunca dice 'cumple el criterio clínico'", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    const generalCardText = screen.getByText(/patients with bronchiectasis should be taught airway clearance techniques/i);
    const card = generalCardText.closest(".pv-card-hover") as HTMLElement;
    expect(card).toBeTruthy();
    // Diagnóstico registrado del paciente, visible como dato en la propia tarjeta.
    expect(within(card).getByText(new RegExp(p1.primaryDiagnosis))).toBeInTheDocument();
    expect(within(card).getByText(/aplica de forma general/i)).toBeInTheDocument();
    expect(within(card).queryByText(/cumple el criterio clínico/i)).not.toBeInTheDocument();

    const whyButton = within(card).getByRole("button", { name: /por qué/i });
    await userEvent.click(whyButton);
    const explanation = onWhy.mock.calls.at(-1)?.[0];
    expect(explanation.sections.find((s: { label: string }) => s.label === "Dato del paciente").text).toContain(p1.primaryDiagnosis);
    expect(explanation.sections.find((s: { label: string }) => s.label === "Interpretación de PulmoVista").text).not.toContain("cumple el criterio clínico");
  });

  it("oculta bloques de criterios vacíos y el encabezado 'Evidencias' cuando no hay evidencia adicional", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    // Nunca debe aparecer un bloque "Ninguno."/"Ninguna." en ninguna tarjeta.
    expect(screen.queryByText("Ninguno.")).not.toBeInTheDocument();
    expect(screen.queryByText("Ninguna.")).not.toBeInTheDocument();

    const generalCardText = screen.getByText(/patients with bronchiectasis should be taught airway clearance techniques/i);
    const card = generalCardText.closest(".pv-card-hover") as HTMLElement;
    await userEvent.click(within(card).getByRole("button", { name: /por qué/i }));
    const explanation = onWhy.mock.calls.at(-1)?.[0];
    // ers-rec-pico1 no tiene ninguna evidencia estructurada asociada (criteria/exclusions/prerequisites vacíos): sin "Evidencias".
    expect(explanation.evidence).toEqual([]);
    expect(screen.queryByText("Evidencias")).not.toBeInTheDocument();
  });

  it("nunca muestra el encabezado 'Evidencias' ni una lista cruda de eventos, ni siquiera cuando la recomendación sí tiene evidencia estructurada", async () => {
    const onWhy = vi.fn();
    render(<GuidelinesReviewTab patient={p1} onWhy={onWhy} />);
    const whyButtons = screen.getAllByRole("button", { name: /por qué/i });
    // Recorre todas las tarjetas (no solo la primera general): en ninguna debe aparecer "Evidencias" ni una línea con fecha suelta ("dd/mm/aaaa — ...").
    for (const button of whyButtons) {
      await userEvent.click(button);
      const explanation = onWhy.mock.calls.at(-1)?.[0];
      const datoDelPaciente = explanation.sections.find((s: { label: string }) => s.label === "Dato del paciente").text;
      expect(datoDelPaciente).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
    expect(screen.queryByText("Evidencias")).not.toBeInTheDocument();
  });
});
