"use client";

import { COLORS } from "@/utils/theme";
import { formatDate } from "@/utils/date";
import { cap } from "@/utils/text";
import { GROUP_COLOR, GROUP_ICON } from "@/utils/eventGroupStyle";
import { displayForEvent } from "@/domain/timeline";
import { episodeDurationDays, episodeHeadline } from "@/domain/episode";
import { Eyebrow, Modal } from "@/components/ui";
import type { EpisodeChange, EpisodeSections } from "@/domain/episode";
import type { ClinicalEvent, ExacerbationEvent } from "@/types/clinicalEvent";

/** Una línea de sección reutilizando displayForEvent — mismo formato que en cualquier otra pestaña, nunca un texto distinto para "el mismo" dato. */
function EventRow({ e }: { e: ClinicalEvent }) {
  const d = displayForEvent(e);
  const c = GROUP_COLOR[d.group];
  const Icon = GROUP_ICON[d.group];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0" }}>
      <Icon size={13} color={c} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: COLORS.slateLight }}>{formatDate(e.date)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>{d.title}</div>
        {d.detail && <div style={{ fontSize: 12.5, color: COLORS.slate, marginTop: 2, lineHeight: 1.5 }}>{d.detail}</div>}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  return <p style={{ fontSize: 13.5, color: COLORS.ink, margin: 0, lineHeight: 1.55 }}>{text}</p>;
}

/**
 * Detalle completo del episodio de ingreso — abierto desde "Ver episodio"
 * en la Cronología. Solo muestra secciones con dato real: ninguna se
 * rellena con un placeholder cuando falta información (ver
 * ExacerbationEvent en types/clinicalEvent.ts). Los eventos vinculados
 * (soporte, pruebas, tratamientos, diagnósticos) se renderizan con
 * `displayForEvent`, el mismo formato que en cualquier otra pestaña —
 * son el mismo evento referenciado por episodeId, no una copia.
 */
export function EpisodeDetailModal({ container, sections, changes, onClose }: { container: ExacerbationEvent; sections: EpisodeSections; changes: EpisodeChange[]; onClose: () => void }) {
  const days = episodeDurationDays(container);
  return (
    <Modal title={episodeHeadline(container)} onClose={onClose} width={640}>
      <Section label="Ingreso">
        <Prose
          text={`${formatDate(container.date)}${
            container.dischargeDate ? ` — Alta: ${formatDate(container.dischargeDate)}${days != null ? ` (${days} día${days === 1 ? "" : "s"})` : ""}` : " — Sin fecha de alta registrada"
          }${container.dischargeDisposition ? ` · Destino: ${cap(container.dischargeDisposition)}` : ""}`}
        />
      </Section>

      {container.admissionReason && (
        <Section label="Motivo de ingreso">
          <Prose text={container.admissionReason} />
        </Section>
      )}

      {sections.diagnoses.length > 0 && (
        <Section label="Diagnósticos del episodio">
          {sections.diagnoses.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </Section>
      )}

      <Section label="Gravedad y evolución clínica">
        <Prose text={`Gravedad: ${container.severity}.${container.clinicalCourse ? ` ${container.clinicalCourse}` : ""}`} />
      </Section>

      {sections.support.length > 0 && (
        <Section label="Soporte respiratorio">
          {sections.support.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </Section>
      )}

      {sections.tests.length > 0 && (
        <Section label="Pruebas complementarias">
          {sections.tests.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </Section>
      )}

      {(sections.treatmentsDuring.length > 0 || sections.stopped.length > 0) && (
        <Section label="Tratamiento durante el ingreso">
          {sections.treatmentsDuring.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
          {sections.stopped.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </Section>
      )}

      {container.dischargeStatus && (
        <Section label="Situación al alta">
          <Prose text={container.dischargeStatus} />
        </Section>
      )}

      {sections.treatmentsAtDischarge.length > 0 && (
        <Section label="Tratamiento al alta">
          {sections.treatmentsAtDischarge.map((e) => (
            <EventRow key={e.id} e={e} />
          ))}
        </Section>
      )}

      {container.followUpPlan && (
        <Section label="Recomendaciones / plan de seguimiento">
          <Prose text={container.followUpPlan} />
        </Section>
      )}

      <Section label="Qué cambió tras este episodio">
        {changes.length > 0 ? (
          changes.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: 13, color: COLORS.ink }}>
              <span style={{ color: COLORS.slateLight, flexShrink: 0 }}>{formatDate(c.date)}</span>
              <span>{c.label}</span>
            </div>
          ))
        ) : (
          <Prose text="Ningún cambio posterior cumple los criterios ya establecidos en la app para señalarlo aquí." />
        )}
      </Section>
    </Modal>
  );
}
