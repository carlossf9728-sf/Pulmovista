export type TimelineGroup =
  | "Consulta"
  | "Función pulmonar"
  | "Microbiología"
  | "Exacerbación"
  | "Hospitalización"
  | "Tratamiento"
  | "Radiología";

/** Representación de un ClinicalEvent para la pestaña Timeline. */
export interface TimelineEntry {
  group: TimelineGroup;
  title: string;
  detail: string;
}
