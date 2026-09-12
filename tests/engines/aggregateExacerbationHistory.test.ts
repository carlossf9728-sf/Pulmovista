/**
 * extractAggregateExacerbationHistory (engines/extraction/extractors/exacerbation.ts)
 * — el antecedente agregado ("2 exacerbaciones... en el último año") es
 * un dato DISTINTO de un episodio clínico fechado: se conserva como
 * recuento estructurado (ver ConsultationEvent#priorExacerbationCount/
 * priorHospitalizationCount), nunca como ExacerbationEvent individual ni
 * como fecha inventada, y nunca se descarta en silencio.
 */
import { describe, expect, it } from "vitest";
import { extractAggregateExacerbationHistory, hasGenuineExplicitExacerbation } from "@/engines/extraction/extractors/exacerbation";

describe("extractAggregateExacerbationHistory", () => {
  it("extrae la cifra en dígitos y la negación explícita de ingresos", () => {
    const r = extractAggregateExacerbationHistory("Refiere 2 exacerbaciones tratadas con antibiótico en el último año, sin ingresos previos.");
    expect(r).toMatchObject({ priorExacerbationCount: 2, priorHospitalizationCount: 0 });
  });

  it("extrae la cifra en palabra ('tres')", () => {
    const r = extractAggregateExacerbationHistory("Antecedente de tres agudizaciones previas, sin ingresos.");
    expect(r?.priorExacerbationCount).toBe(3);
  });

  it("priorHospitalizationCount es null (no consta), nunca 0, cuando el texto no menciona ingresos en absoluto", () => {
    const r = extractAggregateExacerbationHistory("Refiere 2 exacerbaciones en el último año.");
    expect(r?.priorExacerbationCount).toBe(2);
    expect(r?.priorHospitalizationCount).toBeNull();
  });

  it("priorHospitalizationCount es null (no se inventa un recuento) cuando la propia frase menciona un ingreso REAL, no negado", () => {
    const r = extractAggregateExacerbationHistory("Refiere 3 exacerbaciones con 1 ingreso hospitalario el año pasado.");
    expect(r?.priorExacerbationCount).toBe(3);
    expect(r?.priorHospitalizationCount).toBeNull();
  });

  it("'varias'/'múltiples' (sin cifra concreta) no inventan un número: priorExacerbationCount es null", () => {
    const r1 = extractAggregateExacerbationHistory("Refiere varias exacerbaciones previas, sin ingresos.");
    const r2 = extractAggregateExacerbationHistory("Antecedente de múltiples agudizaciones, sin ingresos.");
    expect(r1?.priorExacerbationCount).toBeNull();
    expect(r2?.priorExacerbationCount).toBeNull();
  });

  it("null cuando no hay ningún recuento agregado en el texto (episodio real, singular, sin cuantificador)", () => {
    expect(extractAggregateExacerbationHistory("Presenta una exacerbación grave con fiebre.")).toBeNull();
  });

  it("encuentra la frase agregada aunque el segmento combine varias frases, sin confundirla con una frase distinta no agregada", () => {
    const text = "Antecedentes: refiere 3 agudizaciones en el último año, sin ingresos previos. Ingreso hospitalario por agudización grave, se inicia antibiótico IV.";
    const r = extractAggregateExacerbationHistory(text);
    expect(r?.priorExacerbationCount).toBe(3);
    expect(r?.fragment).toContain("3 agudizaciones");
    expect(r?.fragment).not.toContain("Ingreso hospitalario");
  });
});

describe("hasGenuineExplicitExacerbation", () => {
  it("false para una frase que es puramente un recuento agregado", () => {
    expect(hasGenuineExplicitExacerbation("Refiere 2 exacerbaciones en el último año, sin ingresos previos.")).toBe(false);
  });

  it("true para un episodio real, aunque el mismo segmento también traiga una frase agregada distinta", () => {
    const text = "Refiere 2 exacerbaciones en el último año. Ingresa ahora por agudización grave con fiebre.";
    expect(hasGenuineExplicitExacerbation(text)).toBe(true);
  });

  it("true para 'una exacerbación' (singular): sigue pudiendo ser un episodio real, nunca se trata como agregado", () => {
    expect(hasGenuineExplicitExacerbation("Presenta una exacerbación grave que requiere ingreso.")).toBe(true);
  });
});
