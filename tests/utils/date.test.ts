import { describe, expect, it } from "vitest";
import { formatDate, monthsBetween, sortByDate, todayISO, yearOf } from "@/utils/date";

describe("formatDate", () => {
  it("formatea una fecha ISO en formato es-ES dd/mm/aaaa", () => {
    expect(formatDate("2024-03-10")).toBe("10/03/2024");
  });

  it("devuelve 'No disponible' si la fecha es null, undefined o vacía", () => {
    expect(formatDate(null)).toBe("No disponible");
    expect(formatDate(undefined)).toBe("No disponible");
    expect(formatDate("")).toBe("No disponible");
  });

  it("devuelve 'No disponible' si la fecha no es válida", () => {
    expect(formatDate("no-es-una-fecha")).toBe("No disponible");
  });
});

describe("monthsBetween", () => {
  it("calcula la diferencia aproximada en meses entre dos fechas", () => {
    expect(monthsBetween("2024-01-01", "2024-02-01")).toBeCloseTo(31 / 30.44, 2);
  });

  it("es simétrica (valor absoluto)", () => {
    expect(monthsBetween("2024-02-01", "2024-01-01")).toBeCloseTo(monthsBetween("2024-01-01", "2024-02-01"), 5);
  });
});

describe("todayISO", () => {
  it("devuelve una fecha ISO de 10 caracteres (yyyy-mm-dd)", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("yearOf", () => {
  it("extrae el año de una fecha ISO", () => {
    expect(yearOf("2025-11-20")).toBe(2025);
  });
});

describe("sortByDate", () => {
  it("ordena por fecha ascendente sin mutar el array original", () => {
    const original = [{ date: "2025-01-01" }, { date: "2023-01-01" }, { date: "2024-01-01" }];
    const sorted = sortByDate(original);
    expect(sorted.map((x) => x.date)).toEqual(["2023-01-01", "2024-01-01", "2025-01-01"]);
    expect(original.map((x) => x.date)).toEqual(["2025-01-01", "2023-01-01", "2024-01-01"]);
  });
});
