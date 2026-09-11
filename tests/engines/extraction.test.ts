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

  describe("extractPulmonaryFunction — valor absoluto (L) y % predicho en la misma frase", () => {
    it("1) coma decimal, con paréntesis: extrae FEV1 absoluto+%, FVC absoluto+% y el cociente, sin perder ninguno", () => {
      const events = runExtractionEngine("FEV1 1,58 L (62%), FVC 2,41 L (73%), FEV1/FVC 65%.", "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({
        FEV1Liters: 1.58,
        FEV1Percent: 62,
        FVCLiters: 2.41,
        FVCPercent: 73,
        FEV1FVCRatio: 65,
      });
    });

    it("2) el mismo formato con punto decimal", () => {
      const events = runExtractionEngine("FEV1 1.58 L (62%), FVC 2.41 L (73%), FEV1/FVC 65%.", "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({
        FEV1Liters: 1.58,
        FEV1Percent: 62,
        FVCLiters: 2.41,
        FVCPercent: 73,
        FEV1FVCRatio: 65,
      });
    });

    it("3) PFR en varias líneas: cada etiqueta en su propia línea, sin que una cláusula invada la siguiente", () => {
      const text = "FEV1: 1,58 L (62%)\nFVC: 2,41 L (73%)\nFEV1/FVC: 65%";
      const events = runExtractionEngine(text, "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({
        FEV1Liters: 1.58,
        FEV1Percent: 62,
        FVCLiters: 2.41,
        FVCPercent: 73,
        FEV1FVCRatio: 65,
      });
    });

    it("4) PFR incompleta: solo trae FEV1 — no inventa FVC ni el cociente, quedan null", () => {
      const events = runExtractionEngine("FEV1 1,58 L (62%).", "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({
        FEV1Liters: 1.58,
        FEV1Percent: 62,
        FVCLiters: null,
        FVCPercent: null,
        FEV1FVCRatio: null,
      });
    });

    it("5) valores con z-score además del absoluto y el % predicho, para FEV1, FVC y el cociente", () => {
      const text = "FEV1 1,58 L (62%, z-score -1.9), FVC 2,41 L (73%, z-score -0.8), FEV1/FVC 65% (z-score -1.2).";
      const events = runExtractionEngine(text, "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({
        FEV1Liters: 1.58,
        FEV1Percent: 62,
        FEV1zScore: -1.9,
        FVCLiters: 2.41,
        FVCPercent: 73,
        FVCzScore: -0.8,
        FEV1FVCRatio: 65,
        FEV1FVCzScore: -1.2,
      });
    });

    it("tolera 'FEV1 / FVC' con espacios alrededor de la barra", () => {
      const events = runExtractionEngine("FEV1 1,58 L (62%), FVC 2,41 L (73%), FEV1 / FVC 65%.", "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({ FEV1Percent: 62, FVCPercent: 73, FEV1FVCRatio: 65 });
    });

    it("tolera 'Cociente FEV1/FVC'", () => {
      const events = runExtractionEngine("FEV1 1,58 L (62%), FVC 2,41 L (73%), Cociente FEV1/FVC 65%.", "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({ FEV1Percent: 62, FVCPercent: 73, FEV1FVCRatio: 65 });
    });

    it("tolera el % del predicho antes del valor absoluto (orden invertido)", () => {
      const events = runExtractionEngine("FEV1 62% (1,58 L), FVC 73% (2,41 L).", "2024-01-01");
      const pft = events.find((e) => e.type === "pulmonary_function");
      expect(pft).toMatchObject({ FEV1Liters: 1.58, FEV1Percent: 62, FVCLiters: 2.41, FVCPercent: 73 });
    });
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

  describe("extractTreatments — farmacológico y no farmacológico, nunca mezclados", () => {
    it("inicio de antibiótico: dosis, frecuencia y duración, todo capturado sin perder ninguno", () => {
      const events = runExtractionEngine("Se inicia ciprofloxacino 750 mg cada 12 horas durante 14 días.", "2024-01-01");
      const treatment = events.find((e) => e.type === "treatment_started");
      expect(treatment).toMatchObject({
        drug: "ciprofloxacino",
        dose: "750 mg",
        frequency: "cada 12 horas",
        duration: "durante 14 días",
        changeNote: null,
      });
    });

    it("cambio de dosis: no es un 'inicio' — captura la nueva dosis y deja constancia del cambio", () => {
      const events = runExtractionEngine("Se aumenta la dosis de azitromicina a 500 mg.", "2024-01-01");
      const treatment = events.find((e) => e.type === "treatment_started");
      expect(treatment).toMatchObject({ drug: "azitromicina", dose: "500 mg", changeNote: "aumento de dosis" });
    });

    it("suspensión: sigue generando treatment_stopped, sin dosis/frecuencia/duración (el tipo no las tiene)", () => {
      const events = runExtractionEngine("Se suspende el tratamiento con ciprofloxacino por intolerancia digestiva.", "2024-01-01");
      const treatment = events.find((e) => e.type === "treatment_stopped");
      expect(treatment).toMatchObject({ drug: "ciprofloxacino" });
    });

    it("tratamiento crónico/de mantenimiento: inicio válido, y sin fecha de fin inventada al no haber 'durante N...'", () => {
      const events = runExtractionEngine(
        "Se inicia azitromicina 250 mg cada 24 horas como tratamiento supresor crónico, sin fecha de fin prevista.",
        "2024-01-01",
      );
      const treatment = events.find((e) => e.type === "treatment_started");
      expect(treatment).toMatchObject({ drug: "azitromicina", dose: "250 mg", frequency: "cada 24 horas", duration: null });
    });

    it("fisioterapia respiratoria: tratamiento no farmacológico propio, nunca tratado como fármaco (sin dosis)", () => {
      const events = runExtractionEngine("Se intensifica fisioterapia respiratoria.", "2024-01-01");
      expect(events).toHaveLength(1);
      const treatment = events[0];
      expect(treatment).toMatchObject({ type: "treatment_started", drug: "fisioterapia respiratoria", dose: null, changeNote: "intensificación" });
    });

    it("combinación farmacológico + no farmacológico en la misma frase: dos eventos separados, cada uno con su propio fragmento", () => {
      const text = "Se inicia ciprofloxacino 750 mg cada 12 horas durante 14 días y se intensifica fisioterapia respiratoria.";
      const events = runExtractionEngine(text, "2024-01-01");
      const treatments = events.filter((e) => e.type === "treatment_started");
      expect(treatments).toHaveLength(2);

      const antibiotic = treatments.find((t) => t.drug === "ciprofloxacino")!;
      const physio = treatments.find((t) => t.drug === "fisioterapia respiratoria")!;
      expect(antibiotic).toBeDefined();
      expect(physio).toBeDefined();

      expect(antibiotic).toMatchObject({ dose: "750 mg", frequency: "cada 12 horas", duration: "durante 14 días", changeNote: null });
      expect(physio).toMatchObject({ dose: null, frequency: null, duration: null, changeNote: "intensificación" });

      // Ni el fragmento propio ni el del documento completo se comparten entre farmacológico y no farmacológico.
      expect(antibiotic.rawText).not.toBe(text);
      expect(physio.rawText).not.toBe(text);
      expect(antibiotic.rawText).not.toContain("fisioterapia");
      expect(physio.rawText).not.toContain("ciprofloxacino");
      expect(physio.rawText).not.toContain("750 mg");
    });
  });

  describe("extractConsultation — constantes vitales de la exploración, sin perderlas del fragmento", () => {
    it("bug reportado: SatO₂, FR, FC y 'afebril' no se pierden del rawText ni de los campos estructurados", () => {
      const text =
        "Consulta de seguimiento por aumento de tos y expectoración purulenta de 6 días de evolución. " +
        "Refiere disnea algo mayor de la habitual. SatO₂ 91% basal, FR 22 rpm, FC 96 lpm. Afebril.";
      const events = runExtractionEngine(text, "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      expect(consulta).toBeDefined();
      // Regla fundamental: el fragmento conserva las constantes, no se corta antes de ellas.
      expect(consulta!.rawText).toBe(text);
      expect(consulta).toMatchObject({
        oxygenSaturationPercent: 91,
        respiratoryRate: 22,
        heartRate: 96,
        temperatureCelsius: null,
        bloodPressure: null,
        oxygenTherapy: null,
        afebrile: true,
        hemodynamicallyStable: null,
      });
    });

    it("temperatura (Tª) y TA (tensión arterial), sin confundir una con la otra", () => {
      const text = "Refiere buena tolerancia al tratamiento. Tª 38.2°C, TA 130/85 mmHg.";
      const events = runExtractionEngine(text, "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      expect(consulta).toMatchObject({ temperatureCelsius: 38.2, bloodPressure: "130/85 mmHg" });
    });

    it("oxigenoterapia mencionada en la exploración, cuando aparece", () => {
      const text = "Refiere empeoramiento progresivo. Precisa oxigenoterapia con gafas nasales a 2 lpm durante la consulta.";
      const events = runExtractionEngine(text, "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      expect(consulta!.rawText).toContain("oxigenoterapia");
      if (consulta?.type === "consultation") {
        expect(consulta.oxygenTherapy).toMatch(/oxigenoterapia/i);
      }
    });

    it("'hemodinámicamente estable' se recoge como constante estructurada", () => {
      const text = "Acude por cuadro de disnea de instauración brusca. Hemodinámicamente estable, sin otros hallazgos.";
      const events = runExtractionEngine(text, "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      expect(consulta).toMatchObject({ hemodynamicallyStable: true });
    });

    it("un encabezado explícito 'Consulta:' también extrae las constantes de su propio segmento", () => {
      const events = runExtractionEngine("Consulta:\nRefiere estabilidad clínica. SatO₂ 96%, FC 78 lpm.", "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      expect(consulta).toMatchObject({ oxygenSaturationPercent: 96, heartRate: 78 });
    });

    it("no inventa constantes ausentes: una consulta sin ninguna mención de constantes las deja todas en null", () => {
      const events = runExtractionEngine("Acude a consulta de revisión. Se mantiene clínicamente estable.", "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      expect(consulta).toMatchObject({
        oxygenSaturationPercent: null,
        respiratoryRate: null,
        heartRate: null,
        temperatureCelsius: null,
        bloodPressure: null,
        oxygenTherapy: null,
        afebrile: null,
        hemodynamicallyStable: null,
      });
    });

    it("las constantes de la consulta no se filtran a un evento de otro dominio en la misma frase mixta", () => {
      const text = "Refiere aumento de disnea. SatO₂ 90% basal, FC 100 lpm. FEV1 60%. Cultivo con Pseudomonas aeruginosa.";
      const events = runExtractionEngine(text, "2024-01-01");
      const consulta = events.find((e) => e.type === "consultation");
      const pft = events.find((e) => e.type === "pulmonary_function");
      const micro = events.find((e) => e.type === "microbiology");
      expect(consulta).toMatchObject({ oxygenSaturationPercent: 90, heartRate: 100 });
      expect(consulta!.rawText).not.toMatch(/FEV1|Pseudomonas/);
      expect(pft!.rawText).not.toMatch(/SatO|FC 100/);
      expect(micro!.rawText).not.toMatch(/SatO|FC 100/);
    });
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
