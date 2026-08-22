import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PatientCard } from "@/components/patients/PatientCard";
import { buildDemoPatients } from "@/data/demoPatients";

describe("PatientCard", () => {
  const [p1] = buildDemoPatients();

  it("muestra el código, diagnóstico y enlaza a la ficha del paciente", () => {
    render(<PatientCard patient={p1} />);
    expect(screen.getByText(p1.code)).toBeInTheDocument();
    expect(screen.getByText(p1.primaryDiagnosis)).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/pacientes/${p1.id}`);
  });

  it("muestra el pill de estado calculado por SentinelEngine", () => {
    render(<PatientCard patient={p1} />);
    // p1 tiene un hallazgo de confianza Alta (persistent-organism) => deterioro.
    expect(screen.getByText("Deterioro reciente")).toBeInTheDocument();
  });
});
