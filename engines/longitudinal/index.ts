/**
 * LongitudinalEngine — DETECCIÓN OBJETIVA.
 * ----------------------------------------------------------------------
 * Compara el estado del paciente entre dos fechas y señala discrepancias
 * de datos. Deliberadamente no interpreta ni recomienda: eso es
 * responsabilidad de Sentinel/Turning Points (hoy legacy) y, en el
 * futuro, de GuidelineEngine.
 */
import { uid } from "@/utils/id";
import { monthsBetween } from "@/utils/date";
import { formatDate } from "@/utils/date";
import { selectConsultations, selectPFT, getStateAsOf } from "@/domain/selectors";
import type { Patient } from "@/types/patient";
import type { ChangeKind, ChangesSinceLastVisit, DataContradiction } from "@/types/longitudinal";

export function computeChangesSinceLastVisit(patient: Patient): ChangesSinceLastVisit | null {
  const consults = selectConsultations(patient.events);
  if (consults.length < 2) return null;
  const prevDate = consults[consults.length - 2].date;
  const lastDate = consults[consults.length - 1].date;
  const prev = getStateAsOf(patient, prevDate);
  const curr = getStateAsOf(patient, lastDate);
  const changes: ChangesSinceLastVisit["changes"] = [];
  const unchanged: string[] = [];

  const num = (label: string, a: number | null, b: number | null, suffix = "%") => {
    if (a == null || b == null) return;
    if (a === b) {
      unchanged.push(label);
      return;
    }
    const kind: ChangeKind = b < a ? "disminuido" : "aumentado";
    changes.push({ label, from: `${a}${suffix}`, to: `${b}${suffix}`, kind });
  };
  num("FEV1", prev.fev1, curr.fev1);
  num("FVC", prev.fvc, curr.fvc);
  num("DLCO", prev.dlco, curr.dlco);

  if (prev.exacCount != null && curr.exacCount != null) {
    if (prev.exacCount === curr.exacCount) {
      unchanged.push("Exacerbaciones (12 meses)");
    } else {
      changes.push({
        label: "Exacerbaciones (12 meses)",
        from: `${prev.exacCount}/año`,
        to: `${curr.exacCount}/año`,
        kind: curr.exacCount > prev.exacCount ? "aumentado" : "disminuido",
      });
    }
  }

  if (prev.hospCumulative !== curr.hospCumulative) {
    changes.push({
      label: "Hospitalizaciones (acumuladas)",
      from: `${prev.hospCumulative}`,
      to: `${curr.hospCumulative}`,
      kind: "aumentado",
    });
  } else {
    unchanged.push("Hospitalizaciones");
  }

  const newOrganisms = [...curr.organisms].filter((o) => !prev.organisms.has(o));
  newOrganisms.forEach((o) =>
    changes.push({ label: "Microbiología", from: "Sin aislamiento previo", to: `Nuevo aislamiento de ${o}`, kind: "nuevo" }),
  );

  const newTreatments = [...curr.activeTreatments].filter((t) => !prev.activeTreatments.has(t));
  newTreatments.forEach((t) => changes.push({ label: "Tratamiento", from: "—", to: `Se inicia ${t}`, kind: "nuevo" }));
  const stoppedTreatments = [...prev.activeTreatments].filter((t) => !curr.activeTreatments.has(t));
  stoppedTreatments.forEach((t) => changes.push({ label: "Tratamiento", from: t, to: "Retirado", kind: "desaparecido" }));

  return { fromDate: prevDate, toDate: lastDate, changes, unchanged };
}

/**
 * Detección objetiva de posibles contradicciones: dos determinaciones de
 * FEV1 muy próximas en el tiempo cuyo litros/porcentaje se mueven en
 * direcciones o magnitudes incoherentes entre sí.
 *
 * `note` es un aviso fijo (LEGACY): pendiente de sustituir por una
 * recomendación derivada de GuidelineEngine en la siguiente fase.
 */
export function detectContradictions(patient: Patient): DataContradiction[] {
  const pfts = selectPFT(patient.events);
  const findings: DataContradiction[] = [];
  for (let i = 1; i < pfts.length; i++) {
    const a = pfts[i - 1];
    const b = pfts[i];
    if (a.FEV1Liters && b.FEV1Liters && a.FEV1Percent && b.FEV1Percent && monthsBetween(a.date, b.date) <= 2) {
      const relL = (b.FEV1Liters - a.FEV1Liters) / a.FEV1Liters;
      const relP = (b.FEV1Percent - a.FEV1Percent) / a.FEV1Percent;
      if (Math.sign(relL) !== Math.sign(relP) && Math.abs(relL - relP) > 0.12) {
        findings.push({
          id: uid("cx"),
          message: `FEV1 registrado como ${a.FEV1Liters} L (${a.FEV1Percent}%) el ${formatDate(a.date)} frente a ${b.FEV1Liters} L (${b.FEV1Percent}%) el ${formatDate(b.date)}.`,
          note: "Dato potencialmente inconsistente. Revisar el valor antes de incorporarlo definitivamente.",
        });
      }
    }
  }
  return findings;
}
