import { describe, expect, it } from "vitest";
import { classifySegment } from "@/engines/extraction/classify";
import { segmentClinicalText } from "@/engines/extraction/segment";
import type { TextSegment } from "@/engines/extraction/segmentPatterns";

function segment(text: string, overrides: Partial<TextSegment> = {}): TextSegment {
  return { text, headerCategory: null, startsNewEpisode: false, temporalLabel: null, ...overrides };
}

describe("classifySegment", () => {
  it("un segmento con encabezado confía en él, sin re-escanear disparadores léxicos", () => {
    // Contenido que también mencionaría "consulta" si se re-escaneara — el encabezado manda.
    const s = segment("Se revisa el cultivo de la última consulta.", { headerCategory: "radiologia" });
    expect(classifySegment(s)).toEqual(["radiologia"]);
  });

  it("un segmento sin encabezado con una sola señal léxica devuelve una única categoría", () => {
    expect(classifySegment(segment("FEV1 70%. FVC 85%."))).toEqual(["funcion_pulmonar"]);
    expect(classifySegment(segment("Cultivo positivo para Pseudomonas aeruginosa."))).toEqual(["microbiologia"]);
  });

  it("un segmento sin encabezado que mezcla varias categorías las devuelve todas", () => {
    const categories = classifySegment(segment("Refiere mayor disnea y se pauta ciprofloxacino."));
    expect(categories).toContain("consulta");
    expect(categories).toContain("exacerbacion");
  });

  it("un segmento de exacerbación cuya única 'narrativa de consulta' es la propia frase de la agudización NO añade 'consulta' (evita un evento casi vacío duplicado)", () => {
    const categories = classifySegment(
      segment("Ingreso hospitalario por agudización de bronquiectasias con fiebre y aumento de expectoración purulenta."),
    );
    expect(categories).toContain("exacerbacion");
    expect(categories).not.toContain("consulta");
  });

  it("un segmento de exacerbación que SÍ trae narrativa de consulta distinta (además de las señales de agudización) añade ambas categorías", () => {
    const categories = classifySegment(segment("Refiere aumento de expectoración purulenta compatible con agudización."));
    expect(categories).toContain("exacerbacion");
    expect(categories).toContain("consulta");
  });

  it("un segmento sin ningún disparador reconocido devuelve una lista vacía (contenido sin clasificar)", () => {
    expect(classifySegment(segment("Firmado electrónicamente. Documento generado automáticamente."))).toEqual([]);
  });

  it("un encabezado 'ingreso' cuyo contenido menciona explícitamente una agudización también detecta 'exacerbacion' (para poder abrir el episodio)", () => {
    const s = segment("Ingreso hospitalario por agudización de bronquiectasias con fiebre.", { headerCategory: "ingreso" });
    expect(classifySegment(s)).toEqual(["ingreso", "exacerbacion"]);
  });

  it("un encabezado 'ingreso' sin mención de exacerbación NO añade 'exacerbacion'", () => {
    const s = segment("Ingreso programado para estudio funcional.", { headerCategory: "ingreso" });
    expect(classifySegment(s)).toEqual(["ingreso"]);
  });

  it("un encabezado 'alta' cuyo contenido menciona un fármaco conocido también detecta 'tratamiento'", () => {
    const s = segment("Se pauta azitromicina de mantenimiento al alta.", { headerCategory: "alta" });
    expect(classifySegment(s)).toEqual(["alta", "tratamiento"]);
  });

  it("un encabezado 'alta' sin mención de tratamiento no añade nada más", () => {
    const s = segment("Buena evolución clínica, revisión en un mes.", { headerCategory: "alta" });
    expect(classifySegment(s)).toEqual(["alta"]);
  });

  it("integración con segmentClinicalText: un bloque con encabezados reales se clasifica segmento a segmento sin cruces", () => {
    const segments = segmentClinicalText("Microbiología:\nCultivo con Pseudomonas aeruginosa.\n\nTratamiento:\nSe inicia tobramicina inhalada.");
    expect(segments.map((s) => classifySegment(s))).toEqual([["microbiologia"], ["tratamiento"]]);
  });
});
