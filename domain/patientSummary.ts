import { formatDate, todayISO } from "@/utils/date";
import { formatAge } from "@/utils/text";
import { exacerbationsByYear, selectConsultations, selectHospitalizationCount, selectMicrobiology, selectPFT, selectTreatments } from "@/domain/selectors";
import { computeChangesSinceLastVisit } from "@/engines/longitudinal";
import { computeMissingInfo } from "@/engines/missingInfo";
import type { Patient } from "@/types/patient";

/**
 * Campos de "Estado actual" de la pestaña Resumen. Viven aquí (y no en
 * SummaryTab) para que el texto de "Copiar resumen" muestre exactamente
 * los mismos valores que ve el médico en pantalla. `null` = no disponible.
 */
export function currentStatusFields(patient: Patient): [string, string | null][] {
  const pft = selectPFT(patient.events).slice(-1)[0];
  const years = exacerbationsByYear(patient);
  const lastYear = years.length ? years[years.length - 1] : null;
  const hospTotal = selectHospitalizationCount(patient.events, null) || selectHospitalizationCount(patient.events, todayISO());
  const lastMicro = selectMicrobiology(patient.events).slice(-1)[0];
  const activeTreatments = selectTreatments(patient.events).filter((t) => t.status === "Activo");
  return [
    ["FEV1 más reciente", pft ? `${pft.FEV1Percent != null ? `${pft.FEV1Percent}%` : "—"}${pft.FEV1Liters ? ` (${pft.FEV1Liters} L)` : ""}` : null],
    ["FVC", pft && pft.FVCPercent != null ? `${pft.FVCPercent}%${pft.FVCLiters ? ` (${pft.FVCLiters} L)` : ""}` : null],
    ["DLCO", pft && pft.DLCOPercent != null ? `${pft.DLCOPercent}%` : null],
    [lastYear ? `Exacerbaciones en ${lastYear.year}` : "Exacerbaciones (año en curso)", lastYear ? `${lastYear.count}` : null],
    ["Hospitalizaciones (acumuladas)", hospTotal != null ? `${hospTotal}` : null],
    ["Microbiología relevante", lastMicro ? `${lastMicro.organism} (${formatDate(lastMicro.date)})` : null],
    ["Tratamiento y soporte actual", activeTreatments.length ? activeTreatments.map((t) => t.name).join(", ") : null],
  ];
}

/** Diagnóstico principal + secundarios, tal como se listan en "Estado actual". */
export function activeProblems(patient: Patient): string[] {
  return [patient.primaryDiagnosis, ...patient.secondaryDiagnoses.split(/[,;]/).map((s) => s.trim())].filter(Boolean);
}

/**
 * Resumen en texto plano para "Copiar resumen" (pegar en la historia o en
 * un correo al adjunto). Solo reutiliza datos ya calculados por los
 * motores existentes — no añade interpretación nueva — y nunca incluye
 * más identificación que el código PulmoVista.
 */
export function buildPatientSummaryText(patient: Patient): string {
  const lastConsult = selectConsultations(patient.events).slice(-1)[0];
  const lines: string[] = [
    `Resumen PulmoVista · ${patient.code}`,
    `${patient.sex} · ${formatAge(patient.age)} · Primera valoración: ${formatDate(patient.createdAt)} · Última actualización: ${formatDate(lastConsult?.date)}`,
    "",
    "Diagnósticos:",
    ...activeProblems(patient).map((p) => `- ${p}`),
    "",
    "Estado actual:",
    ...currentStatusFields(patient).map(([label, value]) => `- ${label}: ${value ?? "No disponible"}`),
  ];

  const changes = computeChangesSinceLastVisit(patient);
  lines.push("");
  if (!changes) {
    lines.push("Cambios desde la última consulta: aún no hay suficientes consultas para comparar.");
  } else {
    lines.push(`Cambios desde la última consulta (${formatDate(changes.fromDate)} → ${formatDate(changes.toDate)}):`);
    if (!changes.changes.length) lines.push("- Sin cambios relevantes detectados.");
    for (const c of changes.changes) lines.push(`- ${c.label}: ${c.from} → ${c.to}`);
  }

  const missing = computeMissingInfo(patient);
  const missingLines = [...missing.items, ...missing.groups.map((g) => g.title)];
  lines.push("", "Información que falta:");
  if (!missingLines.length) lines.push("- No se han identificado ausencias relevantes para este diagnóstico.");
  for (const m of missingLines) lines.push(`- ${m}`);

  lines.push("", "Prototipo de investigación — revisar siempre contra la historia clínica original.");
  return lines.join("\n");
}
