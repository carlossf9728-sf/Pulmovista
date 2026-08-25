import type { PatientStatus } from "@/types/patient";

/** Tokens de diseño. Réplica exacta de la paleta del prototipo original. */
export const COLORS = {
  navy: "#0B2340",
  navyDeep: "#071A30",
  ink: "#132539",
  slate: "#5B6B7E",
  slateLight: "#8B99A8",
  line: "#E3E9EF",
  paper: "#F6F8FA",
  white: "#FFFFFF",
  teal: "#0EA5A0",
  tealDeep: "#0B7F7B",
  tealTint: "#E4F6F5",
  red: "#D5362F",
  redTint: "#FBEAE9",
  orange: "#C9761A",
  orangeTint: "#FCF0E1",
  green: "#1E8E5A",
  greenTint: "#E7F5EE",
  violet: "#6D4FC2",
  violetTint: "#EEE9FA",
} as const;

export const STATUS: Record<PatientStatus, { label: string; color: string; tint: string }> = {
  deterioro: { label: "Deterioro reciente", color: COLORS.red, tint: COLORS.redTint },
  revision: { label: "Requiere revisión", color: COLORS.orange, tint: COLORS.orangeTint },
  estable: { label: "Estable", color: COLORS.green, tint: COLORS.greenTint },
};

