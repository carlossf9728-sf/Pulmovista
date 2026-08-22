import { describe, expect, it } from "vitest";
import { cap } from "@/utils/text";

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
