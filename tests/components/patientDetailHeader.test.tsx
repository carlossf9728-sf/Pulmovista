/**
 * Acciones de la cabecera de la ficha: "Copiar resumen" y
 * "Añadir información clínica" accesibles desde cualquier pestaña.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PatientDetailView } from "@/components/patient-detail/PatientDetailView";
import { PatientsProvider } from "@/app/providers";
import { buildDemoPatients } from "@/data/demoPatients";
import { buildPatientSummaryText } from "@/domain/patientSummary";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));

const [p1] = buildDemoPatients();

function renderDetail() {
  return render(
    <PatientsProvider>
      <PatientDetailView patient={p1} />
    </PatientsProvider>,
  );
}

describe("PatientDetailView — acciones de cabecera", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("'Copiar resumen' copia el resumen en texto plano y confirma con 'Resumen copiado'", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderDetail();
    await user.click(screen.getByRole("button", { name: /Copiar resumen/ }));
    expect(writeText).toHaveBeenCalledWith(buildPatientSummaryText(p1));
    expect(await screen.findByRole("button", { name: /Resumen copiado/ })).toBeInTheDocument();
  });

  it("si el portapapeles falla, lo dice en vez de fallar en silencio", async () => {
    const user = userEvent.setup();
    writeText.mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderDetail();
    await user.click(screen.getByRole("button", { name: /Copiar resumen/ }));
    expect(await screen.findByRole("button", { name: /No se pudo copiar/ })).toBeInTheDocument();
  });

  it("'Añadir información clínica' abre el cuadro desde la pestaña Resumen, sin ir a Consultas", async () => {
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("button", { name: /Añadir información clínica/ }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Qué ha cambiado desde la última consulta")).toBeInTheDocument();
  });
});
