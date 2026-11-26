"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CircleAlert, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { usePatients } from "@/app/providers";
import { COLORS } from "@/utils/theme";
import { Card, Eyebrow } from "@/components/ui";

const FUTURE_INTEGRATIONS = ["Motor de extracción (LLM/NLP)", "Base de datos (PostgreSQL / Supabase)", "Autenticación", "RAG sobre guías clínicas"];

type PendingAction = "restore" | "clear" | null;

const ACTION_COPY: Record<Exclude<PendingAction, null>, { confirm: string; done: string }> = {
  restore: {
    confirm: "Se descartarán los pacientes y la información añadidos en esta sesión y se volverán a cargar los 3 pacientes de demostración.",
    done: "Pacientes de demostración restaurados.",
  },
  clear: {
    confirm: "Se eliminarán todos los pacientes de esta sesión, incluidos los de demostración. Podrá restaurarlos después.",
    done: "Lista de pacientes vaciada.",
  },
};

/**
 * Datos de la sesión — restaurar los pacientes demo o vaciar la lista,
 * con confirmación en línea (sin diálogos del navegador). Todo vive en
 * memoria: nada de esto toca ningún almacenamiento persistente.
 */
function SessionDataCard() {
  const { patients, restoreDemoPatients, clearPatients } = usePatients();
  const [pending, setPending] = useState<PendingAction>(null);
  const [done, setDone] = useState<string | null>(null);

  function confirm() {
    if (pending === "restore") restoreDemoPatients();
    if (pending === "clear") clearPatients();
    if (pending) setDone(ACTION_COPY[pending].done);
    setPending(null);
  }

  const btn = { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, fontWeight: 600, fontSize: 12.5 } as const;

  return (
    <Card style={{ maxWidth: 620, marginTop: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Datos de la sesión</div>
      <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 4, lineHeight: 1.5 }}>
        {patients.length === 1 ? "1 paciente" : `${patients.length} pacientes`} en memoria. Los datos se pierden al recargar la página.
      </div>
      {!pending && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={() => { setPending("restore"); setDone(null); }} style={{ ...btn, background: "white", color: COLORS.navy, border: `1px solid ${COLORS.line}` }}>
            <RotateCcw size={14} /> Restaurar pacientes de demostración
          </button>
          <button
            onClick={() => { setPending("clear"); setDone(null); }}
            disabled={!patients.length}
            style={{ ...btn, background: "white", color: patients.length ? COLORS.red : COLORS.slateLight, border: `1px solid ${COLORS.line}` }}
          >
            <Trash2 size={14} /> Vaciar lista de pacientes
          </button>
        </div>
      )}
      {pending && (
        <div role="alert" style={{ marginTop: 12, padding: 12, borderRadius: 9, background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{ACTION_COPY[pending].confirm}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setPending(null)} style={{ ...btn, background: "white", border: `1px solid ${COLORS.line}` }}>
              Cancelar
            </button>
            <button onClick={confirm} style={{ ...btn, background: pending === "clear" ? COLORS.red : COLORS.teal, color: "white", border: "none", fontWeight: 700 }}>
              {pending === "clear" ? "Sí, vaciar" : "Sí, restaurar"}
            </button>
          </div>
        </div>
      )}
      {done && (
        <div role="status" style={{ fontSize: 12.5, color: COLORS.tealDeep, marginTop: 10, fontWeight: 600 }}>
          {done}
        </div>
      )}
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="pv-fade-in">
      <Eyebrow>Configuración</Eyebrow>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 4px" }}>Configuración</h1>
      <Card style={{ maxWidth: 620, marginTop: 16 }} accent={COLORS.orange}>
        <div style={{ display: "flex", gap: 10 }}>
          <CircleAlert size={20} color={COLORS.orange} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Prototipo — uso exclusivo de investigación</div>
            <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 4, lineHeight: 1.5 }}>
              No introduzca información real que identifique a pacientes. Esta versión utiliza almacenamiento en memoria de la sesión;
              la arquitectura queda preparada para cifrado y autenticación en fases futuras.
            </div>
          </div>
        </div>
      </Card>
      <SessionDataCard />
      <Link href="/guias" style={{ display: "block", maxWidth: 620, marginTop: 14, textDecoration: "none", color: "inherit" }}>
        <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BookOpen size={18} color={COLORS.tealDeep} style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Base de conocimiento</div>
              <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 2 }}>
                Guías clínicas estructuradas (ERS 2025, SEPAR 2018) que PulmoVista usa para revisar los datos del paciente.
              </div>
            </div>
          </div>
          <ChevronRight size={16} color={COLORS.slateLight} style={{ flexShrink: 0 }} />
        </Card>
      </Link>
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
          La extracción estructurada y el Escudo de privacidad funcionan hoy mediante reglas locales simuladas, con una interfaz de
          datos (ClinicalEvent) ya preparada para recibir la salida de un motor real sin cambios en el resto de la
          aplicación.
        </div>
      </Card>
    </div>
  );
}
