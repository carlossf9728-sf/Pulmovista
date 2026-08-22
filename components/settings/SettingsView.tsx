"use client";

import { CircleAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { Card, Eyebrow } from "@/components/ui";

const FUTURE_INTEGRATIONS = ["Motor de extracción (LLM/NLP)", "Base de datos (PostgreSQL / Supabase)", "Autenticación", "RAG sobre guías clínicas"];

export function SettingsView() {
  return (
    <div className="pv-fade-in">
      <Eyebrow>Configuración</Eyebrow>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 4px" }}>Configuración</h1>
      <Card style={{ maxWidth: 620, marginTop: 16 }} accent={COLORS.orange}>
        <div style={{ display: "flex", gap: 10 }}>
          <CircleAlert size={20} color={COLORS.orange} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Prototype / Research use only</div>
            <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 4, lineHeight: 1.5 }}>
              Do not enter real patient-identifiable information. Esta versión utiliza almacenamiento en memoria de la sesión;
              la arquitectura queda preparada para cifrado y autenticación en fases futuras.
            </div>
          </div>
        </div>
      </Card>
      <Card style={{ maxWidth: 620, marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Puntos de integración futuros</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FUTURE_INTEGRATIONS.map((x) => (
            <span key={x} className="pv-mono" style={{ fontSize: 11.5, background: COLORS.paper, border: `1px solid ${COLORS.line}`, borderRadius: 20, padding: "5px 11px" }}>
              {x}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 12, lineHeight: 1.6 }}>
          La extracción estructurada y Privacy Shield funcionan hoy mediante reglas locales simuladas, con una interfaz de
          datos (ClinicalEvent) ya preparada para recibir la salida de un motor real sin cambios en el resto de la
          aplicación.
        </div>
      </Card>
    </div>
  );
}
