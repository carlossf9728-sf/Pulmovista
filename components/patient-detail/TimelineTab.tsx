"use client";

import { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate, sortByDate } from "@/utils/date";
import { GROUP_COLOR, GROUP_ICON, TIMELINE_GROUPS } from "@/utils/eventGroupStyle";
import { CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { selectConsultations } from "@/domain/selectors";
import { displayForEvent } from "@/domain/timeline";
import { DataConfidenceBadge } from "@/components/ui";
import type { ClinicalEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";
import type { TimelineEntry, TimelineGroup } from "@/types/timeline";

type TimelineRow = ClinicalEvent & { display: TimelineEntry };

export function TimelineTab({ patient }: { patient: Patient }) {
  const events: TimelineRow[] = patient.events
    .filter((e) => e.type !== CLINICAL_EVENT_TYPES.CONSULTATION)
    .map((e) => ({ ...e, display: displayForEvent(e) }));
  const consultEvents: TimelineRow[] = selectConsultations(patient.events).map((e) => ({
    ...e,
    display: { title: "Nueva consulta registrada", detail: e.rawText ?? "", group: "Consulta" },
  }));
  const all = sortByDate([...events, ...consultEvents]).reverse();

  const [active, setActive] = useState<Set<TimelineGroup>>(new Set(TIMELINE_GROUPS));
  const toggle = (g: TimelineGroup) =>
    setActive((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  const filtered = all.filter((e) => active.has(e.display.group));
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="pv-fade-in">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: COLORS.slateLight, marginRight: 4 }}>
          <Filter size={12} /> Filtrar:
        </span>
        {TIMELINE_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => toggle(g)}
            className="pv-chip"
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              padding: "5px 11px",
              borderRadius: 20,
              border: `1px solid ${active.has(g) ? GROUP_COLOR[g] : COLORS.line}`,
              background: active.has(g) ? `${GROUP_COLOR[g]}14` : "white",
              color: active.has(g) ? GROUP_COLOR[g] : COLORS.slateLight,
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <div style={{ position: "relative", paddingLeft: 22 }}>
        <div style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 2, background: COLORS.line }} />
        {filtered.map((ev, i) => {
          const c = GROUP_COLOR[ev.display.group];
          const Icon = GROUP_ICON[ev.display.group];
          const open = openIdx === i;
          return (
            <div key={ev.id} style={{ position: "relative", marginBottom: 14 }}>
              <div style={{ position: "absolute", left: -22, top: 3, width: 12, height: 12, borderRadius: 99, background: c, border: "2px solid white", boxShadow: `0 0 0 2px ${c}33` }} />
              <div onClick={() => setOpenIdx(open ? null : i)} style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={14} color={c} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: "0.04em" }}>{ev.display.group}</span>
                    <span style={{ fontSize: 12, color: COLORS.slateLight }}>{formatDate(ev.date)}</span>
                    {ev.confidence && ev.confidence !== "confirmado" && <DataConfidenceBadge level={ev.confidence} reason={ev.confidenceReason} />}
                  </div>
                  <ChevronDown size={15} color={COLORS.slateLight} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{ev.display.title}</div>
                {open && <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 8, lineHeight: 1.55, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8 }}>{ev.display.detail}</div>}
              </div>
            </div>
          );
        })}
        {!filtered.length && <div style={{ color: COLORS.slateLight, fontSize: 13.5, paddingLeft: 4 }}>Ningún evento coincide con los filtros seleccionados.</div>}
      </div>
    </div>
  );
}
