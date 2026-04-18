"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Officer, PulseEvent } from "@/lib/types";

/* ── label style constant ─────────────────────────────────────── */
const LABEL =
  "text-[10px] font-semibold font-mono uppercase tracking-[0.2em]";

/* ── helpers ──────────────────────────────────────────────────── */

function initials(id: string): string {
  return id.slice(-2).toUpperCase();
}

function severityDotColor(severity: PulseEvent["severity"]): string {
  if (severity === "critical") return "var(--accent-crimson)";
  if (severity === "high") return "var(--accent-amber)";
  return "var(--accent-blue)";
}

function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── domain badge ─────────────────────────────────────────────── */

function DomainBadge({ domain }: { domain: PulseEvent["domain"] }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider"
      style={{
        background: "var(--bg-surface)",
        color: "var(--fg-secondary)",
        border: "1px solid var(--border-light)",
      }}
    >
      {domain}
    </span>
  );
}

/* ── status dot ───────────────────────────────────────────────── */

function StatusDot({ active }: { active: boolean }) {
  const color = active ? "var(--accent-blue)" : "var(--accent-green)";
  return (
    <span className="relative flex h-2.5 w-2.5">
      {!active && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-pulse"
          style={{ background: color }}
        />
      )}
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
    </span>
  );
}

/* ── aggregated officer data ──────────────────────────────────── */

interface OfficerAggregate {
  officer: Officer;
  events: PulseEvent[];
  activeTasks: number;
  resolvedCount: number;
  domains: string[];
}

function useOfficerAggregates(events: PulseEvent[]): OfficerAggregate[] {
  return useMemo(() => {
    const map = new Map<string, { officer: Officer; events: PulseEvent[] }>();

    for (const ev of events) {
      if (!ev.assigned_officer) continue;
      const id = ev.assigned_officer.officer_id;
      if (!map.has(id)) {
        map.set(id, { officer: ev.assigned_officer, events: [] });
      }
      map.get(id)!.events.push(ev);
    }

    return Array.from(map.values()).map(({ officer, events: evts }) => {
      const activeTasks = evts.filter(
        (e) => e.status === "DISPATCHED" || e.status === "IN_PROGRESS"
      ).length;
      const resolvedCount = evts.filter(
        (e) => e.status === "RESOLVED"
      ).length;
      const domains = [...new Set(evts.map((e) => e.domain))];
      return { officer, events: evts, activeTasks, resolvedCount, domains };
    });
  }, [events]);
}

/* ── officer card ─────────────────────────────────────────────── */

// Civix-Pulse "Zero-Bureaucracy" rule: every officer is certified for
// exactly one department. Map their primary skill code to a friendly label.
const DEPARTMENT_LABELS: Record<string, string> = {
  TRAFFIC:      "Road Infrastructure",
  MUNICIPAL:    "Municipal Services",
  WATER:        "Water & Sanitation",
  ELECTRICITY:  "Electrical Grid",
  EMERGENCY:    "Emergency Response",
  CONSTRUCTION: "Construction Oversight",
  SANITATION:   "Sanitation",
};

function primaryDepartment(skills?: string[] | null): string {
  const code = (skills?.[0] || "").toUpperCase();
  return DEPARTMENT_LABELS[code] || (code ? code.charAt(0) + code.slice(1).toLowerCase() : "General Services");
}

function OfficerCard({
  agg,
  onClick,
  onDomainFilter,
}: {
  agg: OfficerAggregate;
  onClick: () => void;
  onDomainFilter?: (domain: string) => void;
}) {
  const { officer, activeTasks, domains } = agg;
  const isActive = activeTasks > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="rounded-xl p-6 border cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-light)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-5">
        {/* avatar */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-2xl font-bold"
          style={{
            background: "rgba(0,122,255,0.08)",
            color: "var(--accent-blue)",
          }}
        >
          {initials(officer.officer_id)}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* name + status */}
          <div className="flex items-center gap-2">
            <p
              className="text-xl font-bold truncate"
              style={{ color: "var(--fg-primary)" }}
            >
              {officer.name || officer.officer_id}
            </p>
            <StatusDot active={isActive} />
            <span
              className="text-sm font-medium"
              style={{
                color: isActive
                  ? "var(--accent-blue)"
                  : "var(--accent-green)",
              }}
            >
              {isActive ? "Dispatched" : "Available"}
            </span>
          </div>

          {/* single department badge — Zero-Bureaucracy: one officer = one dept */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: "rgba(0,122,255,0.06)",
                color: "var(--accent-blue)",
                border: "1px solid rgba(0,122,255,0.15)",
              }}
            >
              <span className="opacity-60 mr-1.5">Department:</span>
              {primaryDepartment(officer.skills)}
            </span>
          </div>

          {/* assignments */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span
              className="text-sm font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              {activeTasks} active assignment{activeTasks !== 1 ? "s" : ""}
            </span>
            {domains.length > 0 && onDomainFilter && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDomainFilter(domains[0]);
                }}
                className="inline-flex items-center rounded-md px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-colors hover:opacity-80"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--fg-secondary)",
                  border: "1px solid var(--border-light)",
                }}
                title={`Filter by ${domains[0]}`}
              >
                Filter
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── modal ────────────────────────────────────────────────────── */

