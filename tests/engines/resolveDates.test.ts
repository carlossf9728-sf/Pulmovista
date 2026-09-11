/**
 * Tests de engines/extraction/resolveDates.ts — capa de resolución
 * temporal explícita. Cubre exactamente los escenarios pedidos: "3
 * semanas después", "2 meses después", "al día siguiente", "al alta"
 * (con y sin duración, vía frase de transición Y vía encabezado "Alta
 * hospitalaria tras N días:"), fecha explícita posterior, y una cadena
 * de varios episodios donde las fechas NO deben ser todas iguales (el
 * bug original que motivó esta capa).
 */
import { describe, expect, it } from "vitest";
import { segmentClinicalText } from "@/engines/extraction/segment";
import { resolveSegmentDates } from "@/engines/extraction/resolveDates";

const ANCHOR = "2026-09-11";

function resolve(text: string) {
  const segments = segmentClinicalText(text);
  return { segments, resolved: resolveSegmentDates(segments, ANCHOR) };
}

describe("resolveSegmentDates — primer segmento (sin transición)", () => {
  it("usa la fecha de importación como ancla operativa, marcada 'derived'/'import_anchor', nunca 'documented'", () => {
    const { resolved } = resolve("Consulta de seguimiento. Estable.");
    expect(resolved[0]).toEqual({ date: ANCHOR, datePrecision: "derived", dateSource: "import_anchor", temporalExpression: null });
  });
});

describe("resolveSegmentDates — desplazamientos relativos cuantificados", () => {
  it("'3 semanas después' (dígito) suma 3 semanas a la fecha ancla", () => {
    const { resolved } = resolve(`Consulta inicial.
3 semanas después: mejoría clínica.`);
    expect(resolved[1]).toEqual({ date: "2026-10-02", datePrecision: "derived", dateSource: "relative_offset", temporalExpression: "3 semanas después" });
  });

  it("'Control a las 3 semanas' se resuelve igual que '3 semanas después'", () => {
    const { resolved } = resolve(`Consulta inicial.
Control a las 3 semanas: sin incidencias.`);
    expect(resolved[1]).toMatchObject({ date: "2026-10-02", datePrecision: "derived", dateSource: "relative_offset" });
  });

  it("'2 meses después' encadena desde el cursor (última fecha resuelta), no desde la fecha ancla", () => {
    const { resolved } = resolve(`Consulta inicial.
3 semanas después: revisión.
2 meses después: nueva revisión.`);
    // cursor tras el segmento[1] = 2026-10-02; +2 meses = 2026-12-02
    expect(resolved[1].date).toBe("2026-10-02");
    expect(resolved[2]).toEqual({ date: "2026-12-02", datePrecision: "derived", dateSource: "relative_offset", temporalExpression: "2 meses después" });
  });

  it("'tres meses después' (palabra) también se reconoce", () => {
    const { resolved } = resolve(`Consulta inicial.
Tres meses después: control.`);
    expect(resolved[1]).toMatchObject({ date: "2026-12-11", datePrecision: "derived" });
  });
});

