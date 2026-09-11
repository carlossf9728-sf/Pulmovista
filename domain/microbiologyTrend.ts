/**
 * Cambio longitudinal OBJETIVO en microbiología — solo capa 1 (qué ha
 * cambiado realmente), nunca capa 2 (interpretación). Un nuevo
 * microorganismo no se convierte automáticamente en "Empeoramiento", ni
 * la persistencia en nada: la propia guía (ver ers-crit-chronic-pseudomonas
 * en engines/guidelines/knowledge/ers2025.ts) ya trata la significancia
 * clínica de una infección persistente como no cuantificable de forma
 * genérica, así que aquí tampoco se afirma.
 *
 * "Negativización confirmada" NO se calcula: el modelo de datos actual
 * (MicrobiologyEvent) solo registra organismos que SÍ se aislaron —
 * no existe forma de registrar un cultivo negativo explícito. Afirmar
 * "negativización" a partir de la simple ausencia de un organismo en el
 * cultivo más reciente sería inventar una interpretación que el dato no
 * respalda (la ausencia puede deberse a la propia sensibilidad del
 * cultivo, no a que el organismo haya desaparecido) — se deja fuera
 * hasta que el modelo pueda registrar un resultado negativo explícito.
 */
import { isDateReliable } from "./selectors";
import type { MicrobiologyEvent } from "@/types/clinicalEvent";

export type MicrobiologyObjectiveChange = "Nuevo aislamiento" | "Persistencia" | null;

/**
 * `allSorted` — todos los MicrobiologyEvent del paciente, ordenados por
 * fecha ascendente (ver domain/selectors.ts#selectMicrobiology).
 *
 * null también cuando `current` tiene `datePrecision: "unresolved"`, o
 * comparándolo solo contra aislamientos con fecha fiable (ver
 * isDateReliable): con una fecha no resuelta, "Nuevo aislamiento" frente
 * a "Persistencia" dependería de una posición cronológica que no
 * sabemos si es correcta — mejor no afirmar ninguna de las dos que
 * afirmar la que no toca. El cultivo en sí sigue viéndose igual en
 * Microbiología/Cronología, solo desaparece esta etiqueta.
 */
export function microbiologyObjectiveChange(current: MicrobiologyEvent, allSorted: MicrobiologyEvent[]): MicrobiologyObjectiveChange {
  if (!isDateReliable(current)) return null;
  const reliable = allSorted.filter(isDateReliable);
  const priorSameOrganism = reliable.filter((m) => m.organism === current.organism && m.date < current.date);
  if (priorSameOrganism.length === 0) return "Nuevo aislamiento";

  const priorAny = reliable.filter((m) => m.date < current.date).slice(-1)[0];
  const followsGap = priorAny != null && priorAny.organism !== current.organism;
  if (followsGap) return "Nuevo aislamiento";

  return "Persistencia";
}