function OfficerModal({
  agg,
  onClose,
}: {
  agg: OfficerAggregate;
  onClose: () => void;
}) {
  const { officer, events: evts, activeTasks, resolvedCount } = agg;
  const isActive = activeTasks > 0;

  // current assignment (first active event)
  const currentEvent = evts.find(
    (e) => e.status === "DISPATCHED" || e.status === "IN_PROGRESS"
  );

  // last 3 events sorted by timestamp desc
  const history = [...evts]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);

  // close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-gray-100"
          style={{ color: "var(--fg-muted)" }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-lg font-bold"
            style={{
              background: "rgba(0,122,255,0.08)",
              color: "var(--accent-blue)",
            }}
          >
            {initials(officer.officer_id)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--fg-primary)" }}
              >
                {officer.name || officer.officer_id}
              </h2>
              <StatusDot active={isActive} />
              <span
                className="text-xs font-medium"
                style={{
                  color: isActive
                    ? "var(--accent-blue)"
                    : "var(--accent-green)",
                }}
              >
                {isActive ? "Dispatched" : "Available"}
              </span>
            </div>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: "var(--fg-muted)" }}
            >
              {officer.officer_id}
            </p>
          </div>
        </div>

        {/* ── CURRENT TASK ────────────────────────────────────── */}
        <div className="mb-6">
          <p className={`${LABEL} mb-2`} style={{ color: "var(--fg-muted)" }}>
            Current Task
          </p>
          {currentEvent ? (
            <div
              className="rounded-lg p-4 border"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-light)",
              }}
            >
              <p
                className="text-sm font-medium"
                style={{ color: "var(--fg-primary)" }}
              >
                {currentEvent.summary}
              </p>
              {officer.distance_km !== undefined && (
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Distance to target:{" "}
                  <span className="font-semibold">
                    {officer.distance_km.toFixed(1)}km
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              Standing by
            </p>
          )}
        </div>

        {/* ── STATS PANEL ─────────────────────────────────────── */}
        <div className="mb-6">
          <p className={`${LABEL} mb-2`} style={{ color: "var(--fg-muted)" }}>
            Performance
          </p>
          <div className="grid grid-cols-3 gap-3">
            {/* resolved */}
            <div
              className="rounded-lg p-3 border text-center"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-light)",
              }}
            >
              <p
                className="text-xl font-bold tabular-nums"
                style={{ color: "var(--fg-primary)" }}
              >
                {resolvedCount}
              </p>
              <p
                className="text-[10px] font-medium mt-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Total Resolutions
              </p>
            </div>

            {/* civic rating */}
            <div
              className="rounded-lg p-3 border text-center"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-light)",
              }}
            >
              <p
                className="text-xl font-bold"
                style={{ color: "var(--fg-primary)" }}
              >
                4.9/5
              </p>
              <p
                className="text-sm mt-0.5"
                style={{ color: "var(--accent-amber)" }}
              >
                ★★★★★
              </p>
              <p
                className="text-[10px] font-medium mt-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Civic Rating
              </p>
            </div>

            {/* avg resolve time */}
            <div
              className="rounded-lg p-3 border text-center"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-light)",
              }}
            >
              <p
                className="text-xl font-bold"
                style={{ color: "var(--fg-primary)" }}
              >
                ~11m
              </p>
              <p
                className="text-[10px] font-medium mt-1"
                style={{ color: "var(--fg-muted)" }}
              >
                Avg Time to Resolve
              </p>
            </div>
          </div>
        </div>

        {/* ── DEPARTMENT (single, enforced) ───────────────────── */}
        <div className="mb-6">
          <p
            className={`${LABEL} mb-2`}
            style={{ color: "var(--fg-muted)" }}
          >
            Department
          </p>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "rgba(0,122,255,0.06)",
              color: "var(--accent-blue)",
              border: "1px solid rgba(0,122,255,0.15)",
            }}
          >
            {primaryDepartment(officer.skills)}
          </span>
        </div>

        {/* ── HISTORY TIMELINE ────────────────────────────────── */}
        {history.length > 0 && (
          <div>
            <p
              className={`${LABEL} mb-3`}
              style={{ color: "var(--fg-muted)" }}
            >
              Recent History
            </p>
            <div className="relative pl-5">
              {/* vertical line */}
              <div
                className="absolute left-[5px] top-1 bottom-1 w-px"
                style={{ background: "var(--border)" }}
              />

              {history.map((ev, i) => (
                <div
                  key={ev.event_id}
                  className={`relative flex items-start gap-3 ${
                    i < history.length - 1 ? "pb-4" : ""
                  }`}
                >
                  {/* dot */}
                  <div
                    className="absolute -left-5 top-1.5 w-[10px] h-[10px] rounded-full border-2 border-white"
                    style={{
                      background: severityDotColor(ev.severity),
                    }}
                  />

                  {/* content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm leading-snug"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {ev.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <DomainBadge domain={ev.domain} />
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {relativeTime(ev.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── main view ────────────────────────────────────────────────── */

const ALL_DEPARTMENTS: PulseEvent["domain"][] = [
  "Municipal", "Traffic", "Construction", "Emergency", "Water", "Electricity",
];

export function OfficersView({ events, officers: dbOfficers = [] }: { events: PulseEvent[]; officers?: Officer[] }) {
  const eventAggregates = useOfficerAggregates(events);

  // Merge DB officers with event-derived officers
  const aggregates = useMemo(() => {
    const merged = new Map<string, OfficerAggregate>();

    // Start with DB officers (they are the source of truth)
    for (const o of dbOfficers) {
      merged.set(o.officer_id, {
        officer: o,
        events: [],
        activeTasks: 0,
        resolvedCount: 0,
        domains: (o.skills || []) as string[],
      });
    }

    // Layer on event-derived data
    for (const agg of eventAggregates) {
      const id = agg.officer.officer_id;
      if (merged.has(id)) {
        const existing = merged.get(id)!;
        merged.set(id, {
          ...existing,
          officer: { ...existing.officer, ...agg.officer },
          events: agg.events,
          activeTasks: agg.activeTasks,
          resolvedCount: agg.resolvedCount,
          domains: agg.domains.length > 0 ? agg.domains : existing.domains,
        });
      } else {
        merged.set(id, agg);
      }
    }

    return Array.from(merged.values());
  }, [dbOfficers, eventAggregates]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDept, setActiveDept] = useState<string | null>(null);

  const filteredAggregates = useMemo(() => {
    if (!activeDept) return aggregates;
    return aggregates.filter((a) =>
      a.domains.some((d) => d.toLowerCase() === activeDept.toLowerCase()) ||
      (a.officer.skills || []).some((s) => s.toLowerCase() === activeDept.toLowerCase())
    );
  }, [aggregates, activeDept]);

  // Collect all departments that actually appear across officers
  const availableDepts = useMemo(() => {
    const deptSet = new Set<string>();
    for (const agg of aggregates) {
      for (const d of agg.domains) deptSet.add(d);
      for (const s of agg.officer.skills || []) deptSet.add(s);
    }
    // Return in canonical order, only those that exist
    return ALL_DEPARTMENTS.filter((d) =>
      [...deptSet].some((s) => s.toLowerCase() === d.toLowerCase())
    );
  }, [aggregates]);

  const selectedAgg = filteredAggregates.find(
    (a) => a.officer.officer_id === selectedId
  );

  /* empty state */
  if (aggregates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: "var(--bg-surface)" }}
        >
          <span className="text-2xl">👤</span>
        </div>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--fg-secondary)" }}
        >
          No officers dispatched yet
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Officers will appear here once grievances are assigned
        </p>
      </div>
    );
  }

  return (
    <>
      {/* header */}
      <div className="pt-8 pb-4 px-6">
        <h2
          className="text-xl font-bold"
          style={{ color: "var(--fg-primary)" }}
        >
          Officers Directory
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {aggregates.length} personnel ·{" "}
          {aggregates.filter((a) => a.activeTasks > 0).length} dispatched
        </p>
      </div>

      {/* department filter pills */}
      {availableDepts.length > 0 && (
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveDept(null)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150"
            style={{
              background: !activeDept ? "var(--fg-primary)" : "var(--bg-surface)",
              color: !activeDept ? "white" : "var(--fg-secondary)",
              border: `1px solid ${!activeDept ? "var(--fg-primary)" : "var(--border-light)"}`,
            }}
          >
            All
          </button>
          {availableDepts.map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDept(activeDept === dept ? null : dept)}
              className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150"
              style={{
                background: activeDept === dept ? "var(--fg-primary)" : "var(--bg-surface)",
                color: activeDept === dept ? "white" : "var(--fg-secondary)",
                border: `1px solid ${activeDept === dept ? "var(--fg-primary)" : "var(--border-light)"}`,
              }}
            >
              {dept}
            </button>
          ))}
        </div>
      )}

      {/* grid */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAggregates.map((agg) => (
          <OfficerCard
            key={agg.officer.officer_id}
            agg={agg}
            onClick={() => setSelectedId(agg.officer.officer_id)}
            onDomainFilter={(d) => setActiveDept(activeDept === d ? null : d)}
          />
        ))}
      </div>

      {/* no results for filter */}
      {filteredAggregates.length === 0 && activeDept && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            No officers in <span className="font-semibold">{activeDept}</span> department
          </p>
        </div>
      )}

      {/* modal */}
      {selectedAgg && (
        <OfficerModal
          agg={selectedAgg}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
