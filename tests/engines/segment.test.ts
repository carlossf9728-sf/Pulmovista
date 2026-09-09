import { describe, expect, it } from "vitest";
import { segmentClinicalText } from "@/engines/extraction/segment";

describe("segmentClinicalText", () => {
  it("sin ningún encabezado ni transición temporal, devuelve un único segmento con todo el texto", () => {
    const text = "Refiere aumento de disnea. Cultivo positivo para Pseudomonas aeruginosa.";
    const segments = segmentClinicalText(text);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe(text);
    expect(segments[0].headerCategory).toBeNull();
    expect(segments[0].startsNewEpisode).toBe(false);
  });

  it("un encabezado con contenido en la misma línea arranca un segmento propio, y el contenido tras ':' se conserva", () => {
    const text = "Tratamiento: Se inicia ciprofloxacino 750 mg/12 h.";
    const segments = segmentClinicalText(text);
    expect(segments).toHaveLength(1);
    expect(segments[0].headerCategory).toBe("tratamiento");
    expect(segments[0].text).toBe("Se inicia ciprofloxacino 750 mg/12 h.");
  });

  it("un encabezado solo en su línea, con el contenido en las líneas siguientes, agrupa todo en un mismo segmento", () => {
    const text = "Analítica:\nSrm-Leucocitos 9.500/µL [4000 - 11000]\nSrm-PCR 12 mg/L [0 - 5]";
    const segments = segmentClinicalText(text);
    expect(segments).toHaveLength(1);
    expect(segments[0].headerCategory).toBe("analitica");
    expect(segments[0].text).toBe("Srm-Leucocitos 9.500/µL [4000 - 11000]\nSrm-PCR 12 mg/L [0 - 5]");
  });

  it("una palabra de encabezado dentro de una frase normal (sin ':' ni línea propia) NO se trata como encabezado", () => {
    const text = "Se mantiene el mismo tratamiento habitual, sin cambios.";
    const segments = segmentClinicalText(text);
    expect(segments).toHaveLength(1);
    expect(segments[0].headerCategory).toBeNull();
  });

  it("varios encabezados seguidos producen un segmento por cada uno, en orden", () => {
    const text = "Microbiología:\nCultivo con Pseudomonas aeruginosa.\n\nTratamiento:\nSe inicia tobramicina inhalada.";
    const segments = segmentClinicalText(text);
    expect(segments.map((s) => s.headerCategory)).toEqual(["microbiologia", "tratamiento"]);
    expect(segments[0].text).toContain("Pseudomonas");
    expect(segments[0].text).not.toContain("tobramicina");
    expect(segments[1].text).toContain("tobramicina");
    expect(segments[1].text).not.toContain("Pseudomonas");
  });

  it("una transición temporal que cierra episodio arranca un nuevo segmento sin encabezado propio, marcado startsNewEpisode", () => {
    const text = "Ingreso por agudización.\n\nTres meses después:\nNueva revisión, estable.";
    const segments = segmentClinicalText(text);
    expect(segments).toHaveLength(2);
    expect(segments[1].headerCategory).toBeNull();
    expect(segments[1].startsNewEpisode).toBe(true);
    expect(segments[1].temporalLabel).toMatch(/tres meses después/i);
    expect(segments[1].text).toBe("Nueva revisión, estable.");
  });

  it("'Al alta' y 'durante el ingreso' son transiciones temporales que NO cierran el episodio (startsNewEpisode false)", () => {
    const [, duringSeg] = segmentClinicalText("Ingreso por agudización.\n\nDurante el ingreso: fiebre en aumento.");
    expect(duringSeg.startsNewEpisode).toBe(false);
    expect(duringSeg.temporalLabel).toMatch(/durante el ingreso/i);

    const [, altaSeg] = segmentClinicalText("Ingreso por agudización.\n\nAl alta: se pauta amoxicilina.");
    expect(altaSeg.startsNewEpisode).toBe(false);
    expect(altaSeg.temporalLabel).toMatch(/al alta/i);
  });

  it("'Alta:' como encabezado de sección (no 'al alta' narrativo) se distingue correctamente como headerCategory 'alta'", () => {
    const segments = segmentClinicalText("Alta:\nSe pauta ciprofloxacino oral domiciliario.");
    expect(segments).toHaveLength(1);
    expect(segments[0].headerCategory).toBe("alta");
    expect(segments[0].startsNewEpisode).toBe(false);
  });

  it("un texto vacío no produce ningún segmento", () => {
    expect(segmentClinicalText("")).toEqual([]);
    expect(segmentClinicalText("   \n  \n")).toEqual([]);
  });
});
