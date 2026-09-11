/**
 * Helpers de fecha. Réplica funcional de los helpers del prototipo
 * original: mismo formato ("es-ES", dd/mm/aaaa), mismos casos borde
 * ("No disponible" para fecha ausente o inválida).
 */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No disponible";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Diferencia aproximada en meses entre dos fechas (mes = 30.44 días). */
export function monthsBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

/** Diferencia exacta en días naturales entre dos fechas ISO (b − a). Negativa si b es anterior a a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function yearOf(iso: string): number {
  return new Date(iso).getFullYear();
}

export function sortByDate<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export interface DateOffset {
  days?: number;
  weeks?: number;
  months?: number;
  years?: number;
}

/**
 * Suma un desfase de calendario a una fecha ISO (yyyy-mm-dd), devolviendo
 * otra fecha ISO. Meses/años usan aritmética de calendario real
 * (Date#setMonth/#setFullYear, con el mismo desbordamiento de fin de mes
 * que ya asume el resto de JavaScript) — nunca la aproximación de 30.44
 * días que usa `monthsBetween` para comparar, que no sirve para calcular
 * una fecha nueva. Semanas se convierten a días naturales (×7).
 */
export function addToDate(iso: string, offset: DateOffset): string {
  const d = new Date(iso + "T00:00:00");
  if (offset.years) d.setFullYear(d.getFullYear() + offset.years);
  if (offset.months) d.setMonth(d.getMonth() + offset.months);
  if (offset.weeks) d.setDate(d.getDate() + offset.weeks * 7);
  if (offset.days) d.setDate(d.getDate() + offset.days);
  return d.toISOString().slice(0, 10);
}
