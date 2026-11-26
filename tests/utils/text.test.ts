import { describe, expect, it } from "vitest";
import { cap, formatAge } from "@/utils/text";

describe("cap", () => {
  it("capitaliza la primera letra", () => {
    expect(cap("azitromicina")).toBe("Azitromicina");
  });

  it("devuelve el valor de entrada sin cambios si es falsy", () => {
    expect(cap("")).toBe("");
    expect(cap(null)).toBeNull();
    expect(cap(undefined)).toBeUndefined();
  });
});

describe("formatAge", () => {
  it("muestra la edad con 'años' o 'Edad no disponible' si no consta (nunca 'null años')", () => {
    expect(formatAge(58)).toBe("58 años");
    expect(formatAge(null)).toBe("Edad no disponible");
  });
});
