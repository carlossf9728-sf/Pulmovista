/** Capitaliza la primera letra. Devuelve el valor de entrada sin cambios si es falsy (igual que el prototipo original). */
export function cap(s: string | null | undefined): string | null | undefined {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
