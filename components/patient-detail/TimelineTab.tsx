"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import { COLORS } from "@/utils/theme";
import { formatDate, sortByDate } from "@/utils/date";
import { GROUP_COLOR, GROUP_ICON, TIMELINE_GROUPS } from "@/utils/eventGroupStyle";
import { CLINICAL_EVENT_TYPES } from "@/domain/clinicalEvent";
import { selectConsultations, selectMicrobiology, selectPFT } from "@/domain/selectors";
import { comparePft } from "@/domain/pft";
import { microbiologyObjectiveChange } from "@/domain/microbiologyTrend";
import { displayForEvent, episodeSummary, groupTimelineRows, isNotableEvent, trendForRow } from "@/domain/timeline";
import { computeTurningPoints } from "@/engines/turningPoints";
import { DataConfidenceBadge, TrendBadge } from "@/components/ui";
import type { ClinicalEvent, MicrobiologyEvent, PulmonaryFunctionEvent } from "@/types/clinicalEvent";
import type { Patient } from "@/types/patient";
import type { TimelineCluster } from "@/domain/timeline";
import type { ClinicalTrend } from "@/types/clinicalTrend";
import type { TimelineEntry, TimelineGroup } from "@/types/timeline";
import type { TurningPoint } from "@/types/turningPoints";

/**
 * Cronología rediseñada — la unidad de lectura es el EPISODIO (hoy: el
 * día, ver domain/timeline.ts#episodeKeyForEvent), no el evento suelto.
 * Objetivo: que se entienda la evolución de un vistazo, no leyendo una
 * lista plana. Nada de esto reevalúa ni reinterpreta datos: agrupa,
 * compara aritméticamente (PFR) y reutiliza `computeTurningPoints()`
 * para decidir qué destacar — cero reglas clínicas nuevas.
 */

type TimelineRow = ClinicalEvent & { display: TimelineEntry };

function isPft(e: ClinicalEvent): e is PulmonaryFunctionEvent {
  return e.type === CLINICAL_EVENT_TYPES.PULMONARY_FUNCTION;
}

function isMicrobiology(e: ClinicalEvent): e is MicrobiologyEvent {
  return e.type === CLINICAL_EVENT_TYPES.MICROBIOLOGY;
}

const TRUNCATE_AT = 220;

