"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { todayISO } from "@/utils/date";
import { buildCandidateEvents } from "@/engines/extraction";
import { scanPrivacyShield, redactText } from "@/engines/privacy";
import { Modal } from "@/components/ui";
import { PrivacyShieldModal } from "./PrivacyShieldModal";
import { ClinicalCandidateReview, countIncluded } from "./ClinicalCandidateReview";
import type { ReviewCandidate } from "./ClinicalCandidateReview";
import type { ClinicalEvent } from "@/types/clinicalEvent";
import type { PrivacyFinding } from "@/types/privacy";

/**
 * "Añadir información clínica" — cuadro único de texto libre desordenado
 * → PulmoVista separa automáticamente exacerbación, microbiología, PFR,
 * prueba de esfuerzo, TAC/radiología, analítica, tratamiento e
 * ingreso/procedimiento (ver engines/extraction), y añade además
 * consulta/evolución solo cuando el texto realmente narra la visita o la
 * evolución del paciente — nunca como relleno genérico cuando el texto
 * es puramente un dato objetivo (un cultivo, una TC, un valor de FEV1...)
 * → el médico confirma, corrige o descarta cada elemento antes de que se
 * guarde nada. Sustituye al antiguo flujo de "Añadir nueva consulta", que
 * guardaba lo extraído sin mostrarlo nunca. El texto sigue pasando primero
 * por el Escudo de privacidad, igual que antes.
 */
export function AddClinicalInfoModal({ onClose, onAdd }: { onClose: () => void; onAdd: (events: ClinicalEvent[]) => void }) {
  const [step, setStep] = useState<"text" | "review">("text");
  const [text, setText] = useState("");
  const [findings, setFindings] = useState<PrivacyFinding[] | null>(null);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);

  function buildCandidates(cleanText: string): ReviewCandidate[] {
    // Mismo criterio que NewPatientModal (ver buildCandidateEvents): un evento clínico
    // solo existe si el contenido permite identificarlo — nunca una Consulta de relleno.
    return buildCandidateEvents(cleanText, todayISO()).map((event) => ({ event, included: true }));
  }

  function goToReview(cleanText: string) {
    setText(cleanText);
    setCandidates(buildCandidates(cleanText));
    setStep("review");
  }

  const handleContinue = () => {
    const f = scanPrivacyShield(text);
    if (f.length) {
      setFindings(f);
      return;
    }
    goToReview(text);
  };

  const handleSave = () => {
    onAdd(candidates.filter((c) => c.included).map((c) => c.event));
  };

  const included = countIncluded(candidates);

  return (
    <>
      <Modal title="Añadir información clínica" onClose={onClose} width={620}>
        {step === "text" ? (
          <>
            <div style={{ fontSize: 12.5, color: COLORS.slate, marginBottom: 10, lineHeight: 1.5 }}>
              Pegue de una vez toda la información nueva desde la última revisión, aunque venga desordenada: evolución, exacerbaciones,
              microbiología, función pulmonar, pruebas de imagen, analítica, tratamientos o ingresos/procedimientos. PulmoVista los
              separará automáticamente y se lo mostrará para que los confirme antes de guardar nada.
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder="Ej. Desde la última revisión presenta dos agudizaciones tratadas con ciprofloxacino. Cultivo de junio positivo para Pseudomonas. FEV1 actual 68%. TC tórax con progresión leve. Analítica con PCR 40 mg/L. Se inicia azitromicina 250 mg lunes, miércoles y viernes."
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }}
            />
            <div style={{ fontSize: 11.5, color: COLORS.slateLight, margin: "10px 0 18px", display: "flex", gap: 6, alignItems: "center" }}>
              <ShieldAlert size={13} /> El texto pasará por el Escudo de privacidad antes de separarse en elementos.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={handleContinue}
                disabled={!text.trim()}
                style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: text.trim() ? COLORS.teal : COLORS.line, color: "white", fontWeight: 700, fontSize: 13 }}
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <>
            <ClinicalCandidateReview candidates={candidates} onChange={setCandidates} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 18 }}>
              <button
                onClick={() => setStep("text")}
                style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}
              >
                Atrás
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}>
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!included}
                  style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: included ? COLORS.teal : COLORS.line, color: "white", fontWeight: 700, fontSize: 13 }}
                >
                  Guardar {included} {included === 1 ? "elemento" : "elementos"}
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>
      {findings && (
        <PrivacyShieldModal
          findings={findings}
          onCancel={() => setFindings(null)}
          onConfirm={() => {
            const clean = redactText(text, findings);
            setFindings(null);
            goToReview(clean);
          }}
        />
      )}
    </>
  );
}
