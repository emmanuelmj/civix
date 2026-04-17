"use client";

import { usePulse } from "@/lib/pulse-context";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { events, logs, intake } = usePulse();

  const total = events.length;
  const critical = events.filter(e => e.severity === "critical").length;
  const resolved = events.filter(e => e.status === "RESOLVED").length;
  const dispatched = events.filter(e => e.assigned_officer).length;

  const domainCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.domain] = (acc[e.domain] || 0) + 1;
    return acc;
  }, {});

  const channelCounts = intake.reduce<Record<string, number>>((acc, i) => {
    acc[i.channel] = (acc[i.channel] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg" style={{ color: "var(--fg-primary)" }}>◔</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>Analytics</h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>Live</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Events" value={total} color="var(--accent-blue)" />
        <KpiCard label="Critical" value={critical} color="var(--accent-crimson)" />
        <KpiCard label="Dispatched" value={dispatched} color="var(--accent-blue)" />
        <KpiCard label="Resolved" value={resolved} color="var(--accent-green)" />
      </div>

      {/* Domain breakdown */}
      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>Events by Domain</h3>
        <div className="space-y-2">
          {Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).map(([domain, count]) => (
            <div key={domain} className="flex items-center gap-3">
              <span className="text-[12px] font-medium w-28" style={{ color: "var(--fg-secondary)" }}>{domain}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(count / total) * 100}%`, background: "var(--accent-blue)" }} />
              </div>
              <span className="text-[12px] font-mono tabular-nums w-8 text-right" style={{ color: "var(--fg-muted)" }}>{count}</span>
            </div>
          ))}
          {Object.keys(domainCounts).length === 0 && (
            <p className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>No events yet — trigger an analysis to see data.</p>
          )}
        </div>
      </div>

      {/* Intake channels */}
      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>Intake by Channel</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(channelCounts).map(([ch, count]) => (
            <div key={ch} className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "var(--bg-elevated)" }}>
              <span className="text-[12px] font-mono uppercase" style={{ color: "var(--fg-secondary)" }}>{ch}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--accent-blue)" }}>{count}</span>
            </div>
          ))}
          {Object.keys(channelCounts).length === 0 && (
            <p className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>No intake items yet.</p>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard label="Swarm Logs" value={logs.length} color="var(--accent-amber)" />
        <KpiCard label="Intake Items" value={intake.length} color="var(--fg-secondary)" />
        <KpiCard label="Resolution Rate" value={total > 0 ? `${Math.round((resolved / total) * 100)}%` : "—"} color="var(--accent-green)" />
      </div>
    </div>
  );
}