/** Corta en el último espacio antes del límite, para no partir una palabra por la mitad. */
function truncateAtWordBoundary(text: string, limit: number): string {
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

/**
 * Consultas/evoluciones largas se muestran truncadas con "Ver más" —
 * el resto del detalle (PFR, microbiología, imagen…) ya es
 * suficientemente corto y se sigue mostrando entero. No resume el
 * texto: solo lo corta y permite revelarlo completo bajo demanda.
 */
function TruncatedText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= TRUNCATE_AT || expanded) {
    return (
      <>
        {text}
        {text.length > TRUNCATE_AT && (
          <>
            {" "}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(false);
              }}
              style={{ background: "none", border: "none", padding: 0, color: COLORS.tealDeep, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
            >
              Ver menos
            </button>
          </>
        )}
      </>
    );
  }
  return (
    <>
      {truncateAtWordBoundary(text, TRUNCATE_AT)}…{" "}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
        style={{ background: "none", border: "none", padding: 0, color: COLORS.tealDeep, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
      >
        Ver más
      </button>
    </>
  );
}

/** Cluster de eventos agrupados por año, en el mismo orden (descendente) en que ya vienen los clusters. */
function groupClustersByYear<T extends ClinicalEvent>(clusters: TimelineCluster<T>[]): { year: number; clusters: TimelineCluster<T>[] }[] {
  const out: { year: number; clusters: TimelineCluster<T>[] }[] = [];
  for (const cluster of clusters) {
    const year = new Date(cluster.date).getFullYear();
    const last = out[out.length - 1];
    if (last && last.year === year) last.clusters.push(cluster);
    else out.push({ year, clusters: [cluster] });
  }
  return out;
}

function EventLine({
  row,
  notable,
  trend,
  momentoClaveNote,
  objectiveNote,
  showDate,
  open,
  onToggle,
  extraDetailLines,
}: {
  row: TimelineRow;
  notable: boolean;
  trend: ClinicalTrend;
  momentoClaveNote: string | null;
  objectiveNote: string | null;
  showDate: boolean;
  open: boolean;
  onToggle: () => void;
  extraDetailLines: string[];
}) {
  const c = GROUP_COLOR[row.display.group];
  const Icon = GROUP_ICON[row.display.group];
  return (
    <div onClick={onToggle} style={{ cursor: "pointer", padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", minWidth: 0 }}>
          <Icon size={13} color={c} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: "0.03em" }}>{row.display.group}</span>
          {showDate && <span style={{ fontSize: 12, color: COLORS.slateLight }}>{formatDate(row.date)}</span>}
          {trend ? (
            <TrendBadge trend={trend} title={momentoClaveNote ?? undefined} />
          ) : (
            momentoClaveNote && (
              <span
                title={momentoClaveNote}
                style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, background: COLORS.redTint, padding: "1px 7px", borderRadius: 20, whiteSpace: "nowrap" }}
              >
                Momento clave
              </span>
            )
          )}
          {objectiveNote && (
            <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.slate, background: COLORS.paper, padding: "1px 7px", borderRadius: 20, whiteSpace: "nowrap" }}>
              {objectiveNote}
            </span>
          )}
          {row.confidence !== "confirmado" && <DataConfidenceBadge reason={row.confidenceReason} />}
        </div>
        <ChevronDown size={13} color={COLORS.slateLight} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: notable ? 700 : 500, color: notable ? COLORS.ink : COLORS.slate, marginTop: 3 }}>{row.display.title}</div>
      {open && (
        <div style={{ fontSize: 13, color: COLORS.slate, marginTop: 8, lineHeight: 1.55, borderTop: `1px solid ${COLORS.line}`, paddingTop: 8 }}>
          {row.type === CLINICAL_EVENT_TYPES.CONSULTATION ? <TruncatedText text={row.display.detail} /> : row.display.detail}
          {extraDetailLines.map((line, i) => (
            <div key={i} style={{ marginTop: 6, fontSize: 12.5, color: COLORS.ink }}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClusterCard({
  cluster,
  notable,
  momentoClaveNote,
  openId,
  onToggle,
  extraDetailLinesFor,
  trendFor,
  objectiveNoteFor,
}: {
  cluster: TimelineCluster<TimelineRow>;
  notable: boolean;
  momentoClaveNote: string | null;
  openId: string | null;
  onToggle: (id: string) => void;
  extraDetailLinesFor: (row: TimelineRow) => string[];
  trendFor: (row: TimelineRow) => ClinicalTrend;
  objectiveNoteFor: (row: TimelineRow) => string | null;
}) {
  const accent = notable ? COLORS.red : cluster.rows.length === 1 ? GROUP_COLOR[cluster.rows[0].display.group] : COLORS.line;
  const dotColor = notable ? COLORS.red : cluster.rows.length === 1 ? GROUP_COLOR[cluster.rows[0].display.group] : COLORS.slateLight;
  const clusterTrend = cluster.rows.length > 1 ? (cluster.rows.map(trendFor).find((t) => t) ?? null) : null;

  return (
    <div style={{ position: "relative", marginBottom: 12 }}>
      <div
        style={{
          position: "absolute",
          left: notable ? -23 : -21,
          top: notable ? 3 : 5,
          width: notable ? 12 : 8,
          height: notable ? 12 : 8,
          borderRadius: 99,
          background: dotColor,
          border: "2px solid white",
          boxShadow: notable ? `0 0 0 2px ${dotColor}33` : "none",
        }}
      />
      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.line}`, borderLeft: `${notable ? 4 : 3}px solid ${accent}`, borderRadius: 10, padding: "10px 14px" }}>
        {cluster.rows.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.slate }}>{formatDate(cluster.date)}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{episodeSummary(cluster.rows)}</span>
            {clusterTrend ? (
              <TrendBadge trend={clusterTrend} title={momentoClaveNote ?? undefined} />
            ) : (
              momentoClaveNote && (
                <span
                  title={momentoClaveNote}
                  style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, background: COLORS.redTint, padding: "1px 7px", borderRadius: 20 }}
                >
                  Momento clave
                </span>
              )
            )}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {cluster.rows.map((row, i) => (
            <div key={row.id} style={{ borderTop: i > 0 ? `1px dashed ${COLORS.line}` : "none" }}>
              <EventLine
                row={row}
                notable={notable}
                trend={trendFor(row)}
                momentoClaveNote={cluster.rows.length === 1 ? momentoClaveNote : null}
                objectiveNote={objectiveNoteFor(row)}
                showDate={cluster.rows.length === 1}
                open={openId === row.id}
                onToggle={() => onToggle(row.id)}
                extraDetailLines={extraDetailLinesFor(row)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function YearSection({ year, count, defaultOpen, children }: { year: number; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 18 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: open ? 10 : 0 }}
      >
        {open ? <ChevronDown size={14} color={COLORS.slateLight} /> : <ChevronRight size={14} color={COLORS.slateLight} />}
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy }}>{year}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.slateLight, background: COLORS.paper, borderRadius: 20, padding: "1px 8px" }}>{count}</span>
      </button>
      {open && children}
    </div>
  );
}

function ClusterList({
  clusters,
  turningPointByDate,
  turningPointDates,
  openId,
  onToggle,
  extraDetailLinesFor,
  trendFor,
  objectiveNoteFor,
}: {
  clusters: TimelineCluster<TimelineRow>[];
  turningPointByDate: Map<string, TurningPoint>;
  turningPointDates: ReadonlySet<string>;
  openId: string | null;
  onToggle: (id: string) => void;
  extraDetailLinesFor: (row: TimelineRow) => string[];
  trendFor: (row: TimelineRow) => ClinicalTrend;
  objectiveNoteFor: (row: TimelineRow) => string | null;
}) {
  return (
    <div style={{ position: "relative", paddingLeft: 22 }}>
      <div style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 2, background: COLORS.line }} />
      {clusters.map((cluster) => {
        const notable = cluster.rows.some((r) => isNotableEvent(r, turningPointDates));
        const tp = cluster.rows.map((r) => turningPointByDate.get(r.date)).find((t): t is TurningPoint => t != null);
        return (
          <ClusterCard
            key={cluster.key}
            cluster={cluster}
            notable={notable}
            momentoClaveNote={tp?.interpretation ?? null}
            openId={openId}
            onToggle={onToggle}
            extraDetailLinesFor={extraDetailLinesFor}
            trendFor={trendFor}
            objectiveNoteFor={objectiveNoteFor}
          />
        );
      })}
    </div>
  );
}

export function TimelineTab({ patient }: { patient: Patient }) {
  const rows: TimelineRow[] = useMemo(() => {
    const events: TimelineRow[] = patient.events
      .filter((e) => e.type !== CLINICAL_EVENT_TYPES.CONSULTATION)
      .map((e) => ({ ...e, display: displayForEvent(e) }));
    const consultEvents: TimelineRow[] = selectConsultations(patient.events).map((e) => ({ ...e, display: displayForEvent(e) }));
    return sortByDate([...events, ...consultEvents]).reverse();
  }, [patient]);

  const turningPointByDate = useMemo(() => {
    const map = new Map<string, TurningPoint>();
    for (const tp of computeTurningPoints(patient)) if (!map.has(tp.date)) map.set(tp.date, tp);
    return map;
  }, [patient]);
  const turningPointDates = useMemo(() => new Set(turningPointByDate.keys()), [turningPointByDate]);

  // Prueba de función pulmonar inmediatamente anterior a cada una — para la comparación FEV1/FVC/FEV1-FVC (ver domain/pft.ts).
  const previousPftById = useMemo(() => {
    const sorted = selectPFT(patient.events);
    const map = new Map<string, PulmonaryFunctionEvent | null>();
    sorted.forEach((p, i) => map.set(p.id, i > 0 ? sorted[i - 1] : null));
    return map;
  }, [patient]);

  const extraDetailLinesFor = (row: TimelineRow): string[] => {
    if (!isPft(row)) return [];
    return comparePft(row, previousPftById.get(row.id) ?? null);
  };

  const trendFor = (row: TimelineRow): ClinicalTrend => trendForRow(row, turningPointByDate.get(row.date)?.criterion ?? null);

  // Para el descriptor objetivo de microbiología (capa 1 — nunca una etiqueta de interpretación, ver domain/microbiologyTrend.ts).
  const sortedMicrobiology = useMemo(() => selectMicrobiology(patient.events), [patient]);
  const objectiveNoteFor = (row: TimelineRow): string | null => (isMicrobiology(row) ? microbiologyObjectiveChange(row, sortedMicrobiology) : null);

  const [active, setActive] = useState<Set<TimelineGroup>>(new Set(TIMELINE_GROUPS));
  const toggle = (g: TimelineGroup) =>
    setActive((prev) => {
      const n = new Set(prev);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });
  const filtered = rows.filter((e) => active.has(e.display.group));
  const [openId, setOpenId] = useState<string | null>(null);
  const onToggleOpen = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  const clusters = useMemo(() => groupTimelineRows(filtered), [filtered]);
  const yearGroups = useMemo(() => groupClustersByYear(clusters), [clusters]);

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

      {!filtered.length && <div style={{ color: COLORS.slateLight, fontSize: 13.5, paddingLeft: 4 }}>Ningún evento coincide con los filtros seleccionados.</div>}

      {yearGroups.length <= 1
        ? yearGroups.map((yg) => (
            <ClusterList
              key={yg.year}
              clusters={yg.clusters}
              turningPointByDate={turningPointByDate}
              turningPointDates={turningPointDates}
              openId={openId}
              onToggle={onToggleOpen}
              extraDetailLinesFor={extraDetailLinesFor}
              trendFor={trendFor}
              objectiveNoteFor={objectiveNoteFor}
            />
          ))
        : yearGroups.map((yg, i) => (
            <YearSection key={yg.year} year={yg.year} count={yg.clusters.reduce((n, c) => n + c.rows.length, 0)} defaultOpen={i === 0}>
              <ClusterList
                clusters={yg.clusters}
                turningPointByDate={turningPointByDate}
                turningPointDates={turningPointDates}
                openId={openId}
                onToggle={onToggleOpen}
                extraDetailLinesFor={extraDetailLinesFor}
                trendFor={trendFor}
                objectiveNoteFor={objectiveNoteFor}
              />
            </YearSection>
          ))}
    </div>
  );
}
