/**
 * GuidelinesView — pantalla "Guías" rediseñada como biblioteca REAL de
 * bases de conocimiento (ver engines/guidelines/library.ts), no una
 * lista simulada. Cubre explícitamente que ya no aparece ningún
 * lenguaje de "contenido simulado"/"prototipo", que las cifras
 * mostradas son las reales de la base de conocimiento, y que no se
 * filtran IDs técnicos.
 */
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuidelinesView } from "@/components/guidelines/GuidelinesView";
import { listActiveGuidelines } from "@/engines/guidelines/library";

describe("GuidelinesView", () => {
  it("usa el nuevo encabezado, sin lenguaje de desarrollo ni de contenido simulado", () => {
    render(<GuidelinesView />);
    expect(screen.getByText("Base de conocimiento clínico")).toBeInTheDocument();
    expect(screen.getByText(/trazabilidad de/)).toBeInTheDocument();
    expect(screen.queryByText(/contenido simulado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/estructura preparada/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pendiente de cargar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAG/)).not.toBeInTheDocument();
  });

  it("muestra ERS 2025 y SEPAR 2018 como 'Activa', con cifras reales de la base de conocimiento", () => {
    render(<GuidelinesView />);
    const [ers, separ] = listActiveGuidelines();
    expect(screen.getAllByText("Activa")).toHaveLength(2);
    expect(screen.getByText(ers.title)).toBeInTheDocument();
    expect(screen.getByText(separ.title)).toBeInTheDocument();
    // Cifras reales, no de relleno: el recuento de recomendaciones estructuradas coincide exactamente.
    expect(screen.getAllByText(String(ers.recommendationCount)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(separ.recommendationCount)).length).toBeGreaterThan(0);
  });

  it("nunca muestra un ID técnico (guidelineId) como texto visible", () => {
    render(<GuidelinesView />);
    expect(screen.queryByText("ers-bronchiectasis-2025")).not.toBeInTheDocument();
    expect(screen.queryByText("separ-bronchiectasis-2018")).not.toBeInTheDocument();
  });

  it("muestra EPOC y Fibrosis pulmonar como 'No disponible todavía', sin inventar un nombre de guía (GOLD, ATS/ERS/JRS/ALAT) ni recomendaciones para ellas", () => {
    render(<GuidelinesView />);
    expect(screen.getByText("EPOC")).toBeInTheDocument();
    expect(screen.getByText("Fibrosis pulmonar")).toBeInTheDocument();
    expect(screen.getAllByText("No disponible todavía")).toHaveLength(2);
    expect(screen.queryByText(/GOLD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ATS\/ERS\/JRS\/ALAT/)).not.toBeInTheDocument();
  });

  it("'Ver contenido' abre el detalle con metadatos, recomendaciones por tema y definiciones — misma base de conocimiento, sin IDs técnicos", async () => {
    render(<GuidelinesView />);
    const ersCard = screen.getByText(/European Respiratory Society clinical practice guideline/).closest('[class*="pv-card-hover"]') as HTMLElement;
    await userEvent.click(within(ersCard).getByRole("button", { name: /ver contenido/i }));

    expect(screen.getByText("Recomendaciones por tema")).toBeInTheDocument();
    expect(screen.getByText("Definiciones y referencias")).toBeInTheDocument();
    expect(screen.getByText(/Estado de integración/)).toBeInTheDocument();
    expect(screen.getByText(/Activa — utilizada por Revisión según guías y Argos/)).toBeInTheDocument();
    expect(screen.queryByText("ers-bronchiectasis-2025")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fuente bibliográfica/i })).toHaveAttribute("href", expect.stringContaining("doi.org"));
  });

  it("la búsqueda dentro de la guía filtra las recomendaciones mostradas", async () => {
    render(<GuidelinesView />);
    const ersCard = screen.getByText(/European Respiratory Society clinical practice guideline/).closest('[class*="pv-card-hover"]') as HTMLElement;
    await userEvent.click(within(ersCard).getByRole("button", { name: /ver contenido/i }));

    const totalBefore = screen.getAllByText(/^Aplica (a toda la población diana|según criterios clínicos)$/).length;
    await userEvent.type(screen.getByPlaceholderText(/Buscar por texto o tema/i), "aeruginosa");
    const totalAfter = screen.getAllByText(/^Aplica (a toda la población diana|según criterios clínicos)$/).length;
    expect(totalAfter).toBeLessThan(totalBefore);
    expect(totalAfter).toBeGreaterThan(0);
  });
});
