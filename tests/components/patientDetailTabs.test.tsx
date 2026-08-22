import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryTab } from "@/components/patient-detail/SummaryTab";
import { TimelineTab } from "@/components/patient-detail/TimelineTab";
import { MicrobiologyTab } from "@/components/patient-detail/MicrobiologyTab";
import { TreatmentsTab } from "@/components/patient-detail/TreatmentsTab";
import { ImagingTab } from "@/components/patient-detail/ImagingTab";
import { ConsultsTab } from "@/components/patient-detail/ConsultsTab";
import { AlertsTab } from "@/components/patient-detail/AlertsTab";
import { buildDemoPatients } from "@/data/demoPatients";

const [p1, , p3] = buildDemoPatients();

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
  it("muestra los hallazgos de Sentinel con su fuente legacy y permite abrir '¿Por qué?'", async () => {
    const onWhy = vi.fn();
    render(<AlertsTab patient={p1} onWhy={onWhy} />);
    expect(screen.getByText("Aislamiento microbiológico persistente")).toBeInTheDocument();
    expect(screen.getAllByText("heurística experimental").length).toBeGreaterThan(0);
    const [firstWhyButton] = screen.getAllByRole("button", { name: /por qué/i });
    await userEvent.click(firstWhyButton);
    expect(onWhy).toHaveBeenCalledOnce();
    const explanation = onWhy.mock.calls[0][0];
    expect(explanation.source.kind).toBe("legacy_heuristic");
  });
});
