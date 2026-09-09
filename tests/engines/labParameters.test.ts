import { describe, expect, it } from "vitest";
import { parseLabBlock, parseLabParameterLine } from "@/engines/extraction/labParameters";

describe("parseLabParameterLine", () => {
  it("estructura una línea IANUS completa con prefijo de muestra, unidad, rango y asterisco de fuera de rango", () => {
    const p = parseLabParameterLine("Srm-Leucocitos 11.1 x10^3/µL [4 - 10] *");
    expect(p).toMatchObject({
      name: "Leucocitos",
      rawName: "Srm-Leucocitos",
      valueText: "11.1 x10^3/µL",
      numericValue: 11.1,
      unit: "x10^3/µL",
      referenceRange: { low: 4, high: 10 },
      status: "alterado",
      category: "hemograma",
    });
  });

  it("calcula el estado a partir del rango cuando el valor cae dentro (nunca inventa 'alterado' por el mero hecho de existir un rango)", () => {
    const p = parseLabParameterLine("Srm-Creatinina 0.92 mg/dL [0.7 - 1.2]");
    expect(p).toMatchObject({ name: "Creatinina", status: "normal", numericValue: 0.92 });
  });

  it("tolera coma decimal (formato europeo)", () => {
    const p = parseLabParameterLine("Srm-Hemoglobina 11,8 g/dL [13,5 - 17,5] *");
    expect(p).toMatchObject({ numericValue: 11.8, referenceRange: { low: 13.5, high: 17.5 } });
    // valueText conserva la coma tal como constaba en el informe — no se reformatea el número.
    expect(p?.valueText).toBe("11,8 g/dL");
  });

  it("tolera espacios múltiples y tabulaciones como separador", () => {
    const p = parseLabParameterLine("Srm-Leucocitos    11.1   x10^3/µL   [4-10] *");
    expect(p).toMatchObject({ name: "Leucocitos", numericValue: 11.1, referenceRange: { low: 4, high: 10 } });
  });

  it("ignora el prefijo de laboratorio sin perderlo (se conserva en rawName)", () => {
    const srm = parseLabParameterLine("Srm-Creatinina 0.92 mg/dL");
    const san = parseLabParameterLine("San-Plaquetas 250 x10^3/µL");
    const pla = parseLabParameterLine("Pla-Glucosa 95 mg/dL");
    expect(srm).toMatchObject({ name: "Creatinina", rawName: "Srm-Creatinina" });
    expect(san).toMatchObject({ name: "Plaquetas", rawName: "San-Plaquetas" });
    expect(pla).toMatchObject({ name: "Glucosa", rawName: "Pla-Glucosa" });
  });

  it("normaliza abreviaturas conocidas al nombre canónico, conservando el nombre crudo", () => {
    expect(parseLabParameterLine("Srm-Hb 11.8 g/dL")).toMatchObject({ name: "Hemoglobina", rawName: "Srm-Hb" });
    expect(parseLabParameterLine("Srm-Leu 11.1 x10^3/µL")).toMatchObject({ name: "Leucocitos", rawName: "Srm-Leu" });
    expect(parseLabParameterLine("PCR 18.4 mg/L")).toMatchObject({ name: "PCR", rawName: "PCR" });
    expect(parseLabParameterLine("Proteína C reactiva 18.4 mg/L")).toMatchObject({ name: "PCR" });
    expect(parseLabParameterLine("Srm-Cr 0.92 mg/dL")).toMatchObject({ name: "Creatinina", rawName: "Srm-Cr" });
  });

  it("es conservador: un nombre no reconocido en el mapa de sinónimos NO se fuerza a encajar en uno conocido, se conserva tal cual con categoría 'otros'", () => {
    const p = parseLabParameterLine("Srm-Ferritina 320 ng/mL [>15]");
    expect(p).toMatchObject({ name: "Ferritina", rawName: "Srm-Ferritina", category: "otros" });
  });

  it("categoriza cada parámetro reconocido en su bloque de laboratorio correspondiente — nunca 'general vs etiológico'", () => {
    expect(parseLabParameterLine("Srm-Leucocitos 11.1 x10^3/µL [4 - 10]")).toMatchObject({ category: "hemograma" });
    expect(parseLabParameterLine("Srm-Creatinina 0.92 mg/dL [0.7 - 1.2]")).toMatchObject({ category: "funcion_renal" });
    expect(parseLabParameterLine("Srm-ALT 22 U/L [0-41]")).toMatchObject({ category: "perfil_hepatico" });
    expect(parseLabParameterLine("Srm-PCR 18.4 mg/L [0 - 5]")).toMatchObject({ category: "inflamacion" });
    expect(parseLabParameterLine("Srm-INR 1.1")).toMatchObject({ category: "coagulacion" });
    expect(parseLabParameterLine("Srm-IgG 950 mg/dL [700 - 1600]")).toMatchObject({ category: "inmunologia" });
    expect(parseLabParameterLine("Srm-IgE especifica Aspergillus 0.2 kU/L")).toMatchObject({ category: "aspergillus_abpa" });
    expect(parseLabParameterLine("Srm-Alfa-1-antitripsina 135 mg/dL [90 - 200]")).toMatchObject({ category: "alfa1_antitripsina" });
    expect(parseLabParameterLine("Srm-ANA 1.5 U/mL")).toMatchObject({ category: "autoinmunidad" });
  });

  it("soporta rangos con un solo extremo ('<x' o '>x'), tal como declara el propio tipo LabReferenceRange", () => {
    expect(parseLabParameterLine("Srm-Ferritina 320 ng/mL [>15]")).toMatchObject({ referenceRange: { low: 15, high: null }, status: "normal" });
    expect(parseLabParameterLine("Srm-TSH 2.1 mUI/L [<4.5]")).toMatchObject({ referenceRange: { low: null, high: 4.5 }, status: "normal" });
    expect(parseLabParameterLine("Srm-TSH 6.1 mUI/L [<4.5]")).toMatchObject({ status: "alterado" });
  });

  it("sin rango de referencia y sin asterisco, el estado queda null — nunca se infiere normalidad sin dato", () => {
    const p = parseLabParameterLine("Srm-Sodio 138 mmol/L");
    expect(p).toMatchObject({ status: null, referenceRange: null });
  });

  it("usa el asterisco como respaldo de 'alterado' solo cuando no hay rango numérico con el que calcular", () => {
    // Sin este caso el * se ignoraría del todo — pero tampoco es la única fuente cuando hay rango (ver el primer test, que prioriza el cálculo).
    const p = parseLabParameterLine("Srm-Sodio 138 mmol/L *");
    expect(p).toMatchObject({ status: "alterado", referenceRange: null });
  });

  it("no se cuela una fecha como si fuera un parámetro con unidad (unidad puramente numérica no es una unidad real)", () => {
    expect(parseLabParameterLine("Fecha de extracción: 12/03/2026")).toBeNull();
    expect(parseLabParameterLine("Hora: 08:45")).toBeNull();
  });

  it("no confunde FEV1/FVC/DLCO sueltos con un parámetro de analítica (esos los extrae el bloque de función pulmonar)", () => {
    expect(parseLabParameterLine("FEV1 78%")).toBeNull();
    expect(parseLabParameterLine("FVC 85%")).toBeNull();
    expect(parseLabParameterLine("DLCO 70%")).toBeNull();
  });

  it("una frase en prosa con puntuación real no se interpreta como línea de analítica", () => {
    expect(parseLabParameterLine("Analítica con PCR 45 mg/L y leucocitos elevados.")).toBeNull();
  });

  it("un valor cualitativo sin cifra (Positivo/Negativo) no se estructura — fuera del alcance conservador de este parser", () => {
    expect(parseLabParameterLine("Srm-VIH Negativo")).toBeNull();
  });

  it("una línea vacía o solo espacios devuelve null", () => {
    expect(parseLabParameterLine("")).toBeNull();
    expect(parseLabParameterLine("   ")).toBeNull();
  });

  it("tolera dos puntos entre el nombre y el valor como variante de formato", () => {
    const p = parseLabParameterLine("Srm-Leucocitos: 11.1 x10^3/µL [4 - 10] *");
    expect(p).toMatchObject({ name: "Leucocitos", numericValue: 11.1 });
  });

  it("nombres con paréntesis (ALT (GPT)) se reconocen sin necesitar prefijo de muestra", () => {
    expect(parseLabParameterLine("ALT (GPT) 22 U/L [0-41]")).toMatchObject({ name: "ALT (GPT)" });
  });
});

