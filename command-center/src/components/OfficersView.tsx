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
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium"
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

function OfficerCard({
  agg,
  onClick,
}: {
  agg: OfficerAggregate;
  onClick: () => void;
}) {
  const { officer, activeTasks, domains } = agg;
  const isActive = activeTasks > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="rounded-xl p-5 border cursor-pointer transition-all duration-200 hover:-translate-y-1"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-light)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
          style={{
            background: "rgba(0,122,255,0.08)",
            color: "var(--accent-blue)",
          }}
        >
          {initials(officer.officer_id)}
        </div>

        <div className="flex-1 min-w-0">
          {/* name + status */}
          <div className="flex items-center gap-2">
            <p
              className="text-sm font-semibold truncate"
              style={{ color: "var(--fg-primary)" }}
            >
              {officer.name || officer.officer_id}
            </p>
            <StatusDot active={isActive} />
            <span
              className="text-[11px] font-medium"
              style={{
                color: isActive
                  ? "var(--accent-blue)"
                  : "var(--accent-green)",
              }}
            >
              {isActive ? "Dispatched" : "Available"}
            </span>
          </div>

          {/* skills */}
          {officer.skills && officer.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {officer.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "var(--bg-surface)",
                    color: "var(--fg-secondary)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* assignments + domains */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--fg-muted)" }}
            >
              {activeTasks} active assignment{activeTasks !== 1 ? "s" : ""}
            </span>
            {domains.map((d) => (
              <DomainBadge key={d} domain={d as PulseEvent["domain"]} />
            ))}
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

        {/* ── SKILLS ──────────────────────────────────────────── */}
        {officer.skills && officer.skills.length > 0 && (
          <div className="mb-6">
            <p
              className={`${LABEL} mb-2`}
              style={{ color: "var(--fg-muted)" }}
            >
              Skills
            </p>
            <div className="flex flex-wrap gap-2">
              {officer.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: "rgba(0,122,255,0.06)",
                    color: "var(--accent-blue)",
                    border: "1px solid rgba(0,122,255,0.12)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

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

export function OfficersView({ events }: { events: PulseEvent[] }) {
  const aggregates = useOfficerAggregates(events);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAgg = aggregates.find(
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
      <div className="mb-6">
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--fg-primary)" }}
        >
          Officers Directory
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          {aggregates.length} personnel ·{" "}
          {aggregates.filter((a) => a.activeTasks > 0).length} dispatched
        </p>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {aggregates.map((agg) => (
          <OfficerCard
            key={agg.officer.officer_id}
            agg={agg}
            onClick={() => setSelectedId(agg.officer.officer_id)}
          />
        ))}
      </div>

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
