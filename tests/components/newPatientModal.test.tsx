/**
 * Tests de NewPatientModal — mismo patrón que AddClinicalInfoModal
 * (extraer -> revisar/corregir -> confirmar -> guardar), aplicado al
 * alta inicial de paciente: el texto clínico inicial no se guarda
 * automáticamente sin pasar por la vista de revisión.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import type { ClinicalEvent } from "@/types/clinicalEvent";
import type { NewPatientInput } from "@/types/patient";

async function fillFormAndContinue(diagnosis: string, text: string) {
  await userEvent.type(screen.getByPlaceholderText(/bronquiectasias no FQ/i), diagnosis);
  if (text) {
    await userEvent.type(screen.getByPlaceholderText(/pegue aquí la información clínica desordenada/i), text, { delay: null });
  }
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

function cardFor(titleMatch: RegExp): HTMLElement {
  return screen.getByText(titleMatch).closest('[data-testid^="candidate-"]') as HTMLElement;
}

describe("NewPatientModal", () => {
  it("no crea el paciente al pulsar 'Continuar': primero muestra la revisión de lo detectado", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("Bronquiectasias no FQ", "FEV1 72%. Cultivo con Pseudomonas aeruginosa.");

    expect(screen.getByText("Consulta / evolución")).toBeInTheDocument();
    expect(screen.getByText("Función pulmonar")).toBeInTheDocument();
    expect(screen.getByText("Microbiología")).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("descartar un candidato hace que no se cree con ese dato, y confirma con los datos demográficos correctos", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("Bronquiectasias no FQ", "FEV1 72%. Cultivo con Pseudomonas aeruginosa.");

    const pftCard = cardFor(/^FEV1 72%$/);
    await userEvent.click(within(pftCard).getByRole("button", { name: /descartar/i }));

    await userEvent.click(screen.getByRole("button", { name: /^Crear expediente \(\d+\)$/ }));

    expect(onCreate).toHaveBeenCalledOnce();
    const [input, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(input.primaryDiagnosis).toBe("Bronquiectasias no FQ");
    expect(events.some((e) => e.type === "pulmonary_function")).toBe(false);
    expect(events.some((e) => e.type === "microbiology")).toBe(true);
    expect(events.some((e) => e.type === "consultation")).toBe(true);
  });

  it("un alta sin texto clínico igualmente pasa por la revisión (con solo la consulta vacía como candidato) antes de crear el expediente", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("EPOC", "");

    expect(onCreate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^Crear expediente \(\d+\)$/ }));
    expect(onCreate).toHaveBeenCalledOnce();
    const [, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("consultation");
  });

  it("un texto con datos identificativos pasa primero por el Escudo de privacidad antes de llegar a la revisión", async () => {
    render(<NewPatientModal onClose={vi.fn()} onCreate={vi.fn()} />);
    await fillFormAndContinue("Bronquiectasias no FQ", "Paciente contacto@ejemplo.com. FEV1 72%.");

    expect(screen.getByText("Escudo de privacidad")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /eliminar y continuar/i }));
    expect(screen.getByText("Función pulmonar")).toBeInTheDocument();
  });

  it("'Continuar' está deshabilitado sin diagnóstico principal", () => {
    render(<NewPatientModal onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });
});