describe("parseLabBlock — bloques completos estilo IANUS", () => {
  it("estructura el bloque exacto del encargo del usuario, con las 4 líneas correctas", () => {
    const text = `Srm-Leucocitos 11.1 x10^3/µL [4 - 10] *
Srm-Hemoglobina 11.8 g/dL [13.5 - 17.5] *
Srm-PCR 18.4 mg/L [0 - 5] *
Srm-Creatinina 0.92 mg/dL [0.7 - 1.2]`;
    const result = parseLabBlock(text);
    expect(result.unparsedLines).toEqual([]);
    expect(result.parameters).toHaveLength(4);
    expect(result.parameters.map((p) => p.name)).toEqual(["Leucocitos", "Hemoglobina", "PCR", "Creatinina"]);
    expect(result.parameters.map((p) => p.status)).toEqual(["alterado", "alterado", "alterado", "normal"]);
  });

  it("estructura un bloque grande de hemograma + bioquímica (18 parámetros) sin dejar ninguno sin interpretar", () => {
    const text = `Srm-Leucocitos 11.1 x10^3/µL [4 - 10] *
Srm-Hemoglobina 11.8 g/dL [13.5 - 17.5] *
Srm-Hematocrito 36.2 % [37 - 47] *
Srm-Plaquetas 410 x10^3/µL [150 - 450]
Srm-Neutrofilos 8.2 x10^3/µL [2 - 7] *
Srm-Linfocitos 1.1 x10^3/µL [1 - 4]
Srm-Eosinofilos 0.2 x10^3/µL [0 - 0.5]
Srm-PCR 18.4 mg/L [0 - 5] *
Srm-Procalcitonina 0.08 ng/mL [0 - 0.5]
Srm-Creatinina 0.92 mg/dL [0.7 - 1.2]
Srm-Urea 38 mg/dL [10 - 50]
Srm-Sodio 138 mmol/L [135 - 145]
Srm-Potasio 4.2 mmol/L [3.5 - 5.1]
Srm-Glucosa 102 mg/dL [70 - 100] *
Srm-ALT 22 U/L [0 - 41]
Srm-AST 19 U/L [0 - 40]
Srm-Bilirrubina total 0.6 mg/dL [0.2 - 1.2]
Srm-VSG 15 mm/h [0 - 20]`;
    const result = parseLabBlock(text);
    expect(result.parameters).toHaveLength(18);
    expect(result.unparsedLines).toEqual([]);
  });

  it("estructura el bloque de cribado etiológico de bronquiectasias, cada parámetro en su propio bloque de laboratorio (Inmunología / Alfa-1-antitripsina)", () => {
    const text = `Srm-IgG 950 mg/dL [700 - 1600]
Srm-IgA 210 mg/dL [70 - 400]
Srm-IgM 90 mg/dL [40 - 230]
Srm-Alfa-1-antitripsina 135 mg/dL [90 - 200]`;
    const result = parseLabBlock(text);
    expect(result.parameters).toHaveLength(4);
    expect(result.parameters.filter((p) => p.category === "inmunologia").map((p) => p.name)).toEqual(["IgG", "IgA", "IgM"]);
    expect(result.parameters.filter((p) => p.category === "alfa1_antitripsina").map((p) => p.name)).toEqual(["Alfa-1-antitripsina"]);
  });

  it("un bloque ruidoso con encabezados, comentarios y firma mezclados estructura solo las líneas de parámetro reales, conservando el resto para revisión", () => {
    const text = `INFORME DE LABORATORIO
Paciente: XXXX
Fecha de extracción: 12/03/2026

HEMOGRAMA
Srm-Leucocitos 11.1 x10^3/µL [4 - 10] *
Srm-Hemoglobina 11.8 g/dL [13.5 - 17.5] *

BIOQUIMICA
Srm-PCR 18.4 mg/L [0 - 5] *
Srm-Creatinina 0.92 mg/dL [0.7 - 1.2]

Comentario: se recomienda repetir en 2 semanas.
Validado por Dr. XXXX el 12/03/2026.`;
    const result = parseLabBlock(text);
    expect(result.parameters.map((p) => p.name)).toEqual(["Leucocitos", "Hemoglobina", "PCR", "Creatinina"]);
    expect(result.unparsedLines).toEqual([
      "INFORME DE LABORATORIO",
      "Paciente: XXXX",
      "Fecha de extracción: 12/03/2026",
      "HEMOGRAMA",
      "BIOQUIMICA",
      "Comentario: se recomienda repetir en 2 semanas.",
      "Validado por Dr. XXXX el 12/03/2026.",
    ]);
  });

  it("las líneas en blanco no cuentan como 'sin interpretar'", () => {
    const result = parseLabBlock("Srm-Sodio 138 mmol/L\n\n\nSrm-Potasio 4.2 mmol/L\n");
    expect(result.parameters).toHaveLength(2);
    expect(result.unparsedLines).toEqual([]);
  });

  it("un texto que no trae ninguna línea reconocible como parámetro devuelve parameters:[] sin lanzar error", () => {
    const result = parseLabBlock("Acude a consulta de revisión. Se encuentra estable.");
    expect(result.parameters).toEqual([]);
  });
});
