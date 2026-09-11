import { describe, expect, it } from "vitest";
import { buildClinicalCandidates } from "@/engines/extraction";
import type { ClinicalEvent } from "@/types/clinicalEvent";

/**
 * Tests end-to-end del pipeline de segmentación (segmentClinicalText →
 * classifySegment → extractores por categoría → ClinicalEvent[], ver
 * engines/extraction/pipeline.ts) contra bloques clínicos largos y
 * mixtos — el caso real que motivó el rediseño completo. Cada test
 * comprueba explícitamente que ningún evento contiene texto de otro
 * dominio (regla fundamental: rawText de un evento nunca es el
 * documento completo), que no se pierde información relevante, y que no
 * se generan duplicados.
 */

function byType<T extends ClinicalEvent["type"]>(events: ClinicalEvent[], type: T): Extract<ClinicalEvent, { type: T }>[] {
  return events.filter((e): e is Extract<ClinicalEvent, { type: T }> => e.type === type);
}

describe("Pipeline de extracción — bloques clínicos mixtos largos", () => {
  it("1) Consulta + PFR + microbiología + analítica + radiología + tratamiento: cada evento contiene SOLO su fragmento", () => {
    const text = `Consulta:
Acude a consulta de revisión. Refiere estabilidad clínica, sin aumento de disnea ni expectoración purulenta.

Función pulmonar:
FEV1 68%, z-score -1.9. FVC 76%. DLCO 65%.

Microbiología:
Cultivo de esputo con Pseudomonas aeruginosa, sensible a ciprofloxacino.

Analítica:
Srm-Leucocitos 9.500/µL [4000 - 11000]
Srm-PCR 12 mg/L [0 - 5] *

Radiología:
TC tórax con bronquiectasias cilíndricas bilaterales, sin cambios respecto al previo.

Tratamiento:
Se inicia ciprofloxacino 750 mg/12 h durante 14 días.`;

    const { events, unclassifiedSegments } = buildClinicalCandidates(text, "2024-01-01");

    const consulta = byType(events, "consultation")[0];
    const pft = byType(events, "pulmonary_function")[0];
    const micro = byType(events, "microbiology")[0];
    const lab = byType(events, "lab_results")[0];
    const imaging = byType(events, "imaging")[0];
    const treatment = byType(events, "treatment_started")[0];

    expect(consulta).toBeDefined();
    expect(pft).toBeDefined();
    expect(micro).toBeDefined();
    expect(lab).toBeDefined();
    expect(imaging).toBeDefined();
    expect(treatment).toBeDefined();

    // Regla fundamental: rawText de cada evento nunca es el documento completo.
    for (const e of [consulta, pft, micro, lab, imaging, treatment]) {
      expect(e!.rawText).not.toBe(text);
      expect(e!.rawText!.length).toBeLessThan(text.length);
    }

    // Ningún evento contiene texto de otro dominio.
    expect(consulta.rawText).toContain("estabilidad clínica");
    expect(consulta.rawText).not.toMatch(/FEV1|Pseudomonas|Leucocitos|TC tórax|ciprofloxacino 750/);

    expect(pft.FEV1Percent).toBe(68);
    expect(pft.rawText).toContain("FEV1 68%");
    expect(pft.rawText).not.toMatch(/consulta|Pseudomonas|Leucocitos|TC tórax|Se inicia/i);

    expect(micro.organism).toBe("Pseudomonas aeruginosa");
    expect(micro.rawText).toContain("Pseudomonas");
    expect(micro.rawText).not.toMatch(/FEV1|Leucocitos|TC tórax|consulta de revisión/i);

    expect(lab.parameters?.map((p) => p.name)).toEqual(["Leucocitos", "PCR"]);
    expect(lab.rawText).toContain("Leucocitos");
    expect(lab.rawText).not.toMatch(/FEV1|Pseudomonas|TC tórax|Se inicia ciprofloxacino/i);

    expect(imaging.label).toMatch(/TC/i);
    expect(imaging.rawText).toContain("bronquiectasias cilíndricas");
    expect(imaging.rawText).not.toMatch(/FEV1|Pseudomonas|Leucocitos|Se inicia/i);

    expect(treatment.drug).toBe("ciprofloxacino");
    expect(treatment.dose).toBe("750 mg");
    expect(treatment.rawText).toContain("ciprofloxacino 750 mg");
    expect(treatment.rawText).not.toMatch(/FEV1|Leucocitos|TC tórax|consulta de revisión/i);

    // No hay duplicados: un único evento por categoría reconocible.
    expect(byType(events, "consultation")).toHaveLength(1);
    expect(byType(events, "pulmonary_function")).toHaveLength(1);
    expect(byType(events, "microbiology")).toHaveLength(1);
    expect(byType(events, "lab_results")).toHaveLength(1);
    expect(byType(events, "imaging")).toHaveLength(1);
    expect(byType(events, "treatment_started")).toHaveLength(1);
    expect(unclassifiedSegments).toEqual([]);
  });

  it("2) Dos episodios separados temporalmente: el episodio nuevo no hereda el episodeId del ingreso previo", () => {
    const text = `Ingreso:
Ingreso hospitalario por agudización de bronquiectasias con fiebre y aumento de expectoración purulenta.

Microbiología:
Cultivo de esputo con Pseudomonas aeruginosa, sensible a ciprofloxacino.

Tratamiento:
Se inicia ceftazidima 2 g/8 h intravenosa.

Tres meses después:
Nueva consulta de revisión. Se encuentra estable, sin nuevos episodios.

Microbiología:
Cultivo de esputo con Haemophilus influenzae, sensible a amoxicilina.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");

    const exac = byType(events, "exacerbation")[0];
    expect(exac).toBeDefined();
    expect(exac.hospitalization).toBe(true);
    expect(exac.episodeId).toBe(exac.id);

    const [firstMicro, secondMicro] = byType(events, "microbiology");
    expect(firstMicro.organism).toBe("Pseudomonas aeruginosa");
    expect(secondMicro.organism).toBe("Haemophilus influenzae");

    // El primer episodio (durante el ingreso) enlaza al contenedor; el segundo, tres meses después, no.
    expect(firstMicro.episodeId).toBe(exac.id);
    expect(secondMicro.episodeId).not.toBe(exac.id);
    expect(secondMicro.episodeId).toBeNull();

    const treatment = byType(events, "treatment_started")[0];
    expect(treatment.drug).toBe("ceftazidima");
    expect(treatment.episodeId).toBe(exac.id);

    // La consulta de 3 meses después es un evento propio, distinto del ingreso, sin arrastrar su texto.
    const consultations = byType(events, "consultation");
    expect(consultations).toHaveLength(1);
    expect(consultations[0].episodeId).toBeNull();
    expect(consultations[0].rawText).not.toMatch(/Pseudomonas|ceftazidima|agudización/i);
  });

  it("3) Texto sin encabezados: sigue extrayendo varias categorías, cada una con su propio fragmento, marcadas para revisar por la mezcla sin delimitar", () => {
    const text =
      "Refiere una exacerbación moderada. Cultivo de esputo con Pseudomonas aeruginosa sensible a ciprofloxacino. " +
      "FEV1 70%. TC tórax con progresión leve de bronquiectasias. Analítica con PCR 30 mg/L. " +
      "Se inicia azitromicina 250 mg lunes, miércoles y viernes.";

    const { events, unclassifiedSegments } = buildClinicalCandidates(text, "2024-01-01");

    const exac = byType(events, "exacerbation")[0];
    const micro = byType(events, "microbiology")[0];
    const pft = byType(events, "pulmonary_function")[0];
    const imaging = byType(events, "imaging")[0];
    const lab = byType(events, "lab_results")[0];
    const treatment = byType(events, "treatment_started")[0];

    expect(exac).toBeDefined();
    expect(micro).toBeDefined();
    expect(pft).toBeDefined();
    expect(imaging).toBeDefined();
    expect(lab).toBeDefined();
    expect(treatment).toBeDefined();

    for (const e of [exac, micro, pft, imaging, lab, treatment]) {
      expect(e!.rawText).not.toBe(text);
    }
    expect(imaging.rawText).toContain("TC tórax");
    expect(imaging.rawText).not.toContain("azitromicina");
    expect(treatment.rawText).toContain("azitromicina");
    expect(treatment.rawText).not.toContain("Pseudomonas");

    // Sin ningún encabezado ni transición temporal que delimite un párrafo que mezcla 6 categorías:
    // la propia mezcla se marca para revisión, no se asume "confirmado" por defecto.
    for (const e of [exac, micro, pft, imaging, lab, treatment]) {
      expect(e!.confidence).not.toBe("confirmado");
    }
    expect(unclassifiedSegments).toEqual([]);
  });

  it("4) Bloque IANUS realista dentro de una nota clínica: un único LabResultsEvent con sus parameters, sin recibir la consulta ni el resto", () => {
    const text = `Consulta:
Acude a revisión programada. Se mantiene clínicamente estable.

Analítica:
San-Leucocitos 9.8 x10^3/µL [4 - 10]
San-Hemoglobina 13.2 g/dL [12 - 16]
Srm-PCR 6 mg/L [0 - 5] *
Srm-Creatinina 0.8 mg/dL [0.6 - 1.2]

Tratamiento:
Se mantiene azitromicina 250 mg lunes, miércoles y viernes.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");
    const labs = byType(events, "lab_results");
    expect(labs).toHaveLength(1);
    const lab = labs[0];
    expect(lab.parameters?.map((p) => p.name)).toEqual(["Leucocitos", "Hemoglobina", "PCR", "Creatinina"]);
    expect(lab.rawText).not.toMatch(/consulta|revisión programada|azitromicina/i);

    const consulta = byType(events, "consultation")[0];
    expect(consulta).toBeDefined();
    expect(consulta.rawText).not.toMatch(/Leucocitos|San-|Srm-/);
  });

  it("5) Hospitalización con tratamiento, microbiología y alta: todo enlazado por episodeId, sin copiar contenido entre eventos", () => {
    const text = `Ingreso:
Ingreso hospitalario por agudización de bronquiectasias con fiebre y aumento de expectoración purulenta.

Microbiología:
Cultivo de esputo con Pseudomonas aeruginosa, sensible a ciprofloxacino.

Tratamiento:
Se inicia ceftazidima 2 g/8 h intravenosa.

Alta:
Se pauta ciprofloxacino 750 mg/12 h oral para completar tratamiento domiciliario.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");
    const exac = byType(events, "exacerbation")[0];
    expect(exac.hospitalization).toBe(true);

    const micro = byType(events, "microbiology")[0];
    const [ceftazidima, ciprofloxacino] = byType(events, "treatment_started");
    expect(ceftazidima.drug).toBe("ceftazidima");
    expect(ciprofloxacino.drug).toBe("ciprofloxacino");

    for (const e of [micro, ceftazidima, ciprofloxacino]) {
      expect(e.episodeId).toBe(exac.id);
    }
    // El tratamiento de ingreso y el del alta no comparten fragmento — cada uno el suyo.
    expect(ceftazidima.rawText).not.toBe(ciprofloxacino.rawText);
    expect(ceftazidima.rawText).not.toContain("domiciliario");
    expect(ciprofloxacino.rawText).not.toContain("intravenosa");
  });

  it("6) Líneas no clasificables se conservan para revisión, nunca se descartan ni se convierten en Consulta", () => {
    const text = `Observaciones administrativas sin relevancia clínica reconocible por el sistema.
Firmado electrónicamente el 03/01/2024.

Analítica:
Srm-Leucocitos 9.500/µL [4000 - 11000]`;

    const { events, unclassifiedSegments } = buildClinicalCandidates(text, "2024-01-01");
    expect(byType(events, "consultation")).toEqual([]);
    expect(unclassifiedSegments).toEqual(["Observaciones administrativas sin relevancia clínica reconocible por el sistema.\nFirmado electrónicamente el 03/01/2024."]);
    // El contenido no clasificado no impide que el resto del bloque se procese con normalidad.
    expect(byType(events, "lab_results")).toHaveLength(1);
  });

  it("7) Sin narrativa de consulta en todo el bloque: no se crea ningún evento de Consulta", () => {
    const text = `Función pulmonar:
FEV1 72%. FVC 88%.

Microbiología:
Cultivo de esputo con Haemophilus influenzae, sensible a amoxicilina.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");
    expect(byType(events, "consultation")).toEqual([]);
    expect(byType(events, "pulmonary_function")).toHaveLength(1);
    expect(byType(events, "microbiology")).toHaveLength(1);
  });

  it("8) Ningún evento contiene texto de otro dominio, comprobado sobre el bloque mixto completo del test 1", () => {
    const text = `Consulta:
Refiere aumento de disnea de esfuerzo en la última semana.

Función pulmonar:
FEV1 60%. FVC 70%.

Microbiología:
Cultivo con Pseudomonas aeruginosa, resistente a ciprofloxacino.

Radiología:
TC tórax con impactación mucosa en língula.

Tratamiento:
Se inicia tobramicina inhalada.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");
    const domainMarkers: Record<string, RegExp> = {
      consultation: /disnea de esfuerzo/i,
      pulmonary_function: /FEV1 60%/,
      microbiology: /Pseudomonas/,
      imaging: /impactación mucosa/i,
      treatment_started: /tobramicina/i,
    };
    for (const e of events) {
      const ownMarker = domainMarkers[e.type];
      if (!ownMarker) continue;
      expect(e.rawText).toMatch(ownMarker);
      for (const [otherType, otherMarker] of Object.entries(domainMarkers)) {
        if (otherType === e.type) continue;
        expect(e.rawText).not.toMatch(otherMarker);
      }
    }
  });

  it("9) Ningún fragmento importante se pierde: los 5 encabezados del bloque mixto producen sus 5 categorías", () => {
    const text = `Consulta:
Refiere buena tolerancia al tratamiento actual.

Función pulmonar:
FEV1 65%. DLCO 55%.

Microbiología:
Cultivo con Achromobacter xylosoxidans.

Radiología:
Rx tórax sin cambios significativos.

Tratamiento:
Se inicia colistina inhalada.`;

    const { events, unclassifiedSegments } = buildClinicalCandidates(text, "2024-01-01");
    expect(byType(events, "consultation")).toHaveLength(1);
    expect(byType(events, "pulmonary_function")).toHaveLength(1);
    expect(byType(events, "microbiology")).toHaveLength(1);
    expect(byType(events, "imaging")).toHaveLength(1);
    expect(byType(events, "treatment_started")).toHaveLength(1);
    expect(unclassifiedSegments).toEqual([]);
  });

  it("10) No se generan duplicados: un bloque con dos fármacos distintos produce exactamente dos TreatmentStartedEvent, uno por fármaco", () => {
    const text = `Tratamiento:
Se inicia azitromicina 250 mg lunes, miércoles y viernes. Se inicia tobramicina inhalada.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");
    const treatments = byType(events, "treatment_started");
    expect(treatments).toHaveLength(2);
    expect(treatments.map((t) => t.drug).sort()).toEqual(["azitromicina", "tobramicina"]);
    expect(treatments[0].rawText).not.toBe(treatments[1].rawText);
  });

  it("11) Un ingreso introducido por una transición temporal (sin encabezado 'Ingreso:') no genera una Consulta casi vacía y duplicada con la propia narrativa de la exacerbación", () => {
    const text = `Consulta:
Acude a consulta de revisión. Refiere estabilidad clínica.

Tres meses después:
Ingreso hospitalario por agudización de bronquiectasias con fiebre y aumento de expectoración purulenta.

Durante el ingreso: se añade ceftazidima IV.`;

    const { events } = buildClinicalCandidates(text, "2024-01-01");

    // Solo la consulta inicial (con narrativa genuina y propia) produce un evento de Consulta.
    const consultations = byType(events, "consultation");
    expect(consultations).toHaveLength(1);
    expect(consultations[0].rawText).toContain("estabilidad clínica");
    expect(consultations[0].rawText).not.toMatch(/agudización|expectoración purulenta/i);

    const exac = byType(events, "exacerbation")[0];
    expect(exac).toBeDefined();
    expect(exac.hospitalization).toBe(true);

    const treatment = byType(events, "treatment_started")[0];
    expect(treatment.drug).toBe("ceftazidima");
    expect(treatment.episodeId).toBe(exac.id);
  });
});