describe("resolveSegmentDates — al día siguiente", () => {
  it("suma un día al cursor", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
Al día siguiente: mejoría del trabajo respiratorio.`);
    expect(resolved[1]).toEqual({ date: "2026-09-12", datePrecision: "derived", dateSource: "relative_offset", temporalExpression: "Al día siguiente" });
  });
});

describe("resolveSegmentDates — durante el ingreso", () => {
  it("usa episodeAnchorDate (fecha del ingreso), no el cursor", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
3 semanas después: revisión ambulatoria.
Durante el ingreso: se realiza TC tórax.`);
    // el 3er segmento no pertenece a este ingreso (el episodio ya cerró en el segmento 2), así que
    // "durante el ingreso" sin episodio abierto queda unresolved.
    expect(resolved[2].datePrecision).toBe("unresolved");
  });

  it("con el ingreso todavía abierto, se fecha con episodeAnchorDate", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
Durante el ingreso: se realiza TC tórax, sin hallazgos nuevos.`);
    expect(resolved[0].date).toBe(ANCHOR);
    expect(resolved[1]).toEqual({ date: ANCHOR, datePrecision: "derived", dateSource: "relative_offset", temporalExpression: "Durante el ingreso" });
  });
});

describe("resolveSegmentDates — al alta", () => {
  it("con duración explícita ('tras N días') y episodio de ingreso abierto, deriva desde episodeAnchorDate", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
Al alta: paciente estable, tras 7 días de ingreso, se retira oxígeno suplementario.`);
    expect(resolved[0].date).toBe(ANCHOR);
    expect(resolved[1]).toEqual({ date: "2026-09-18", datePrecision: "derived", dateSource: "relative_offset", temporalExpression: "Al alta" });
  });

  it("sin duración explícita, queda unresolved — nunca inventa cuántos días duró el ingreso", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
Al alta: paciente estable, se retira oxígeno suplementario.`);
    expect(resolved[1].datePrecision).toBe("unresolved");
    expect(resolved[1].dateSource).toBe("relative_offset");
    expect(resolved[1].temporalExpression).toBe("Al alta");
    // conserva el cursor por compatibilidad técnica, pero no es una fecha clínica fiable
    expect(resolved[1].date).toBe(resolved[0].date);
  });

  it("sin episodio de ingreso previo (no hay episodeAnchorDate), queda unresolved aunque haya duración", () => {
    const { resolved } = resolve(`Consulta de seguimiento habitual, sin incidencias relevantes.
Al alta: paciente estable, tras 7 días de ingreso.`);
    expect(resolved[1].datePrecision).toBe("unresolved");
  });

  it("vía encabezado 'Alta hospitalaria tras N días:' (sin frase 'al alta' literal) se resuelve igual que la transición temporal", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
Alta hospitalaria tras 7 días: paciente estable, se retira oxígeno.`);
    expect(resolved[1]).toEqual({ date: "2026-09-18", datePrecision: "derived", dateSource: "relative_offset", temporalExpression: "Alta" });
  });

  it("encabezado de alta sin duración explícita también queda unresolved", () => {
    const { resolved } = resolve(`Ingreso por exacerbación grave, se inicia antibiótico IV.
Alta hospitalaria: paciente estable.`);
    expect(resolved[1].datePrecision).toBe("unresolved");
  });
});

describe("resolveSegmentDates — fecha explícita posterior", () => {
  it("'en marzo de 2027' se marca 'documented'/'explicit_date' (el texto sí la declara)", () => {
    const { resolved } = resolve(`Consulta inicial.
En marzo de 2027: revisión anual, estable.`);
    expect(resolved[1]).toEqual({ date: "2027-03-01", datePrecision: "documented", dateSource: "explicit_date", temporalExpression: "En marzo de 2027" });
  });
});

describe("resolveSegmentDates — expresión temporal sin cantidad reconocible", () => {
  it("'posteriormente' no tiene cantidad: queda unresolved, no inventa un intervalo", () => {
    const { resolved } = resolve(`Consulta inicial.
Posteriormente: nueva valoración.`);
    expect(resolved[1].datePrecision).toBe("unresolved");
    expect(resolved[1].date).toBe(resolved[0].date);
  });
});

describe("resolveSegmentDates — combinación de varios episodios (el bug original)", () => {
  it("un bloque largo con varias transiciones produce fechas DISTINTAS, no todas la fecha de importación", () => {
    const text = `Consulta inicial 11/09/2026. Tos y expectoración purulenta.
Control a las 3 semanas: mejoría clínica franca.
Tres meses después: nueva agudización, requiere ingreso hospitalario para tratamiento IV.
Alta hospitalaria tras 5 días: paciente estable, se retira antibiótico IV.
Dos meses después del alta: revisión en consulta, FEV1 estable respecto a previo.`;
    const { resolved } = resolve(text);
    const dates = resolved.map((r) => r.date);
    expect(new Set(dates).size).toBeGreaterThan(1);
    expect(dates).toEqual(["2026-09-11", "2026-10-02", "2027-01-02", "2027-01-07", "2027-03-07"]);
    // ninguna se marca "documented" salvo que el propio texto declare una fecha de calendario explícita
    expect(resolved.every((r) => r.datePrecision !== "documented")).toBe(true);
  });
});
