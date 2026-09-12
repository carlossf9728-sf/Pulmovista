/**
 * SettingsView — acceso secundario a la biblioteca de guías tras
 * sacarla del sidebar principal (ver components/layout/Sidebar.tsx).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsView } from "@/components/settings/SettingsView";

describe("SettingsView", () => {
  it("ofrece un acceso claro a 'Base de conocimiento' que enlaza a /guias", () => {
    render(<SettingsView />);
    const link = screen.getByRole("link", { name: /Base de conocimiento/i });
    expect(link).toHaveAttribute("href", "/guias");
  });

  it("el acceso menciona las guías reales cargadas (ERS 2025, SEPAR 2018), no lenguaje de prototipo", () => {
    render(<SettingsView />);
    expect(screen.getByText(/ERS 2025, SEPAR 2018/)).toBeInTheDocument();
  });
});
