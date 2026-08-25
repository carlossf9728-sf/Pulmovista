"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { ShieldAlert } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { todayISO } from "@/utils/date";
import { runExtractionEngine } from "@/engines/extraction";
import { scanPrivacyShield, redactText } from "@/engines/privacy";
import { mkEvent, CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { Modal } from "@/components/ui";
import { PrivacyShieldModal } from "./PrivacyShieldModal";
import { ClinicalCandidateReview, countIncluded } from "./ClinicalCandidateReview";
import type { ReviewCandidate } from "./ClinicalCandidateReview";
import type { ClinicalEvent, ConsultationEvent } from "@/types/clinicalEvent";
import type { NewPatientInput, PatientSex } from "@/types/patient";
import type { PrivacyFinding } from "@/types/privacy";

const label: CSSProperties = { fontSize: 12, fontWeight: 700, color: COLORS.slate, marginBottom: 6, display: "block" };
const inputStyle: CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5, fontFamily: "inherit" };

/**
 * "Nuevo paciente" — mismo patrón que "Añadir información clínica"
 * (ver AddClinicalInfoModal): el texto clínico inicial se separa
 * automáticamente y se revisa ANTES de crear el expediente. El alta
 * inicial no guarda datos extraídos sin pasar por la misma
 * confirmación que exige el resto del sistema.
 */
export function NewPatientModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: NewPatientInput, events: ClinicalEvent[]) => void }) {
  const [step, setStep] = useState<"form" | "review">("form");
  const [sex, setSex] = useState<PatientSex>("Mujer");
  const [age, setAge] = useState("");
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState("");
  const [secondaryDiagnoses, setSecondaryDiagnoses] = useState("");
  const [rawText, setRawText] = useState("");
  const [findings, setFindings] = useState<PrivacyFinding[] | null>(null);
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);

  function buildCandidates(cleanText: string): ReviewCandidate[] {
    const date = todayISO();
    const consultation = mkEvent<ConsultationEvent>(
      null,
      CLINICAL_EVENT_TYPES.CONSULTATION,
      date,
      {},
      { source: "manual", rawText: cleanText || "Sin texto clínico inicial." },
    );
    const extracted = cleanText ? runExtractionEngine(cleanText, date) : [];
    return [{ event: consultation, included: true }, ...extracted.map((event) => ({ event, included: true }))];
  }

  function goToReview(cleanText: string) {
    setRawText(cleanText);
    setCandidates(buildCandidates(cleanText));
    setStep("review");
  }

  const handleContinue = () => {
    const f = scanPrivacyShield(rawText);
    if (f.length) {
      setFindings(f);
      return;
    }
    goToReview(rawText);
  };

  const handleCreate = () => {
    onCreate(
      { sex, age: age ? parseInt(age, 10) : null, primaryDiagnosis, secondaryDiagnoses },
      candidates.filter((c) => c.included).map((c) => c.event),
    );
  };

  const included = countIncluded(candidates);

  return (
    <>
      <Modal title="Nuevo paciente" onClose={onClose} width={620}>
        {step === "form" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <span style={label}>Sexo</span>
                <select value={sex} onChange={(e) => setSex(e.target.value as PatientSex)} style={inputStyle}>
                  <option>Mujer</option>
                  <option>Hombre</option>
                  <option>Otro / no consta</option>
                </select>
              </div>
              <div>
                <span style={label}>Edad</span>
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Ej. 58" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={label}>Diagnóstico respiratorio principal</span>
              <input
                value={primaryDiagnosis}
                onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                placeholder="Ej. Bronquiectasias no FQ"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <span style={label}>Diagnósticos secundarios</span>
              <input
                value={secondaryDiagnoses}
                onChange={(e) => setSecondaryDiagnoses(e.target.value)}
                placeholder="Ej. Asma bronquial leve"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={label}>Historia clínica inicial (texto libre — evolutivos, pruebas, tratamientos…)</span>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={7}
                placeholder="Pegue aquí la información clínica desordenada. No incluya nombre, DNI, teléfono ni otros identificadores directos."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.slateLight, marginBottom: 18, display: "flex", gap: 6, alignItems: "center" }}>
              <ShieldAlert size={13} /> El texto pasará por el Escudo de privacidad y se separará en elementos para que los revise antes de crear el expediente.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={handleContinue}
                disabled={!primaryDiagnosis}
                style={{
                  padding: "9px 18px",
                  borderRadius: 9,
                  border: "none",
                  background: primaryDiagnosis ? COLORS.teal : COLORS.line,
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                }}
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
                onClick={() => setStep("form")}
                style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}
              >
                Atrás
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "white", fontWeight: 600, fontSize: 13 }}>
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!included}
                  style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: included ? COLORS.teal : COLORS.line, color: "white", fontWeight: 700, fontSize: 13 }}
                >
                  Crear expediente ({included})
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
            const clean = redactText(rawText, findings);
            setFindings(null);
            goToReview(clean);
          }}
        />
      )}
    </>
  );
}
