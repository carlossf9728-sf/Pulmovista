/**
 * Tests de domain/radiologyTrend.ts — clasificación por palabras clave
 * del propio texto del informe de imagen, con manejo de negaciones. No
 * es un umbral clínico nuevo: es reconocimiento léxico sobre texto
 * libre, la misma técnica que ya usa engines/extraction.
 */
import { describe, expect, it } from "vitest";
import { classifyRadiologyTrend } from "@/domain/radiologyTrend";

describe("classifyRadiologyTrend", () => {
  it("clasifica Empeoramiento ante progresión explícita", () => {
    expect(classifyRadiologyTrend("TC tórax con progresión de las bronquiectasias en língula.").trend).toBe("Empeoramiento");
  });

  it("clasifica Empeoramiento ante una nueva lesión", () => {
    expect(classifyRadiologyTrend("Aparece una nueva lesión nodular en língula no presente en el estudio previo.").trend).toBe("Empeoramiento");
  });

  it("clasifica Mejoría ante resolución explícita", () => {
    expect(classifyRadiologyTrend("Resolución del infiltrado en lóbulo inferior derecho respecto al estudio previo.").trend).toBe("Mejoría");
  });

  it("clasifica Mejoría ante disminución explícita", () => {
    expect(classifyRadiologyTrend("Disminución de la impactación mucosa respecto al control anterior.").trend).toBe("Mejoría");
  });

  it("NUNCA marca Empeoramiento cuando el informe niega progresión — 'sin progresión'", () => {
    const result = classifyRadiologyTrend("Bronquiectasias cilíndricas ya conocidas, sin progresión respecto al estudio previo.");
    expect(result.trend).toBeNull();
  });

  it("respeta otras formas habituales de negación ('no se objetiva', 'sin evidencia de', 'sin datos de')", () => {
    expect(classifyRadiologyTrend("No se objetiva progresión de las lesiones descritas.").trend).toBeNull();
    expect(classifyRadiologyTrend("Sin evidencia de nueva lesión pulmonar.").trend).toBeNull();
    expect(classifyRadiologyTrend("Sin datos de aumento de la afectación bronquiectásica.").trend).toBeNull();
  });

  it("sin ningún término reconocido, no etiqueta (texto puramente descriptivo, sin cambio afirmado)", () => {
    expect(classifyRadiologyTrend("Bronquiectasias cilíndricas bilaterales de predominio en lóbulos inferiores.").trend).toBeNull();
  });

  it("sin cambios significativos no etiqueta nada (ni empeoramiento ni mejoría)", () => {
    expect(classifyRadiologyTrend("Sin cambios significativos respecto al estudio previo.").trend).toBeNull();
  });

  it("un informe con señales de ambas direcciones no se etiqueta globalmente — evita interpretar mal un informe mixto", () => {
    const result = classifyRadiologyTrend("Progresión de las bronquiectasias en língula, con resolución del derrame pleural derecho.");
    expect(result.trend).toBeNull();
  });

  it("conserva el término que motivó la clasificación, para trazabilidad", () => {
    const result = classifyRadiologyTrend("TC tórax con progresión de las bronquiectasias.");
    expect(result.matchedTerm).toMatch(/progresi[oó]n/i);
  });
});
