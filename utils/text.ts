/** Capitaliza la primera letra. Devuelve el valor de entrada sin cambios si es falsy (igual que el prototipo original). */
export function cap(s: string | null | undefined): string | null | undefined {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Edad para mostrar en la UI: "58 años", o "Edad no disponible" si no consta (nunca "null años"). */
export function formatAge(age: number | null | undefined): string {
  return age == null ? "Edad no disponible" : `${age} años`;
}
