/**
 * SettingsView — acceso secundario a la biblioteca de guías tras
 * sacarla del sidebar principal (ver components/layout/Sidebar.tsx), y
 * "Datos de la sesión" (restaurar demo / vaciar lista) para preparar demos.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "@/components/settings/SettingsView";
import { PatientsProvider, usePatients } from "@/app/providers";

function PatientCount() {
  const { patients, createPatient } = usePatients();
  return (
    <>
      <div data-testid="count">{patients.length}</div>
      <button onClick={() => createPatient({ sex: "Mujer", age: 40, primaryDiagnosis: "Asma", secondaryDiagnoses: "" }, [])}>crear</button>
    </>
  );
}

function renderSettings() {
  return render(
    <PatientsProvider>
      <SettingsView />
      <PatientCount />
    </PatientsProvider>,
  );
}

describe("SettingsView", () => {
  it("ofrece un acceso claro a 'Base de conocimiento' que enlaza a /guias", () => {
    renderSettings();
    const link = screen.getByRole("link", { name: /Base de conocimiento/i });
    expect(link).toHaveAttribute("href", "/guias");
  });

  it("el acceso menciona las guías reales cargadas (ERS 2025, SEPAR 2018), no lenguaje de prototipo", () => {
    renderSettings();
    expect(screen.getByText(/ERS 2025, SEPAR 2018/)).toBeInTheDocument();
  });

  it("vaciar la lista pide confirmación en línea; cancelar no cambia nada", async () => {
    renderSettings();
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    await userEvent.click(screen.getByRole("button", { name: /Vaciar lista de pacientes/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Se eliminarán todos los pacientes/);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("vaciar y luego restaurar deja exactamente los 3 pacientes demo (descarta los creados en la sesión)", async () => {
    renderSettings();
    await userEvent.click(screen.getByRole("button", { name: "crear" }));
    expect(screen.getByTestId("count")).toHaveTextContent("4");

    await userEvent.click(screen.getByRole("button", { name: /Vaciar lista de pacientes/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, vaciar" }));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByText("0 pacientes en memoria. Los datos se pierden al recargar la página.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vaciar lista de pacientes/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Restaurar pacientes de demostración/ }));
    await userEvent.click(screen.getByRole("button", { name: "Sí, restaurar" }));
    expect(screen.getByTestId("count")).toHaveTextContent("3");
    expect(screen.getByRole("status")).toHaveTextContent("Pacientes de demostración restaurados.");
  });
});