describe("Pipeline de extracción — resolución temporal (datePrecision/dateSource/temporalExpression)", () => {
  it("un bloque con varias transiciones temporales produce eventos con fechas distintas, no todos la fecha de importación", () => {
    const text = `Consulta inicial. Tos y expectoración purulenta.

Control a las 3 semanas: mejoría clínica, se realiza espirometría. FEV1 72%, FVC 80%.

Tres meses después: nueva agudización, requiere ingreso hospitalario para tratamiento IV.

Alta hospitalaria tras 5 días: paciente estable.

Dos meses después del alta: revisión en consulta, FEV1 68%.`;

    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const dates = events.map((e) => e.date);
    expect(new Set(dates).size).toBeGreaterThan(1);

    const pfts = byType(events, "pulmonary_function");
    expect(pfts.map((p) => p.date)).toEqual(["2026-10-02", "2027-03-07"]);
    expect(pfts.every((p) => p.datePrecision === "derived" && p.dateSource === "relative_offset")).toBe(true);

    const exac = byType(events, "exacerbation")[0];
    expect(exac.date).toBe("2027-01-02");
    expect(exac.temporalExpression).toBe("Tres meses después");
  });

  it("el primer segmento (sin transición) se marca 'derived'/'import_anchor', nunca 'documented' — no es una fecha que el texto declare", () => {
    const { events } = buildClinicalCandidates("Consulta de seguimiento. Estable, sin cambios.", "2026-09-11");
    expect(events[0].datePrecision).toBe("derived");
    expect(events[0].dateSource).toBe("import_anchor");
    expect(events[0].temporalExpression).toBeNull();
  });

  it("una fecha explícita documentada en el texto ('en marzo de 2027') se marca 'documented'/'explicit_date'", () => {
    const text = `Consulta inicial.

En marzo de 2027: revisión anual, estable.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const later = events.find((e) => e.date === "2027-03-01");
    expect(later).toBeDefined();
    expect(later?.datePrecision).toBe("documented");
    expect(later?.dateSource).toBe("explicit_date");
  });

  it("'al alta' sin duración explícita produce un evento con datePrecision 'unresolved' y confidence rebajada, explicando la expresión temporal no resuelta", () => {
    const text = `Ingreso hospitalario por agudización grave, se inicia antibiótico IV.

Al alta: paciente estable, se retira oxígeno suplementario.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const unresolvedEvent = events.find((e) => e.temporalExpression === "Al alta");
    expect(unresolvedEvent).toBeDefined();
    expect(unresolvedEvent?.datePrecision).toBe("unresolved");
    expect(unresolvedEvent?.confidence).not.toBe("confirmado");
    expect(unresolvedEvent?.confidenceReason).toMatch(/no se ha podido resolver.*fecha.*"Al alta"/i);
  });

  it("cuando un motivo de baja confianza específico de la categoría YA existe (exacerbación 'posible'), la rebaja por fecha no resuelta se concatena en vez de sustituirlo", () => {
    // "Posteriormente" no tiene cantidad reconocible → queda unresolved. El propio extractor de
    // exacerbación, por su lado, marca "posible" porque el texto no usa el término "exacerbación"
    // explícitamente (solo signos + antibiótico) — ambos motivos deben conservarse, ninguno debe tapar al otro.
    const text = `Consulta inicial. Estable.

Posteriormente: empeoramiento respiratorio, se inicia ciprofloxacino.`;
    const { events } = buildClinicalCandidates(text, "2026-09-11");
    const exac = byType(events, "exacerbation").find((e) => e.temporalExpression === "Posteriormente");
    expect(exac).toBeDefined();
    expect(exac?.datePrecision).toBe("unresolved");
    expect(exac?.confidence).toBe("posible");
    expect(exac?.confidenceReason).toMatch(/no utiliza explícitamente el término "exacerbación"/i);
    expect(exac?.confidenceReason).toMatch(/no se ha podido resolver.*"Posteriormente"/i);
  });
});
