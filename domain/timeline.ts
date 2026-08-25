import { cap } from "@/utils/text";
import { CLINICAL_EVENT_TYPES } from "./clinicalEvent";
import type { ClinicalEvent } from "@/types/clinicalEvent";
import type { TimelineEntry } from "@/types/timeline";

/** Traduce un ClinicalEvent a su representación en la línea de tiempo. Réplica exacta de `displayForEvent()`. */
export function displayForEvent(e: ClinicalEvent): TimelineEntry {
  switch (e.type) {
    case CLINICAL_EVENT_TYPES.CONSULTATION:
      return { group: "Consulta", title: "Consulta / evolución", detail: e.rawText || "" };
    case CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION:
      return {
        group: "Función pulmonar",
        title: `FEV1 ${e.FEV1Percent ?? "—"}%${e.FVCPercent ? ` · FVC ${e.FVCPercent}%` : ""}`,
        detail: `DLCO ${e.DLCOPercent ?? "No disponible"}%`,
      };
    case CLINICAL_EVENT_TYPES.MICROBIOLOGY:
      return {
        group: "Microbiología",
        title: `Cultivo: ${e.organism}`,
        detail:
          `${e.sensitivity?.length ? "Sensible a " + e.sensitivity.join(", ") + ". " : ""}${
            e.resistance?.length ? "Resistente a " + e.resistance.join(", ") + "." : ""
          }` || "Sin antibiograma registrado",
      };
    case CLINICAL_EVENT_TYPES.EXACERBATION:
      return {
        group: "Exacerbación",
        title: `Exacerbación${e.severity ? " " + e.severity.toLowerCase() : ""}${e.hospitalization ? " (hospitalización)" : ""}`,
        detail: e.confidenceReason || `Tratamiento: ${e.treatment || "No disponible"}`,
      };
    case CLINICAL_EVENT_TYPES.HOSPITALIZATION:
      return {
        group: "Hospitalización",
        title: e.procedureLabel ? `Ingreso/procedimiento: ${e.procedureLabel}` : "Hospitalización registrada",
        detail: e.confidenceReason || "Sin detalle adicional.",
      };
    case CLINICAL_EVENT_TYPES.IMAGING:
      return { group: "Radiología", title: e.label, detail: e.text };
    case CLINICAL_EVENT_TYPES.LAB_RESULTS:
      return { group: "Analítica", title: e.label, detail: e.text };
    case CLINICAL_EVENT_TYPES.TREATMENT_STARTED:
    case CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT:
      return {
        group: "Tratamiento",
        title: `Inicio: ${cap(e.drug)}`,
        detail: e.dose ? `Dosis: ${e.dose}${e.schedule ? " · " + e.schedule : ""}` : "En curso",
      };
    case CLINICAL_EVENT_TYPES.TREATMENT_STOPPED:
      return { group: "Tratamiento", title: `Finalizado: ${cap(e.drug)}`, detail: "Tratamiento retirado" };
    default:
      return { group: "Consulta", title: "Evento clínico", detail: e.rawText || "" };
  }
}
