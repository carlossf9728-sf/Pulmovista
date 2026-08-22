/**
 * Test de integración de los datos de demostración: confirma que la
 * transcripción de los 3 pacientes ficticios reproduce los mismos
 * resultados que el prototipo original al pasar por los motores
 * (paridad funcional), no solo que los datos tengan la forma correcta.
 */
import { describe, expect, it } from "vitest";
import { buildDemoPatients } from "@/data/demoPatients";
import { selectConsultations, selectExacerbations, selectMicrobiology, selectPFT, selectTreatments } from "@/domain/selectors";
import { detectContradictions } from "@/engines/longitudinal";
import { patientStatus } from "@/engines/sentinel";

describe("buildDemoPatients", () => {
  const patients = buildDemoPatients();
  const [p1, p2, p3] = patients;

  it("crea 3 pacientes ficticios con los códigos PulmoVista esperados", () => {
    expect(patients).toHaveLength(3);
    expect(patients.map((p) => p.code)).toEqual(["PV-7K2F-Q9MX", "PV-4M9D-L2QT", "PV-9R5K-B7NF"]);
  });

  it("paciente 1 (bronquiectasias): recuentos de eventos esperados", () => {
    expect(selectConsultations(p1.events)).toHaveLength(4);
    expect(selectPFT(p1.events)).toHaveLength(7);
    expect(selectMicrobiology(p1.events)).toHaveLength(4);
    expect(selectExacerbations(p1.events)).toHaveLength(7);
    const treatments = selectTreatments(p1.events);
    expect(treatments).toHaveLength(3);
    expect(treatments.every((t) => t.status === "Activo")).toBe(true);
  });

  it("paciente 2 (EPOC): recuentos de eventos esperados", () => {
    expect(selectConsultations(p2.events)).toHaveLength(4);
    expect(selectPFT(p2.events)).toHaveLength(6);
    expect(selectExacerbations(p2.events)).toHaveLength(7);
    const treatments = selectTreatments(p2.events);
    const rehab = treatments.find((t) => t.name.toLowerCase().includes("rehabilitación"));
    expect(rehab?.status).toBe("Finalizado");
  });

  it("paciente 2: reproduce la contradicción de FEV1 introducida deliberadamente (ago-sep 2025)", () => {
    const findings = detectContradictions(p2);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.message.includes("1.02") && f.message.includes("1.38"))).toBe(true);
  });

  it("paciente 3 (fibrosis pulmonar): recuentos de eventos esperados", () => {
    expect(selectConsultations(p3.events)).toHaveLength(4);
    expect(selectPFT(p3.events)).toHaveLength(5);
    expect(selectMicrobiology(p3.events)).toHaveLength(0);
  });

  it("patientStatus reproduce el estado esperado para cada paciente demo", () => {
    // p1: FEV1 71->69->68 (caída moderada) + Pseudomonas aeruginosa aislada
    // 3 veces (persistent-organism confianza Alta) => deterioro.
    expect(patientStatus(p1)).toBe("deterioro");
    // p2 y p3: hallazgos Sentinel presentes pero ninguno de confianza Alta => revisión.
    expect(patientStatus(p2)).toBe("revision");
    expect(patientStatus(p3)).toBe("revision");
  });
});
