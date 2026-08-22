/**
 * Detección OBJETIVA de Turning Points — datos, no prosa clínica.
 * ----------------------------------------------------------------------
 * Cada detector produce un `ObjectiveTurningPoint`: fechas, valores
 * "antes/después" y evidencia. Ninguno de ellos decide qué significa
 * clínicamente el cambio — eso es responsabilidad de la capa de
 * interpretación (ver legacyInterpretations.ts).
 *
 * Nota de incoherencia detectada durante la migración (documentada, NO
 * corregida): el detector de "descenso funcional restrictivo" (FVC) usa
 * la misma lista de PFT pre-filtrada por FEV1Percent presente
 * (`selectPFTWithFEV1`) que el detector de exacerbaciones, en vez de una
 * lista filtrada por FVCPercent. En el prototipo original ambos
 * detectores compartían la misma variable `pftSorted` por el mismo
 * motivo. No se ejerce con los datos demo (siempre coexisten FEV1Percent
 * y FVCPercent en el mismo evento), pero podría ocultar una prueba con
 * FVC documentado y FEV1 no documentado. Pendiente de revisión clínica.
 */
import { uid } from "@/utils/id";
import { formatDate, sortByDate, yearOf } from "@/utils/date";
import { cap } from "@/utils/text";
import { CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { exacerbationsByYear, selectExacerbations, selectMicrobiology, selectPFTWithFEV1 } from "@/domain/selectors";
import type { Patient } from "@/types/patient";
import type { EvidenceItem } from "@/types/evidence";
import type { ObjectiveTurningPoint } from "@/types/turningPoints";
import type { RespiratorySupportEvent } from "@/types/clinicalEvent";
import { monthsBetween } from "@/utils/date";

function isRespiratorySupport(e: { type: string }): e is RespiratorySupportEvent {
  return e.type === CLINICAL_EVENT_TYPES.RESPIRATORY_SUPPORT;
}

function toEvidence(labels: (string | null | undefined)[]): EvidenceItem[] {
  return labels.filter((l): l is string => Boolean(l)).map((label) => ({ label }));
}

export function detectObjectiveTurningPoints(patient: Patient): ObjectiveTurningPoint[] {
  const points: ObjectiveTurningPoint[] = [];
  const years = exacerbationsByYear(patient);
  const pftSorted = selectPFTWithFEV1(patient.events);
  const micro = selectMicrobiology(patient.events);
  const support = sortByDate(patient.events.filter(isRespiratorySupport));
  const exacs = selectExacerbations(patient.events);

  // 1) salto en tasa de exacerbaciones
  for (let i = 1; i < years.length; i++) {
    const before = years[i - 1];
    const after = years[i];
    if (after.count - before.count >= 2) {
      const beforePFT = pftSorted.filter((p) => yearOf(p.date) <= before.year).slice(-1)[0];
      const afterPFT = pftSorted.filter((p) => yearOf(p.date) >= after.year)[0] || pftSorted[pftSorted.length - 1];
      const orgsBefore = new Set(micro.filter((m) => yearOf(m.date) <= before.year).map((m) => m.organism));
      const orgsAfter = [
        ...new Set(micro.filter((m) => yearOf(m.date) >= after.year && !orgsBefore.has(m.organism)).map((m) => m.organism)),
      ];
      points.push({
        id: uid("tp"),
        criterion: "exacerbation-rate-jump",
        date: `${after.year}-01-01`,
        label: `Turning Point — ${after.year}`,
        before: { Exacerbaciones: `${before.count}/año`, FEV1: beforePFT ? `${beforePFT.FEV1Percent}%` : null },
        after: {
          Exacerbaciones: `${after.count}/año`,
          FEV1: afterPFT ? `${afterPFT.FEV1Percent}%` : null,
          "Cultivos nuevos": orgsAfter.join(", ") || "Ninguno",
        },
        evidence: toEvidence([
          `Exacerbaciones: ${before.count} → ${after.count}/año`,
          beforePFT && afterPFT ? `FEV1: ${beforePFT.FEV1Percent}% → ${afterPFT.FEV1Percent}%` : null,
          orgsAfter.length ? `Nuevo(s) aislamiento(s): ${orgsAfter.join(", ")}` : null,
        ]),
      });
    }
  }

  // 2) descenso funcional restrictivo (FVC) rápido
  for (let i = 1; i < pftSorted.length; i++) {
    const a = pftSorted[i - 1];
    const b = pftSorted[i];
    if (monthsBetween(a.date, b.date) <= 14 && a.FVCPercent && b.FVCPercent) {
      const relDrop = (a.FVCPercent - b.FVCPercent) / a.FVCPercent;
      if (relDrop >= 0.1) {
        points.push({
          id: uid("tp"),
          criterion: "restrictive-decline",
          date: b.date,
          label: `Turning Point — ${formatDate(b.date)}`,
          before: { FVC: `${a.FVCPercent}%`, DLCO: a.DLCOPercent ? `${a.DLCOPercent}%` : null },
          after: { FVC: `${b.FVCPercent}%`, DLCO: b.DLCOPercent ? `${b.DLCOPercent}%` : null },
          evidence: toEvidence([
            `FVC: ${a.FVCPercent}% → ${b.FVCPercent}% (${formatDate(a.date)} – ${formatDate(b.date)})`,
            a.DLCOPercent && b.DLCOPercent ? `DLCO: ${a.DLCOPercent}% → ${b.DLCOPercent}%` : null,
          ]),
        });
      }
    }
  }

  // 3) primer aislamiento persistente de un organismo (2ª aparición)
  const seen: Record<string, number> = {};
  micro.forEach((m) => {
    seen[m.organism] = (seen[m.organism] || 0) + 1;
    if (seen[m.organism] === 2) {
      points.push({
        id: uid("tp"),
        criterion: "first-persistent-organism",
        date: m.date,
        label: `Turning Point — ${formatDate(m.date)}`,
        before: { Cultivos: "Aislamiento único previo" },
        after: { Cultivos: `2º aislamiento de ${m.organism}` },
        subject: m.organism,
        evidence: micro.filter((x) => x.organism === m.organism).map((x) => ({ label: `${formatDate(x.date)} — ${x.organism}`, date: x.date })),
      });
    }
  });

  // 4) primera hospitalización
  const firstHosp = exacs.find((e) => e.hospitalization);
  if (firstHosp) {
    points.push({
      id: uid("tp"),
      criterion: "first-hospitalization",
      date: firstHosp.date,
      label: `Turning Point — ${formatDate(firstHosp.date)}`,
      before: { "Hospitalizaciones previas": "0" },
      after: { Hospitalizaciones: "1ª hospitalización por agudización" },
      evidence: [{ label: `${formatDate(firstHosp.date)} — exacerbación con hospitalización`, date: firstHosp.date }],
    });
  }

  // 5) inicio de soporte respiratorio
  if (support.length) {
    const first = support[0];
    points.push({
      id: uid("tp"),
      criterion: "respiratory-support-start",
      date: first.date,
      label: `Turning Point — ${formatDate(first.date)}`,
      before: { "Soporte respiratorio": "No" },
      after: { "Soporte respiratorio": cap(first.drug) ?? first.drug },
      subject: first.drug,
      evidence: [{ label: `${formatDate(first.date)} — inicio de ${cap(first.drug)}`, date: first.date }],
    });
  }

  return sortByDate(points);
}
