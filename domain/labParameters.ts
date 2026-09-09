/**
 * Agrupación longitudinal OBJETIVA de LabParameter por nombre — mismo
 * principio que domain/microbiologyTrend.ts: solo agrupa lo que el dato
 * ya trae (mismo `name`+`category` a través de varios LabResultsEvent
 * fechados, tal como constan), nunca clasifica el sentido del cambio
 * ("mejoría"/"empeoramiento"). Ese juicio no está respaldado por ninguna
 * guía cargada para estos parámetros (IgG, alfa-1-antitripsina...), así
 * que no se inventa aquí — el histórico se muestra fecha a fecha para
 * que el propio médico lo lea, igual que ya hace PFTTab con los gráficos.
 *
 * El agrupado es por coincidencia EXACTA de `name` (sin normalizar
 * mayúsculas ni variantes) — mismo criterio que microbiologyTrend agrupa
 * por `organism ===`. Los datos demo usan el mismo nombre literal para
 * el mismo parámetro a través de las distintas fechas.
 */
import type { LabParameterCategory, LabParameterStatus, LabReferenceRange, LabResultsEvent } from "@/types/clinicalEvent";

export interface LabParameterPoint {
  date: string;
  eventId: string;
  valueText: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: LabReferenceRange | null;
  status: LabParameterStatus;
}

export interface LabParameterSeries {
  name: string;
  category: LabParameterCategory;
  /** Ordenados por fecha ascendente — el último punto es el valor más reciente. */
  points: LabParameterPoint[];
}

/** Último punto de la serie (el más reciente) — null si la serie no tiene puntos, aunque en la práctica groupLabParameters nunca produce series vacías. */
export function latestPoint(series: LabParameterSeries): LabParameterPoint | null {
  return series.points.length ? series.points[series.points.length - 1] : null;
}

/**
 * Agrupa los LabParameter de una categoría ("general" o "etiologico") a
 * través de todos los LabResultsEvent del paciente, en series por
 * nombre, ordenadas alfabéticamente para una vista estable.
 */
export function groupLabParameters(events: LabResultsEvent[], category: LabParameterCategory): LabParameterSeries[] {
  const byName = new Map<string, LabParameterSeries>();
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  for (const event of sorted) {
    for (const param of event.parameters ?? []) {
      if (param.category !== category) continue;
      const series = byName.get(param.name) ?? { name: param.name, category, points: [] };
      series.points.push({
        date: event.date,
        eventId: event.id,
        valueText: param.valueText,
        numericValue: param.numericValue ?? null,
        unit: param.unit ?? null,
        referenceRange: param.referenceRange ?? null,
        status: param.status ?? null,
      });
      byName.set(param.name, series);
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** LabResultsEvent sin desglose estructurado — analíticas antiguas o texto que no permite aislar parámetros. Se siguen mostrando por label/text, nunca ocultas. */
export function selectUnstructuredLabResults(events: LabResultsEvent[]): LabResultsEvent[] {
  return events.filter((e) => !e.parameters || !e.parameters.length);
}
