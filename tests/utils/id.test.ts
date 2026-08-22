import { describe, expect, it } from "vitest";
import { generatePulmoVistaCode, uid } from "@/utils/id";

describe("uid", () => {
  it("genera ids únicos con el prefijo indicado", () => {
    const a = uid("ev");
    const b = uid("ev");
    expect(a).not.toBe(b);
    expect(a.startsWith("ev-")).toBe(true);
  });

  it("usa 'id' como prefijo por defecto", () => {
    expect(uid().startsWith("id-")).toBe(true);
  });
});

describe("generatePulmoVistaCode", () => {
  it("genera un código con el formato PV-XXXX-XXXX", () => {
    expect(generatePulmoVistaCode()).toMatch(/^PV-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});
