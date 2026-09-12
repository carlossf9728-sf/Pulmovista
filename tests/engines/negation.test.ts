/**
 * negation.ts — sin esto, HOSPITALIZATION_TRIGGER leía "ingresos" dentro
 * de "sin ingresos previos" como una hospitalización real (ver
 * engines/extraction/extractors/exacerbation.ts y resolveDates.ts).
 */
import { describe, expect, it } from "vitest";
import { captureHospitalizationFragment, mentionsHospitalization } from "@/engines/extraction/negation";

describe("mentionsHospitalization", () => {
  it("'sin ingresos previos' no cuenta como mención real", () => {
    expect(mentionsHospitalization("Refiere 2 exacerbaciones en el último año, sin ingresos previos.")).toBe(false);
  });

  it("'no requirió ingreso' tampoco cuenta", () => {
    expect(mentionsHospitalization("Exacerbación tratada ambulatoriamente, no requirió ingreso.")).toBe(false);
  });

  it("una mención real (sin negación) sí cuenta", () => {
    expect(mentionsHospitalization("Ingreso hospitalario por agudización grave.")).toBe(true);
  });

  it("formas verbales ('ingresa', 'ingresó') también cuentan, no solo el sustantivo 'ingreso'", () => {
    expect(mentionsHospitalization("Ingresa por agudización de bronquiectasias con fiebre.")).toBe(true);
    expect(mentionsHospitalization("Ingresó en planta de neumología.")).toBe(true);
  });

  it("una negación de un ingreso PREVIO no oculta un ingreso REAL en la misma frase", () => {
    expect(mentionsHospitalization("Sin ingresos previos, ingresa ahora por agudización grave.")).toBe(true);
  });

  it("'sin fiebre, ingreso por agudización' sigue contando el ingreso: la negación no es de la propia mención", () => {
    expect(mentionsHospitalization("Sin fiebre, ingreso por agudización de bronquiectasias.")).toBe(true);
  });
});

describe("captureHospitalizationFragment", () => {
  it("null cuando la única mención está negada", () => {
    expect(captureHospitalizationFragment("Refiere exacerbaciones previas, sin ingresos previos.")).toBeNull();
  });

  it("captura desde la mención REAL, no desde la negada, cuando ambas aparecen", () => {
    const result = captureHospitalizationFragment("Sin ingresos previos. Ingreso hospitalario por agudización grave, se inicia antibiótico IV.");
    expect(result?.fragment).toContain("Ingreso hospitalario por agudización grave");
    expect(result?.fragment).not.toContain("Sin ingresos previos");
  });
});
