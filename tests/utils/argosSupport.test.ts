import { describe, expect, it } from "vitest";
import { ARGOS_SUPPORT_LABEL, argosSupportLevel } from "@/utils/argosSupport";

/**
 * Pura lectura más gruesa de statusLabel (Cumple/Posiblemente cumple/Información
 * insuficiente/No cumple, ya calculados por engines/sentinel/guidelineInterpretation.ts)
 * a 3 niveles para la tarjeta compacta de Argos — no evalúa nada nuevo.
 */
describe("argosSupportLevel", () => {
  it("'respaldado' cuando alguna recomendación relacionada cumple ahora mismo", () => {
    expect(argosSupportLevel([{ statusLabel: "Cumple" }])).toBe("respaldado");
    expect(argosSupportLevel([{ statusLabel: "No cumple" }, { statusLabel: "Cumple" }])).toBe("respaldado");
  });

  it("'posible' cuando hay recomendaciones relacionadas pero ninguna cumple con certeza", () => {
    expect(argosSupportLevel([{ statusLabel: "Posiblemente cumple" }])).toBe("posible");
    expect(argosSupportLevel([{ statusLabel: "Información insuficiente" }])).toBe("posible");
    expect(argosSupportLevel([{ statusLabel: "No cumple" }])).toBe("posible");
  });

  it("'sin_soporte' cuando no hay ninguna recomendación relacionada", () => {
    expect(argosSupportLevel([])).toBe("sin_soporte");
  });

  it("ARGOS_SUPPORT_LABEL trae exactamente los 3 textos pedidos, sin term técnico GuidelineMatch/Cumple", () => {
    expect(ARGOS_SUPPORT_LABEL.respaldado).toBe("Respaldado por guía");
    expect(ARGOS_SUPPORT_LABEL.posible).toBe("Posible aplicabilidad");
    expect(ARGOS_SUPPORT_LABEL.sin_soporte).toBe("Sin interpretación basada en guía disponible");
  });
});
