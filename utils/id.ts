/**
 * Generación de identificadores. No criptográficamente segura (usa
 * `Math.random()`), igual que en el prototipo: suficiente para un
 * prototipo en memoria, no para producción con riesgo de colisión real.
 */

let uidCounter = 1;

export function uid(prefix = "id"): string {
  return `${prefix}-${uidCounter++}-${Math.random().toString(36).slice(2, 7)}`;
}

function randCodeSegment(len = 4): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Código PulmoVista con formato "PV-XXXX-XXXX". No comprueba unicidad frente a códigos ya existentes (igual que en el prototipo). */
export function generatePulmoVistaCode(): string {
  return `PV-${randCodeSegment(4)}-${randCodeSegment(4)}`;
}
