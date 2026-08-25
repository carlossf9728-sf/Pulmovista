import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card, DataConfidenceBadge, KindTag, StatusPill, Val, WhyButton, WhyModal } from "@/components/ui";
import type { ClinicalExplanation } from "@/types/evidence";

describe("Val", () => {
  it("muestra 'No disponible' en cursiva para valores ausentes", () => {
    render(<Val value={null} />);
    expect(screen.getByText("No disponible")).toBeInTheDocument();
  });
  it("muestra el valor con sufijo cuando está presente", () => {
    render(<Val value={78} suffix="%" />);
    expect(screen.getByText("78%")).toBeInTheDocument();
  });
});

describe("StatusPill", () => {
  it("muestra la etiqueta correspondiente a cada estado", () => {
    render(<StatusPill status="deterioro" />);
    expect(screen.getByText("Deterioro reciente")).toBeInTheDocument();
  });
});

describe("KindTag / DataConfidenceBadge", () => {
  it("KindTag muestra la etiqueta de tipo", () => {
    render(<KindTag kind="heurística experimental" />);
    expect(screen.getByText("heurística experimental")).toBeInTheDocument();
  });
  it("DataConfidenceBadge muestra siempre la señal simple 'Revisar' (nunca la taxonomía técnica ni un porcentaje), con el motivo como title", () => {
    render(<DataConfidenceBadge reason="motivo de ejemplo" />);
    expect(screen.getByText("Revisar")).toBeInTheDocument();
    expect(screen.getByTitle("motivo de ejemplo")).toBeInTheDocument();
    expect(screen.queryByText(/posible|probable|incompleto|contradictorio|%/i)).not.toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renderiza sus children", () => {
    render(<Card>contenido</Card>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("reenvía className junto con pv-card-hover (bug técnico corregido, no clínico)", () => {
    render(<Card className="pv-fade-in">contenido</Card>);
    const el = screen.getByText("contenido");
    expect(el.className).toContain("pv-fade-in");
    expect(el.className).toContain("pv-card-hover");
  });

  it("no añade pv-card-hover cuando hover=false, pero conserva className", () => {
    render(
      <Card hover={false} className="pv-fade-in">
        contenido
      </Card>,
    );
    const el = screen.getByText("contenido");
    expect(el.className).toBe("pv-fade-in");
  });
});

describe("WhyButton", () => {
  it("invoca onClick al pulsarse", async () => {
    const onClick = vi.fn();
    render(<WhyButton onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /por qué/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("WhyModal", () => {
  it("no renderiza nada si data es null", () => {
    const { container } = render(<WhyModal data={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza las secciones de un ClinicalExplanation, sin mostrar la lista cruda de evidencia", () => {
    const explanation: ClinicalExplanation = {
      kindLabel: "heurística experimental",
      source: { kind: "legacy_heuristic", ruleId: "test-rule", label: "Regla de prueba" },
      sections: [
        { label: "Dato", text: "FEV1 80% -> 70%", emphasis: true },
        { label: "Interpretación", text: "Tendencia descendente." },
      ],
      // La evidencia estructurada se conserva en el objeto para trazabilidad interna,
      // pero WhyModal ya no la renderiza (sin encabezado "Evidencias" ni lista de eventos).
      evidence: [{ label: "01/01/2024 — FEV1 80%" }, { label: "01/06/2024 — FEV1 70%" }],
    };
    render(<WhyModal data={explanation} onClose={() => {}} />);
    expect(screen.getByText("¿Por qué?")).toBeInTheDocument();
    expect(screen.getByText("heurística experimental")).toBeInTheDocument();
    expect(screen.getByText("FEV1 80% -> 70%")).toBeInTheDocument();
    expect(screen.getByText("Tendencia descendente.")).toBeInTheDocument();
    expect(screen.queryByText("Evidencias")).not.toBeInTheDocument();
    expect(screen.queryByText("01/01/2024 — FEV1 80%")).not.toBeInTheDocument();
  });
});
