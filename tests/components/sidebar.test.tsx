/**
 * Sidebar — navegación principal centrada en el flujo clínico. "Guías"
 * ya no es una entrada principal (sigue accesible en /guias y desde
 * accesos secundarios — ver settingsView.test.tsx y
 * patientDetailTabs.test.tsx#GuidelinesReviewTab), nunca eliminada del
 * todo, solo sacada del menú.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/layout/Sidebar";

describe("Sidebar", () => {
  it("el menú principal queda centrado en el flujo clínico: Inicio, Pacientes, Argos, Configuración — exactamente 4 entradas", () => {
    render(<Sidebar alertCount={0} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.textContent)).toEqual(["Inicio", "Pacientes", "Argos", "Configuración"]);
  });

  it("'Guías' ya no aparece como opción principal del sidebar", () => {
    render(<Sidebar alertCount={0} />);
    expect(screen.queryByText("Guías")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /guías/i })).not.toBeInTheDocument();
  });

  it("cada entrada apunta a su ruta real de Next.js", () => {
    render(<Sidebar alertCount={0} />);
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Pacientes" })).toHaveAttribute("href", "/pacientes");
    expect(screen.getByRole("link", { name: /Argos/ })).toHaveAttribute("href", "/sentinel");
    expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute("href", "/configuracion");
  });

  it("el badge de alertas sigue apareciendo en Argos, sin verse afectado por quitar Guías del menú", () => {
    render(<Sidebar alertCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
