"use client";

import { CheckCircle2, CircleAlert, ShieldAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { Modal } from "@/components/ui";
import type { PrivacyFinding } from "@/types/privacy";

export function PrivacyShieldModal({
  findings,
  onConfirm,
  onCancel,
}: {
  findings: PrivacyFinding[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title="Escudo de privacidad" onClose={onCancel} width={520}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
        <ShieldAlert size={22} color={COLORS.red} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>
          Se han detectado posibles datos identificativos. PulmoVista recomienda eliminarlos antes de realizar el análisis.
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {findings.map((f) => (
          <div key={f.key} style={{ background: COLORS.redTint, borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.red, textTransform: "capitalize" }}>{f.label}</div>
            <div className="pv-mono" style={{ fontSize: 12, color: COLORS.ink, marginTop: 3 }}>
              {f.matches.map((m) => `“${m}”`).join(", ")}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginBottom: 18, display: "flex", gap: 6, alignItems: "flex-start" }}>
        <CircleAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        El Escudo de privacidad es una herramienta experimental basada en reglas locales; no garantiza anonimización completa. Revise
        siempre el texto manualmente.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}
        >
          Revisar manualmente
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: "9px 16px",
            borderRadius: 9,
            border: "none",
            background: COLORS.navy,
            color: "white",
            fontWeight: 600,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CheckCircle2 size={14} /> Eliminar y continuar
        </button>
      </div>
    </Modal>
  );
}
