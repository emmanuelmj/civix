"use client";

import { useRef, useMemo } from "react";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";

/* ─── Department config ─── */
const DEPARTMENTS = [
  { name: "Municipal", color: "#007AFF" },
  { name: "Water", color: "#3b82f6" },
  { name: "Electricity", color: "#F59E0B" },
  { name: "Traffic", color: "#EF4444" },
  { name: "Construction", color: "#a855f7" },
  { name: "Emergency", color: "#ef4444" },
] as const;

/* ─── Deterministic pseudo-random from seed ─── */
function seededHeights(seed: number): number[] {
  const heights: number[] = [];
  let s = seed * 2654435761;
  for (let i = 0; i < 7; i++) {
    s = ((s >>> 0) * 16807 + 13) & 0x7fffffff;
    heights.push(0.2 + (s % 100) / 125);
  }
  return heights;
}

/* ─── Helpers ─── */
function pct(n: number, total: number): string {
  if (total === 0) return "0";
  return ((n / total) * 100).toFixed(0);
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── Sub-components ─── */

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      className="paper-card rounded-xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-light)" }}
    >
      <p
        className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
        style={{ color: "var(--fg-muted)", marginBottom: 8 }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-semibold tabular-nums"
        style={{ color: color ?? "var(--fg-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}

function Sparkline({ seed, color }: { seed: number; color: string }) {
  const bars = seededHeights(seed);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 40 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 6,
            borderRadius: 2,
            height: `${Math.round(h * 100)}%`,
            background: color,
            opacity: 0.75,
          }}
        />
      ))}
    </div>
  );
}

function DepartmentCard({
  department,
  index,
  events,
}: {
  department: (typeof DEPARTMENTS)[number];
  index: number;
  events: PulseEvent[];
}) {
  const deptEvents = events.filter((e) => e.domain === department.name);
  const active = deptEvents.filter(
    (e) => e.status !== "RESOLVED"
  ).length;
  const critical = deptEvents.filter((e) => e.severity === "critical").length;
  const dispatched = deptEvents.filter(
    (e) => e.status === "DISPATCHED" || e.status === "IN_PROGRESS"
  ).length;
  const resolved = deptEvents.filter((e) => e.status === "RESOLVED").length;
  const total = deptEvents.length;
  const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;

  return (
    <div
      className="min-w-[340px] snap-center paper-card rounded-2xl p-6 flex-shrink-0"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Department header */}
      <div className="flex items-center gap-2.5 mb-5">
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: department.color,
            flexShrink: 0,
          }}
        />
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--fg-primary)" }}
        >
          {department.name}
        </h3>
      </div>

      {/* 2×2 stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {([
          { label: "Active", value: active },
          { label: "Critical", value: critical },
          { label: "Dispatched", value: dispatched },
          { label: "Resolved", value: resolved },
        ] as const).map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg px-3 py-2"
            style={{ background: "var(--bg-surface)" }}
          >
            <p
              className="text-[10px] font-mono uppercase tracking-[0.15em]"
              style={{ color: "var(--fg-muted)", marginBottom: 2 }}
            >
              {stat.label}
            </p>
            <p
              className="text-lg font-semibold tabular-nums"
              style={{ color: "var(--fg-primary)" }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Avg Response Time */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.15em]"
          style={{ color: "var(--fg-muted)" }}
        >
          Avg Response Time
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--fg-primary)" }}
        >
          ~14m
        </span>
      </div>

      {/* Resolution Rate */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className="text-[10px] font-mono uppercase tracking-[0.15em]"
            style={{ color: "var(--fg-muted)" }}
          >
            Resolution Rate
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: department.color }}
          >
            {pct(resolved, total)}%
          </span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 4, background: "var(--bg-surface)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${resolutionRate}%`,
              background: department.color,
            }}
          />
        </div>
      </div>

      {/* Sparkline */}
      <div className="mb-5">
        <p
          className="text-[10px] font-mono uppercase tracking-[0.15em] mb-2"
          style={{ color: "var(--fg-muted)" }}
        >
          Last 7 Days
        </p>
        <Sparkline seed={index + 1} color={department.color} />
      </div>

      {/* View Full Report link */}
      <button
        className="text-xs font-medium hover:opacity-80 transition-opacity"
        style={{ color: department.color, background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        View Full Report →
      </button>
    </div>
  );
}

/* ─── Main Component ─── */

export function ExecutiveReportsView({
  events,
  logs,
  intake,
}: {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  intake: IntakeFeedItem[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const kpis = useMemo(() => {
    const total = events.length;
    const critical = events.filter((e) => e.severity === "critical").length;
    const dispatched = events.filter(
      (e) => e.status === "DISPATCHED" || e.status === "IN_PROGRESS"
    ).length;
    const resolved = events.filter((e) => e.status === "RESOLVED").length;
    return { total, critical, dispatched, resolved };
  }, [events]);

  const scrollBy = (direction: 1 | -1) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction * 370,
      behavior: "smooth",
    });
  };

  if (events.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-32"
        style={{ color: "var(--fg-muted)" }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-4 opacity-40"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <p className="text-sm font-medium" style={{ color: "var(--fg-secondary)" }}>
          No events to report
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          Executive reports will appear once grievances are ingested.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--fg-primary)" }}
          >
            Executive Reports
          </h2>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium font-mono"
            style={{
              background: "var(--bg-surface)",
              color: "var(--fg-secondary)",
              border: "1px solid var(--border-light)",
            }}
          >
            {formatDate()}
          </span>
        </div>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: "var(--fg-muted)" }}
        >
          {kpis.total} total events
        </span>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Grievances" value={kpis.total} />
        <KpiCard label="Critical" value={kpis.critical} color="var(--accent-crimson)" />
        <KpiCard label="Dispatched" value={kpis.dispatched} color="var(--accent-blue)" />
        <KpiCard label="Resolved" value={kpis.resolved} color="var(--accent-green)" />
      </div>

      {/* ─── Department Carousel ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-[11px] font-mono font-semibold uppercase tracking-[0.15em]"
            style={{ color: "var(--fg-muted)" }}
          >
            Department Breakdown
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => scrollBy(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center paper-card transition-colors hover:opacity-80"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--fg-secondary)",
                cursor: "pointer",
              }}
              aria-label="Scroll left"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => scrollBy(1)}
              className="w-8 h-8 rounded-full flex items-center justify-center paper-card transition-colors hover:opacity-80"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--fg-secondary)",
                cursor: "pointer",
              }}
              aria-label="Scroll right"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory gap-6 no-scrollbar pb-8 px-1"
        >
          {DEPARTMENTS.map((dept, i) => (
            <DepartmentCard
              key={dept.name}
              department={dept}
              index={i}
              events={events}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
