"use client";

/**
 * Icono de marca de Argos — capa visible del módulo de vigilancia clínica
 * longitudinal (motor interno: Sentinel, sin cambios). Mismo grosor de
 * trazo que los iconos de Lucide usados en el resto de la app, para que
 * conviva con ellos sin destacar como un cuerpo extraño.
 */
export function ArgosMark({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M2.2,12 C2.2,12 7.6,5.3 12,5.3 C16.4,5.3 21.8,12 21.8,12 C21.8,12 16.4,18.7 12,18.7 C7.6,18.7 2.2,12 2.2,12 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" fill={color} />
    </svg>
  );
}
