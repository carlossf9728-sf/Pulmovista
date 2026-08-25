/**
 * Tests de AddClinicalInfoModal — el cuadro único de "Añadir información
 * clínica": pegar texto desordenado, separar automáticamente sus
 * elementos (consulta, exacerbación, microbiología, PFR, imagen,
 * analítica, tratamiento…) y mostrar una vista de revisión donde el
 * médico confirma, corrige o descarta cada uno ANTES de que se guarde
 * nada. No se prueba la calidad clínica del motor de extracción (ya
 * cubierto en tests/engines/extraction.test.ts) — solo que la revisión
 * refleja fielmente lo detectado y que confirmar/editar/descartar cambia
 * exactamente lo que se guarda.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddClinicalInfoModal } from "@/components/patients/AddClinicalInfoModal";
import type { ClinicalEvent } from "@/types/clinicalEvent";

const RICH_TEXT =
  "Refiere una exacerbación moderada. Cultivo con Pseudomonas aeruginosa sensible a ciprofloxacino. FEV1 70%. " +
  "TC tórax con progresión leve de bronquiectasias. Analítica con PCR 30 mg/L. Se inicia azitromicina 250 mg lunes, miércoles y viernes.";

async function pasteAndContinue(text: string) {
  await userEvent.type(screen.getByPlaceholderText(/desde la última revisión/i), text, { delay: null });
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

function cardFor(titleMatch: RegExp): HTMLElement {
  const titleNode = screen.getByText(titleMatch);
  return titleNode.closest('[data-testid^="candidate-"]') as HTMLElement;
}

describe("AddClinicalInfoModal", () => {
  it("separa un texto desordenado en varios elementos distintos y nunca guarda nada antes de confirmar", async () => {
    const onAdd = vi.fn();
    render(<AddClinicalInfoModal onClose={vi.fn()} onAdd={onAdd} />);

    await pasteAndContinue(RICH_TEXT);

    // Un elemento por categoría — nunca un único bloque indiferenciado, y "Consulta" siempre presente aunque no la detecte el motor.
    expect(screen.getByText("Consulta")).toBeInTheDocument();
    expect(screen.getByText("Exacerbación")).toBeInTheDocument();
    expect(screen.getByText("Microbiología")).toBeInTheDocument();
    expect(screen.getByText("Función pulmonar")).toBeInTheDocument();
    expect(screen.getByText("Radiología")).toBeInTheDocument();
    // "Analítica" aparece dos veces en su propia tarjeta (categoría + etiqueta): basta con que exista.
    expect(screen.getAllByText("Analítica").length).toBeGreaterThan(0);
    expect(screen.getByText("Tratamiento")).toBeInTheDocument();

    // No se ha guardado nada todavía: la revisión es un paso previo, no un efecto secundario del "Continuar".
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("descartar un elemento hace que no se guarde, y el resto de elementos sí se guardan", async () => {
    const onAdd = vi.fn();
    render(<AddClinicalInfoModal onClose={vi.fn()} onAdd={onAdd} />);
    await pasteAndContinue(RICH_TEXT);

    const pftCard = cardFor(/^FEV1 70%$/);
    await userEvent.click(within(pftCard).getByRole("button", { name: /descartar/i }));

    await userEvent.click(screen.getByRole("button", { name: /^Guardar \d+ elementos?$/ }));

    expect(onAdd).toHaveBeenCalledOnce();
    const saved: ClinicalEvent[] = onAdd.mock.calls[0][0];
    expect(saved.some((e) => e.type === "pulmonary_function")).toBe(false);
    expect(saved.some((e) => e.type === "exacerbation")).toBe(true);
    expect(saved.some((e) => e.type === "microbiology")).toBe(true);
    expect(saved.some((e) => e.type === "consultation")).toBe(true);
  });

  it("permite corregir un dato mal extraído antes de guardarlo", async () => {
    const onAdd = vi.fn();
    render(<AddClinicalInfoModal onClose={vi.fn()} onAdd={onAdd} />);
    await pasteAndContinue(RICH_TEXT);

    // El motor solo distingue "Grave" (con ingreso) de "No especificada" (sin ingreso) — el texto no menciona ingreso, así que
    // el candidato extraído es "No especificada" aunque el propio texto diga "moderada": exactamente el tipo de dato a corregir.
    const exacCard = cardFor(/^Exacerbación no especificada$/);
    await userEvent.click(within(exacCard).getByRole("button", { name: /corregir/i }));
    const severityInput = within(exacCard).getByDisplayValue("No especificada");
    await userEvent.clear(severityInput);
    await userEvent.type(severityInput, "Moderada");

    await userEvent.click(screen.getByRole("button", { name: /^Guardar \d+ elementos?$/ }));
    const saved: ClinicalEvent[] = onAdd.mock.calls[0][0];
    const exac = saved.find((e) => e.type === "exacerbation");
    expect(exac).toMatchObject({ severity: "Moderada" });
  });

  it("un texto con datos identificativos pasa primero por el Escudo de privacidad antes de llegar a la revisión", async () => {
    render(<AddClinicalInfoModal onClose={vi.fn()} onAdd={vi.fn()} />);
    await pasteAndContinue("Paciente contacto@ejemplo.com refiere FEV1 70%.");

    expect(screen.getByText("Escudo de privacidad")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /eliminar y continuar/i }));

    // Tras limpiar el texto, se llega a la revisión con normalidad (el dato eliminado, no el flujo).
    expect(screen.getByText("Función pulmonar")).toBeInTheDocument();
  });

  it("'Atrás' vuelve al texto pegado sin perderlo, para poder ampliarlo antes de volver a revisar", async () => {
    render(<AddClinicalInfoModal onClose={vi.fn()} onAdd={vi.fn()} />);
    await pasteAndContinue(RICH_TEXT);
    await userEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByPlaceholderText(/desde la última revisión/i)).toHaveValue(RICH_TEXT);
  });
});
