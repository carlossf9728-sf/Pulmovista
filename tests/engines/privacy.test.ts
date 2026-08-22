import { describe, expect, it } from "vitest";
import { redactText, scanPrivacyShield } from "@/engines/privacy";

describe("scanPrivacyShield", () => {
  it("devuelve [] para texto vacío o ausente", () => {
    expect(scanPrivacyShield("")).toEqual([]);
    expect(scanPrivacyShield(null)).toEqual([]);
    expect(scanPrivacyShield(undefined)).toEqual([]);
  });

  it("detecta un email", () => {
    const findings = scanPrivacyShield("Contacto: paciente@ejemplo.com para dudas.");
    expect(findings.some((f) => f.key === "email")).toBe(true);
  });

  it("detecta un DNI", () => {
    const findings = scanPrivacyShield("DNI 12345678Z adjunto.");
    expect(findings.some((f) => f.key === "dni")).toBe(true);
  });

  it("detecta un nombre propio precedido de 'Paciente:'", () => {
    const findings = scanPrivacyShield("Paciente: Maria Garcia acude a revisión.");
    expect(findings.some((f) => f.key === "name")).toBe(true);
  });

  it("no genera falsos positivos sobre texto clínico limpio", () => {
    const findings = scanPrivacyShield("FEV1 78%. Cultivo de esputo con Pseudomonas aeruginosa. Se inicia azitromicina 250 mg.");
    expect(findings).toEqual([]);
  });
});

describe("redactText", () => {
  it("sustituye cada coincidencia por [DATO ELIMINADO]", () => {
    const text = "Contacto: paciente@ejemplo.com para dudas.";
    const findings = scanPrivacyShield(text);
    const redacted = redactText(text, findings);
    expect(redacted).not.toContain("paciente@ejemplo.com");
    expect(redacted).toContain("[DATO ELIMINADO]");
  });
});
