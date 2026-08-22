"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Radar, Settings, Users, Wind } from "lucide-react";
import { COLORS } from "@/utils/theme";

/**
 * Navegación principal. En el prototipo original cada entrada cambiaba
 * un `view` en estado de React; aquí cada una es una ruta real de Next.js
 * (mismo contenido, misma disposición visual) — el resto del
 * comportamiento (resaltado del enlace activo, badge de alertas en
 * Sentinel) es idéntico.
 */
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/sentinel", label: "Sentinel", icon: Radar },
  { href: "/guias", label: "Guías", icon: BookOpen },
  { href: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function Sidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();
  return (
    <div
      style={{
        width: 224,
        minWidth: 224,
        background: COLORS.navy,
        color: COLORS.white,
        display: "flex",
        flexDirection: "column",
        padding: "22px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px 26px" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: COLORS.teal,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Wind size={18} color={COLORS.navy} strokeWidth={2.5} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em" }}>PulmoVista</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          const badge = it.href === "/sentinel" ? alertCount : 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              className="pv-navlink"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: 9,
                textAlign: "left",
                background: active ? "rgba(14,165,160,0.16)" : "transparent",
                color: active ? COLORS.teal : "rgba(255,255,255,0.75)",
                fontWeight: active ? 700 : 500,
                fontSize: 13.5,
              }}
            >
              <Icon size={17} />
              {it.label}
              {!!badge && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: COLORS.red,
                    color: "white",
                    fontSize: 10.5,
                    fontWeight: 700,
                    borderRadius: 20,
                    padding: "1px 6px",
                    minWidth: 17,
                    textAlign: "center",
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div
        style={{
          marginTop: "auto",
          padding: "14px 10px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          fontSize: 10.5,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.5,
        }}
      >
        Prototype / research use only.
        <br />
        No introducir datos identificativos reales.
      </div>
    </div>
  );
}
