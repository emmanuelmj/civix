"use client";

import { useState } from "react";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";

interface ReportsProps {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  intake: IntakeFeedItem[];
}

const DEPARTMENTS = ["MUNICIPAL", "WATER", "ELECTRICITY", "TRAFFIC", "CONSTRUCTION", "EMERGENCY"] as const;

const DEPT_LABELS: Record<string, string> = {
  MUNICIPAL: "Municipal Corporation",
  WATER: "Water & Sewerage Board",
  ELECTRICITY: "Electricity Department",
  TRAFFIC: "Traffic Police",
  CONSTRUCTION: "Building & Construction",
  EMERGENCY: "Emergency Services",
};

const DEPT_COLORS: Record<string, string> = {
  MUNICIPAL: "var(--accent-blue)",
  WATER: "#3b82f6",
  ELECTRICITY: "var(--accent-amber)",
  TRAFFIC: "var(--accent-crimson)",
  CONSTRUCTION: "#a855f7",
  EMERGENCY: "#ef4444",
};

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

function DepartmentReport({ dept, label, color, events: deptEvents, logs: deptLogs }: {
  dept: string; label: string; color: string; events: PulseEvent[]; logs: SwarmLogEntry[];
}) {
  const critical = deptEvents.filter(e => e.severity === "critical");
  const resolved = deptEvents.filter(e => e.status === "RESOLVED");
  const pending = deptEvents.filter(e => e.status !== "RESOLVED");
  const resRate = deptEvents.length > 0 ? Math.round((resolved.length / deptEvents.length) * 100) : 0;

  return (
    <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--bg-card)", borderColor: color }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg-primary)" }}>{label}</h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: `${color}18`, color }}>
          {deptEvents.length} grievances
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={deptEvents.length} color={color} />
        <KpiCard label="Critical" value={critical.length} color="var(--accent-crimson)" />
        <KpiCard label="Pending" value={pending.length} color="var(--accent-amber)" />
        <KpiCard label="Resolution Rate" value={`${resRate}%`} color="var(--accent-green)" />
      </div>
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>Grievance Log</h4>
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {deptEvents.map(e => (
            <div key={e.event_id} className="flex items-center gap-3 py-1.5 border-b last:border-0"
              style={{ borderColor: "var(--border-light)" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.severity_color }} />
              <span className="text-[11px] flex-1 truncate" style={{ color: "var(--fg-secondary)" }}>
                {e.summary || e.event_id}
              </span>
              <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded" style={{
                background: e.status === "RESOLVED" ? "var(--accent-green-dim)" : e.assigned_officer ? "var(--accent-blue-dim)" : "var(--accent-amber-dim)",
                color: e.status === "RESOLVED" ? "var(--accent-green)" : e.assigned_officer ? "var(--accent-blue)" : "var(--accent-amber)",
              }}>
                {e.status === "RESOLVED" ? "Resolved" : e.assigned_officer ? e.assigned_officer.officer_id : "Pending"}
              </span>
            </div>
          ))}
        </div>
      </div>
      {deptLogs.length > 0 && (
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>Agent Activity</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {deptLogs.slice(0, 8).map(log => (
              <p key={log.id} className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>{log.message}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Reports({ events, logs, intake }: ReportsProps) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const now = new Date();

  const deptEvents = (dept: string) =>
    events.filter(e => e.domain.toUpperCase() === dept || e.domain === dept);

  const deptStats = DEPARTMENTS.map(dept => {
    const evts = deptEvents(dept);
    const critical = evts.filter(e => e.severity === "critical").length;
    const resolved = evts.filter(e => e.status === "RESOLVED").length;
    const dispatched = evts.filter(e => e.assigned_officer).length;
    return { dept, total: evts.length, critical, resolved, dispatched, events: evts };
  }).filter(d => d.total > 0 || selectedDept === d.dept);

  const totalEvents = events.length;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg" style={{ color: "var(--fg-primary)" }}>▤</span>
          <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>Executive Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "var(--bg-elevated)", color: "var(--fg-muted)" }}>
            {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
            {totalEvents} total events
          </span>
        </div>
      </div>

      {/* Overview summary */}
      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>
          Cross-Department Summary
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Total Grievances" value={totalEvents} color="var(--accent-blue)" />
          <KpiCard label="Critical" value={events.filter(e => e.severity === "critical").length} color="var(--accent-crimson)" />
          <KpiCard label="Dispatched" value={events.filter(e => e.assigned_officer).length} color="var(--accent-blue)" />
          <KpiCard label="Resolved" value={events.filter(e => e.status === "RESOLVED").length} color="var(--accent-green)" />
        </div>
        <div className="space-y-2">
          {DEPARTMENTS.map(dept => {
            const evts = deptEvents(dept);
            if (evts.length === 0 && selectedDept !== dept) return null;
            const pct = totalEvents > 0 ? (evts.length / totalEvents) * 100 : 0;
            const isSelected = selectedDept === dept;
            return (
              <button key={dept} onClick={() => setSelectedDept(isSelected ? null : dept)}
                className="w-full flex items-center gap-3 py-1.5 rounded-md px-2 transition-all"
                style={{ background: isSelected ? "var(--bg-elevated)" : "transparent" }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DEPT_COLORS[dept] }} />
                <span className="text-[12px] font-medium w-40 text-left truncate" style={{ color: "var(--fg-secondary)" }}>
                  {DEPT_LABELS[dept]}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: DEPT_COLORS[dept] }} />
                </div>
                <span className="text-[12px] font-mono tabular-nums w-8 text-right shrink-0" style={{ color: "var(--fg-muted)" }}>
                  {evts.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Department detail */}
      {selectedDept && (
        <DepartmentReport
          dept={selectedDept}
          label={DEPT_LABELS[selectedDept]}
          color={DEPT_COLORS[selectedDept]}
          events={deptEvents(selectedDept)}
          logs={logs.filter(l => {
            const evtIds = new Set(deptEvents(selectedDept).map(e => e.event_id));
            return l.event_id ? evtIds.has(l.event_id) : false;
          })}
        />
      )}

      {/* All department cards */}
      {!selectedDept && deptStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deptStats.map(ds => (
            <button key={ds.dept} onClick={() => setSelectedDept(ds.dept)}
              className="rounded-lg border p-4 text-left transition-all hover:border-current"
              style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: DEPT_COLORS[ds.dept] }} />
                <h4 className="text-[13px] font-semibold" style={{ color: "var(--fg-primary)" }}>{DEPT_LABELS[ds.dept]}</h4>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: DEPT_COLORS[ds.dept] }}>{ds.total}</p>
                  <p className="text-[9px] font-mono" style={{ color: "var(--fg-muted)" }}>Total</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--accent-crimson)" }}>{ds.critical}</p>
                  <p className="text-[9px] font-mono" style={{ color: "var(--fg-muted)" }}>Critical</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--accent-blue)" }}>{ds.dispatched}</p>
                  <p className="text-[9px] font-mono" style={{ color: "var(--fg-muted)" }}>Dispatch</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--accent-green)" }}>{ds.resolved}</p>
                  <p className="text-[9px] font-mono" style={{ color: "var(--fg-muted)" }}>Resolved</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {totalEvents === 0 && (
        <div className="flex items-center justify-center h-48 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
          <p className="text-[12px] font-mono" style={{ color: "var(--fg-muted)" }}>No events yet. Trigger events to generate department reports.</p>
        </div>
      )}
    </div>
  );
}
