/**
 * Detección de cambios de estado entre dos evaluaciones sucesivas de
 * GuidelineMatch para el mismo paciente — pura, sin React, para poder
 * testearla sin montar componentes. No reevalúa nada ni cambia ninguna
 * regla clínica: solo compara el `status` que match.ts ya calculó en dos
 * momentos distintos.
 *
 * Alcance deliberadamente en memoria de sesión (ver componente que
 * consume esto, GuidelinesReviewTab): no hay backend ni almacenamiento
 * persistente en PulmoVista, así que "cambios recientes" solo puede
 * significar "cambió desde la última vez que se vio en esta sesión del
 * navegador" — se pierde al recargar la página, igual que el resto del
 * estado de la app.
 */
import type { GuidelineMatch, GuidelineMatchStatus } from "@/types/guideline";

export type GuidelineStatusSnapshot = ReadonlyMap<string, GuidelineMatchStatus>;

/** Fotografía de qué status tiene cada recommendationId ahora mismo, para comparar más adelante. */
export function snapshotStatuses(matches: readonly GuidelineMatch[]): GuidelineStatusSnapshot {
  return new Map(matches.map((m) => [m.recommendationId, m.status]));
}

/**
 * recommendationId cuyo status difiere entre `previous` y `matches`
 * actuales. `previous === null` (primera vez que se evalúa a este
 * paciente en esta sesión, sin fotografía anterior con la que comparar)
 * nunca marca nada como cambiado — no hay "antes" del que partir.
 */
export function diffChangedRecommendations(previous: GuidelineStatusSnapshot | null, matches: readonly GuidelineMatch[]): ReadonlySet<string> {
  if (!previous) return new Set();
  const changed = new Set<string>();
  for (const m of matches) {
    const prevStatus = previous.get(m.recommendationId);
    if (prevStatus !== undefined && prevStatus !== m.status) changed.add(m.recommendationId);
  }
  return changed;
}
