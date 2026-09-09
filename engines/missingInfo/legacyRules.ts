/**
 * LEGACY / EXPERIMENTAL / PENDIENTE DE SUSTITUCIÓN POR GuidelineEngine.
 * ----------------------------------------------------------------------
 * Checklists de "qué falta documentar" por categoría diagnóstica.
 * Heurísticas locales, NO un criterio médico validado. En el futuro
 * deberían generarse a partir de los datos mínimos que cada
 * GuidelineDefinition declare como necesarios para evaluar sus
 * recomendaciones.
 */
import { CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { selectConsultations, selectExacerbations, selectImaging, selectLabResults, selectMicrobiology, selectPFT } from "@/domain/selectors";
import type { DiagnosisCategory } from "@/domain/diagnosis";
import type { Patient } from "@/types/patient";

export function allConsultText(patient: Patient): string {
  return selectConsultations(patient.events)
    .map((v) => v.rawText || "")
    .join(" ")
    .toLowerCase();
}

/** Nombres de todos los LabParameter de categoría "etiologico" registrados, en minúsculas, para buscar por patrón léxico igual que allConsultText. */
function allEtiologicoParameterNames(patient: Patient): string {
  return selectLabResults(patient.events)
    .flatMap((e) => e.parameters ?? [])
    .filter((param) => param.category === "etiologico")
    .map((param) => param.name)
    .join(" ")
    .toLowerCase();
}

export interface MissingInfoRule {
  text: string;
  check(patient: Patient): boolean;
}

export const MISSING_INFO_LEGACY_RULES: Record<DiagnosisCategory, MissingInfoRule[]> = {
  Bronquiectasias: [
    { text: "No consta microbiología reciente.", check: (p) => !selectMicrobiology(p.events).length },
    { text: "No consta cultivo para micobacterias.", check: (p) => !selectMicrobiology(p.events).some((m) => /micobact/i.test(m.organism)) },
    { text: "No consta número de exacerbaciones documentado.", check: (p) => !selectExacerbations(p.events).length },
    { text: "No consta escala FACED/E-FACED.", check: (p) => !/faced|e-faced/i.test(allConsultText(p)) },
    { text: "No consta revisión de fisioterapia respiratoria.", check: (p) => !/fisioterapia/i.test(allConsultText(p)) },
    // Las 3 reglas siguientes respaldadas por SEPAR 2018, Tabla 1 (separ-def-tabla1-causas): "Déficit de
    // producción de anticuerpos — Inmunoglobulinas", "ABPA" y "Déficit de AAT". No se añaden reglas para IgE
    // total, subclases de IgG por separado ni autoinmunidad: ninguna guía cargada las nombra individualmente.
    { text: "No consta estudio de inmunoglobulinas (déficit de anticuerpos).", check: (p) => !/\big[gam]\b|inmunoglobulina/i.test(allEtiologicoParameterNames(p)) },
    { text: "No consta cribado de ABPA/Aspergillus.", check: (p) => !/abpa|aspergillus/i.test(allEtiologicoParameterNames(p)) },
    { text: "No consta cribado de déficit de alfa-1-antitripsina.", check: (p) => !/alfa-1-antitripsina|alfa1|\baat\b/i.test(allEtiologicoParameterNames(p)) },
  ],
  EPOC: [
    { text: "No consta espirometría reciente.", check: (p) => !selectPFT(p.events).length },
    { text: "No consta escala de disnea (mMRC).", check: (p) => !/mmrc|disnea/i.test(allConsultText(p)) },
    { text: "No consta valoración de necesidad de oxígeno.", check: (p) => !p.events.some((e) => e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT) },
    { text: "No consta estado de vacunación.", check: (p) => !/vacun/i.test(allConsultText(p)) },
  ],
  "Fibrosis pulmonar": [
    {
      text: "No consta FVC reciente.",
      check: (p) => {
        const l = selectPFT(p.events);
        return !l.length || l[l.length - 1].FVCPercent == null;
      },
    },
    {
      text: "No consta DLCO reciente.",
      check: (p) => {
        const l = selectPFT(p.events);
        return !l.length || l[l.length - 1].DLCOPercent == null;
      },
    },
    { text: "No consta TCAR reciente.", check: (p) => !selectImaging(p.events).length },
    { text: "No consta valoración de necesidad de oxígeno.", check: (p) => !p.events.some((e) => e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT) },
    {
      text: "No consta tratamiento antifibrótico.",
      check: (p) =>
        !p.events.some(
          (e) => e.type === CLINICAL_EVENT_TYPES.TREATMENT_STARTED && /nintedanib|pirfenidona/i.test(e.drug || ""),
        ),
    },
  ],
  General: [
    { text: "No consta función pulmonar registrada.", check: (p) => !selectPFT(p.events).length },
    { text: "No consta prueba de imagen registrada.", check: (p) => !selectImaging(p.events).length },
  ],
};
