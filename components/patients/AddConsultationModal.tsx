"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { redactText, scanPrivacyShield } from "@/engines/privacy";
import { Modal } from "@/components/ui";
import { PrivacyShieldModal } from "./PrivacyShieldModal";
import type { PrivacyFinding } from "@/types/privacy";

export function AddConsultationModal({ onClose, onAdd }: { onClose: () => void; onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const [findings, setFindings] = useState<PrivacyFinding[] | null>(null);
  const handleSubmit = () => {
    const f = scanPrivacyShield(text);
    if (f.length) {
      setFindings(f);
      return;
    }
    onAdd(text);
  };
  return (
    <>
      <Modal title="Añadir nueva consulta" onClose={onClose} width={560}>
        <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 10, lineHeight: 1.5 }}>
          Pegue únicamente la información nueva desde la última revisión. PulmoVista la añadirá a la historia longitudinal sin
          borrar información anterior.
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Ej. Desde la última revisión presenta dos agudizaciones tratadas con ciprofloxacino. Cultivo de junio positivo para Pseudomonas. FEV1 actual 68%. Se inicia azitromicina 250 mg lunes, miércoles y viernes."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }}
        />
        <div style={{ fontSize: 11.5, color: COLORS.slateLight, margin: "10px 0 18px", display: "flex", gap: 6, alignItems: "center" }}>
          <ShieldAlert size={13} /> El texto pasará por Privacy Shield y por el motor de extracción antes de guardarse.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: text.trim() ? COLORS.teal : COLORS.line, color: "white", fontWeight: 700, fontSize: 13 }}
          >
            Añadir a la historia
          </button>
        </div>
      </Modal>
      {findings && (
        <PrivacyShieldModal
          findings={findings}
          onCancel={() => setFindings(null)}
          onConfirm={() => {
            const clean = redactText(text, findings);
            setFindings(null);
            onAdd(clean);
          }}
        />
      )}
    </>
  );
}
