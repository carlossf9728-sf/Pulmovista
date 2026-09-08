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
  it("no crea el paciente al pulsar 'Continuar': primero muestra la revisión de lo detectado, sin Consulta cuando el texto no narra nada (solo datos objetivos)", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("Bronquiectasias no FQ", "FEV1 72%. Cultivo con Pseudomonas aeruginosa.");

    expect(screen.getByText("Función pulmonar")).toBeInTheDocument();
    expect(screen.getByText("Microbiología")).toBeInTheDocument();
    expect(screen.queryByText("Consulta / evolución")).not.toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("descartar un candidato hace que no se cree con ese dato, y confirma con los datos demográficos correctos", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("Bronquiectasias no FQ", "FEV1 72%. Cultivo con Pseudomonas aeruginosa.");

    const pftCard = cardFor(/^FEV1 72%$/);
    await userEvent.click(within(pftCard).getByRole("button", { name: /descartar/i }));

    await userEvent.click(screen.getByRole("button", { name: /^Crear expediente/ }));

    expect(onCreate).toHaveBeenCalledOnce();
    const [input, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(input.primaryDiagnosis).toBe("Bronquiectasias no FQ");
    expect(events.some((e) => e.type === "pulmonary_function")).toBe(false);
    expect(events.some((e) => e.type === "microbiology")).toBe(true);
    // Este texto no tiene narrativa clínica ("FEV1 72%. Cultivo con Pseudomonas aeruginosa." es puro dato objetivo) — no hay Consulta que crear ni que descartar.
    expect(events.some((e) => e.type === "consultation")).toBe(false);
  });

  it("un alta sin texto clínico no genera ningún evento ficticio ('Consulta' ni ningún otro) — la demografía del paciente no implica que haya ocurrido una consulta", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("EPOC", "");

    expect(screen.getByText(/no ha identificado ningún evento clínico/i)).toBeInTheDocument();
    expect(screen.queryByText("Consulta / evolución")).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/^candidate-/)).toHaveLength(0);

    expect(onCreate).not.toHaveBeenCalled();
    // Sin candidatos, el botón no lleva contador — "Crear expediente" a secas — y sigue permitiendo crear el expediente (solo con demografía).
    await userEvent.click(screen.getByRole("button", { name: "Crear expediente" }));
    expect(onCreate).toHaveBeenCalledOnce();
    const [input, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(input.primaryDiagnosis).toBe("EPOC");
    expect(events).toHaveLength(0);
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

/**
 * Mismo criterio que AddClinicalInfoModal (ver
 * tests/components/addClinicalInfoModal.test.tsx): un evento clínico
 * solo existe si el contenido del alta inicial permite identificarlo —
 * "Consulta/evolución" nunca es un relleno automático del alta, ni
 * siquiera con texto vacío.
 */
describe("NewPatientModal — 'Consulta/evolución' solo con narrativa real, nunca por defecto en el alta inicial", () => {
  it.each([
    ["Cultivo positivo para Pseudomonas aeruginosa.", "Microbiología"],
    ["TC tórax: sin cambios respecto al previo.", "Radiología"],
    ["FEV1 1,62 L (61%).", "Función pulmonar"],
  ])("un alta inicial con '%s' crea solo %s, sin Consulta", async (text, expectedGroup) => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("Bronquiectasias no FQ", text);

    expect(screen.getAllByText(expectedGroup).length).toBeGreaterThan(0);
    expect(screen.queryByText("Consulta / evolución")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^candidate-/)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /^Crear expediente/ }));
    const [, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(events).toHaveLength(1);
    expect(events[0].type).not.toBe("consultation");
  });

  it("un alta inicial puramente narrativa ('Acude por...') sí crea Consulta, aunque no haya ninguna categoría objetiva", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue("Bronquiectasias no FQ", "Acude por aumento de disnea y expectoración purulenta en la última semana.");

    expect(screen.getByText("Consulta / evolución")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^candidate-/)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /^Crear expediente/ }));
    const [, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("consultation");
  });

  it("un alta inicial con narrativa + dato objetivo crea Consulta Y la categoría específica", async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal onClose={vi.fn()} onCreate={onCreate} />);
    await fillFormAndContinue(
      "Bronquiectasias no FQ",
      "Acude por aumento de disnea y expectoración purulenta. Cultivo positivo para Pseudomonas aeruginosa.",
    );

    expect(screen.getByText("Consulta / evolución")).toBeInTheDocument();
    expect(screen.getByText("Microbiología")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^candidate-/)).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: /^Crear expediente/ }));
    const [, events] = onCreate.mock.calls[0] as [NewPatientInput, ClinicalEvent[]];
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.type === "consultation")).toBe(true);
    expect(events.some((e) => e.type === "microbiology")).toBe(true);
  });
});
