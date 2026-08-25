import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, ClipboardList, FlaskConical, Microscope, Pill, ScanLine } from "lucide-react";
import { COLORS } from "./theme";
import type { TimelineGroup } from "@/types/timeline";

/**
 * Color e icono por TimelineGroup — fuente única compartida por
 * TimelineTab y por la vista de revisión de "Añadir información
 * clínica" (ambas necesitan la misma identidad visual por categoría
 * para que el médico reconozca de un vistazo el mismo tipo de elemento
 * en los dos sitios).
 */
export const TIMELINE_GROUPS: TimelineGroup[] = [
  "Consulta",
  "Función pulmonar",
  "Microbiología",
  "Exacerbación",
  "Hospitalización",
  "Tratamiento",
  "Radiología",
  "Analítica",
];

export const GROUP_COLOR: Record<TimelineGroup, string> = {
  Consulta: COLORS.navy,
  "Función pulmonar": COLORS.slate,
  Microbiología: COLORS.orange,
  Exacerbación: COLORS.red,
  Hospitalización: COLORS.red,
  Tratamiento: COLORS.green,
  Radiología: COLORS.teal,
  Analítica: COLORS.violet,
};

export const GROUP_ICON: Record<TimelineGroup, LucideIcon> = {
  Consulta: ClipboardList,
  "Función pulmonar": Activity,
  Microbiología: Microscope,
  Exacerbación: AlertTriangle,
  Hospitalización: AlertTriangle,
  Tratamiento: Pill,
  Radiología: ScanLine,
  Analítica: FlaskConical,
};
