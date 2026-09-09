import { describe, expect, it } from "vitest";
import { buildCandidateEvents, hasConsultationNarrative, runExtractionEngine } from "@/engines/extraction";

describe("runExtractionEngine", () => {
  it("extrae función pulmonar (FEV1/FVC/DLCO)", () => {
    const events = runExtractionEngine("FEV1 78%. FVC 85%. DLCO 70%.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1Percent: 78, FVCPercent: 85, DLCOPercent: 70 });
  });

  it("extrae el z-score de FEV1, FVC y FEV1/FVC por separado, y nunca el z-score de DLCO (no se toca)", () => {
    const events = runExtractionEngine(
      "FEV1 68%, z-score -1.9. FVC 76%, z-score -1.7. FEV1/FVC 74%, z-score -1.1. DLCO 65%.",
      "2024-01-01",
    );
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({
      FEV1Percent: 68,
      FEV1zScore: -1.9,
      FVCPercent: 76,
      FVCzScore: -1.7,
      FEV1FVCRatio: 74,
      FEV1FVCzScore: -1.1,
      DLCOPercent: 65,
    });
    // El tipo PulmonaryFunctionEvent no tiene ningún campo de z-score para DLCO — no hay nada que verificar ahí más allá de que no exista el campo.
    expect(pft && "DLCOzScore" in pft).toBe(false);
  });

  it("no confunde 'FEV1/FVC' con 'FEV1' o 'FVC' sueltos al extraer el % (evita el falso positivo de leer el cociente como si fuera el volumen)", () => {
    const events = runExtractionEngine("FEV1/FVC 65%.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1FVCRatio: 65, FEV1Percent: null, FVCPercent: null });
  });

  it("tampoco confunde el z-score de FEV1/FVC con el de FEV1 o FVC sueltos", () => {
    const events = runExtractionEngine("FEV1/FVC z-score -1.2.", "2024-01-01");
    const pft = events.find((e) => e.type === "pulmonary_function");
    expect(pft).toMatchObject({ FEV1FVCzScore: -1.2, FEV1zScore: null, FVCzScore: null });
  });

  it("extrae un microorganismo con sensibilidad", () => {
    const events = runExtractionEngine("Cultivo de esputo con Pseudomonas aeruginosa, sensible a ciprofloxacino.", "2024-01-01");
    const micro = events.find((e) => e.type === "microbiology");
    expect(micro).toMatchObject({ organism: "Pseudomonas aeruginosa" });
    if (micro?.type === "microbiology") {
      expect(micro.sensitivity[0]).toContain("ciprofloxacino");
    }
  });

  it("detecta una exacerbación explícita", () => {
    const events = runExtractionEngine("Presenta una exacerbación moderada.", "2024-01-01");
    const exac = events.find((e) => e.type === "exacerbation");
    expect(exac).toBeDefined();
    expect(exac?.confidence).toBe("confirmado");
  });

  it("detecta una posible exacerbación por signos + antibiótico sin usar la palabra 'exacerbación'", () => {
    const events = runExtractionEngine("Refiere mayor disnea y se pauta ciprofloxacino.", "2024-01-01");
    const exac = events.find((e) => e.type === "exacerbation");
    expect(exac?.confidence).toBe("posible");
    expect(exac?.confidenceReason).toMatch(/exacerbaci/i);
  });

  it("detecta hospitalización cuando no hay exacerbación explícita ni signos+antibiótico", () => {
    const events = runExtractionEngine("Ingreso programado para estudio.", "2024-01-01");
    expect(events.some((e) => e.type === "hospitalization")).toBe(true);
  });

  it("detecta inicio de tratamiento con dosis de 1 dígito y pauta", () => {
    const events = runExtractionEngine("Se inicia prednisona 5 mg lunes, miércoles y viernes.", "2024-01-01");
    const treatment = events.find((e) => e.type === "treatment_started");
    expect(treatment).toMatchObject({ drug: "prednisona", dose: "5 mg" });
    if (treatment?.type === "treatment_started") {
      expect(treatment.schedule).toContain("lunes");
    }
  });

  it("extrae correctamente dosis de 2+ dígitos (bug técnico corregido, no clínico)", () => {
    // Antes: el regex de dosis `${drug}[^.]{0,6}(\d+\s?mg)` hacía backtracking
    // voraz y se comía todos los dígitos de la dosis salvo el último antes de
    // que el grupo capturador entrara en juego, produciendo dose="0 mg" en vez
    // de "250 mg". Se corrigió con un cuantificador perezoso (`[^.]{0,6}?`) —
    // ver comentario en engines/extraction/index.ts. Este test fija el
    // comportamiento correcto como regresión.
    const events = runExtractionEngine("Se inicia azitromicina 250 mg lunes, miércoles y viernes.", "2024-01-01");
    const treatment = events.find((e) => e.type === "treatment_started");
    expect(treatment).toMatchObject({ drug: "azitromicina", dose: "250 mg" });
  });

  it("clasifica oxígeno/VMNI como soporte respiratorio, no tratamiento farmacológico", () => {
    const events = runExtractionEngine("Se inicia oxígeno domiciliario.", "2024-01-01");
    expect(events.some((e) => e.type === "respiratory_support")).toBe(true);
    expect(events.some((e) => e.type === "treatment_started")).toBe(false);
  });

  it("detecta la retirada de un tratamiento", () => {
    const events = runExtractionEngine("Se retira prednisona por buena evolución.", "2024-01-01");
    expect(events.some((e) => e.type === "treatment_stopped")).toBe(true);
  });

  it("fecha todos los eventos detectados con la fecha de la consulta (limitación conocida)", () => {
    const events = runExtractionEngine("FEV1 78%. Exacerbación en enero de 2023.", "2024-06-01");
    expect(events.every((e) => e.date === "2024-06-01")).toBe(true);
  });

  it("detecta una prueba de imagen torácica y separa solo la frase que la contiene", () => {
    const events = runExtractionEngine("Buena tolerancia al ejercicio. TC tórax con progresión leve de bronquiectasias en língula. Se mantiene tratamiento habitual.", "2024-01-01");
    const imaging = events.find((e) => e.type === "imaging");
    expect(imaging).toBeDefined();
    if (imaging?.type === "imaging") {
      expect(imaging.text).toContain("progresión leve de bronquiectasias en língula");
      expect(imaging.text).not.toContain("Se mantiene tratamiento habitual");
    }
  });

  it("detecta una analítica y la etiqueta como tal", () => {
    const events = runExtractionEngine("Analítica con PCR 45 mg/L y leucocitos elevados. Resto sin hallazgos.", "2024-01-01");
    const lab = events.find((e) => e.type === "lab_results");
    expect(lab).toBeDefined();
    if (lab?.type === "lab_results") {
      expect(lab.label).toBe("Analítica");
      expect(lab.text).toContain("PCR 45 mg/L");
      // Texto en prosa, sin formato de línea IANUS: no hay parámetros estructurados que inventar.
      expect(lab.parameters ?? []).toEqual([]);
    }
  });

  /**
   * Bloque pegado tal cual desde IANUS (ver engines/extraction/labParameters.ts) — a diferencia del
   * caso anterior (prosa de una frase), aquí el motor debe preferir la vía estructurada: conservar el
   * bloque COMPLETO en `text` (nunca truncarlo en el primer punto decimal, que es el bug que tenía
   * captureSentence con números como "11.1") y estructurar cada línea reconocible en `parameters`.
   */
  it("detecta un bloque de analítica estilo IANUS y lo estructura en parameters, conservando el texto completo sin truncar en los puntos decimales", () => {
    const text = `Srm-Leucocitos 11.1 x10^3/µL [4 - 10] *
Srm-Hemoglobina 11.8 g/dL [13.5 - 17.5] *
Srm-PCR 18.4 mg/L [0 - 5] *
Srm-Creatinina 0.92 mg/dL [0.7 - 1.2]`;
    const events = runExtractionEngine(text, "2024-01-01");
    const lab = events.find((e) => e.type === "lab_results");
    expect(lab).toBeDefined();
    if (lab?.type === "lab_results") {
      expect(lab.text).toBe(text);
      expect(lab.parameters).toHaveLength(4);
      expect(lab.parameters?.map((p) => p.name)).toEqual(["Leucocitos", "Hemoglobina", "PCR", "Creatinina"]);
      expect(lab.confidence).toBe("confirmado");
      expect(lab.unparsedLines ?? null).toBeNull();
    }
  });

  it("cuando el bloque IANUS trae líneas que no se pueden interpretar con seguridad, las conserva en unparsedLines y marca el evento como 'dato incompleto' en vez de descartarlas", () => {
    const text = `INFORME DE LABORATORIO
Srm-Leucocitos 11.1 x10^3/µL [4 - 10] *
Comentario: se recomienda repetir en 2 semanas.`;
    const events = runExtractionEngine(text, "2024-01-01");
    const lab = events.find((e) => e.type === "lab_results");
    expect(lab).toBeDefined();
    if (lab?.type === "lab_results") {
      expect(lab.parameters).toHaveLength(1);
      expect(lab.unparsedLines).toEqual(["INFORME DE LABORATORIO", "Comentario: se recomienda repetir en 2 semanas."]);
      expect(lab.confidence).toBe("dato incompleto");
      expect(lab.confidenceReason).toMatch(/2 línea/);
    }
  });

  it("detecta un procedimiento explícito (broncoscopia) aunque no se mencione la palabra 'ingreso'", () => {
    const events = runExtractionEngine("Se realiza broncoscopia ambulatoria por hemoptisis leve, sin complicaciones.", "2024-01-01");
    const proc = events.find((e) => e.type === "hospitalization");
    expect(proc).toBeDefined();
    if (proc?.type === "hospitalization") {
      expect(proc.procedureLabel).toMatch(/broncoscopia/i);
    }
  });

  it("una hospitalización sin procedimiento identificado no rellena procedureLabel", () => {
    const events = runExtractionEngine("Ingreso programado para estudio.", "2024-01-01");
    const hosp = events.find((e) => e.type === "hospitalization");
    expect(hosp).toBeDefined();
    if (hosp?.type === "hospitalization") {
      expect(hosp.procedureLabel).toBeUndefined();
    }
  });

  it("detecta una prueba de esfuerzo y la separa como categoría propia, distinta de función pulmonar en reposo y de analítica", () => {
    const events = runExtractionEngine("Prueba de esfuerzo con desaturación hasta 86%.", "2024-01-01");
    const test = events.find((e) => e.type === "exercise_test");
    expect(test).toBeDefined();
    if (test?.type === "exercise_test") {
      expect(test.label).toMatch(/prueba de esfuerzo/i);
      expect(test.text).toContain("desaturación hasta 86%");
    }
    expect(events.some((e) => e.type === "pulmonary_function")).toBe(false);
    expect(events.some((e) => e.type === "lab_results")).toBe(false);
  });
});

/**
 * hasConsultationNarrative — clasificación por contenido de "¿este texto
 * narra la visita/evolución del paciente?", no un fallback genérico. Cada
 * caso de la lista de ejemplos del encargo (un texto por categoría
 * objetiva, más el ejemplo de consulta/evolución narrativa) se prueba por
 * separado para dejar fijado qué SÍ y qué NO cuenta como narrativa.
 */
describe("hasConsultationNarrative", () => {
  it.each([
    ["microbiología", "Cultivo positivo para Pseudomonas aeruginosa."],
    ["radiología", "TC tórax: sin cambios respecto al previo."],
    ["función pulmonar", "FEV1 1,62 L (61%)."],
    ["prueba funcional/esfuerzo", "Prueba de esfuerzo con desaturación hasta 86%."],
    ["analítica", "PCR 180 mg/L, leucocitos 14.000."],
    ["procedimiento", "Broncoscopia con BAL."],
  ])("no considera narrativa un texto que solo trae un dato objetivo de %s ('%s')", (_category, text) => {
    expect(hasConsultationNarrative(text)).toBe(false);
  });

  it("considera narrativa un texto que describe el motivo de la visita ('acude por...')", () => {
    expect(hasConsultationNarrative("Acude por aumento de disnea y expectoración purulenta en la última semana.")).toBe(true);
  });

  it("considera narrativa un texto mixto que combina relato clínico y un dato objetivo, sin dejar de detectar ambos", () => {
    const text = "Acude por aumento de disnea y expectoración purulenta. Cultivo positivo para Pseudomonas aeruginosa.";
    expect(hasConsultationNarrative(text)).toBe(true);
    const events = runExtractionEngine(text, "2024-01-01");
    expect(events.some((e) => e.type === "microbiology")).toBe(true);
  });
});

/**
 * buildCandidateEvents — punto único compartido por AddClinicalInfoModal
 * y NewPatientModal para decidir qué eventos candidatos existen. Un
 * texto vacío es el caso límite del alta inicial sin historia clínica:
 * no debe producir ningún evento, ni siquiera una Consulta de relleno.
 */
describe("buildCandidateEvents", () => {
  it("un texto vacío no produce ningún evento candidato (ni Consulta ni ningún otro)", () => {
    expect(buildCandidateEvents("", "2024-01-01")).toEqual([]);
  });

  it("un texto que solo trae un dato objetivo produce solo ese evento, sin Consulta", () => {
    const events = buildCandidateEvents("Cultivo positivo para Pseudomonas aeruginosa.", "2024-01-01");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("microbiology");
  });

  it("un texto narrativo antepone la Consulta a los eventos extraídos", () => {
    const events = buildCandidateEvents(
      "Acude por aumento de disnea y expectoración purulenta. Cultivo positivo para Pseudomonas aeruginosa.",
      "2024-01-01",
    );
    expect(events.map((e) => e.type)).toEqual(["consultation", "microbiology"]);
  });
});
