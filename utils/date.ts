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
