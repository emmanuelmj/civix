"use client";

import { useEffect, useState } from "react";
import { MapLayer } from "@/components/MapLayer";
import { IngestionFeed } from "@/components/IngestionFeed";
import { SwarmLog } from "@/components/SwarmLog";
import { usePulseStream } from "@/lib/socket";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";
import { useDashboard } from "@/lib/dashboard-context";

export default function DashboardPage() {
  const { events, logs, intake, status } = usePulseStream();
  const { activeTab } = useDashboard();
  const [stats, setStats] = useState({ active: 0, critical: 0, resolved: 0, avgTime: "—" });
  const [mobileTab, setMobileTab] = useState<"map" | "intake" | "swarm">("map");

  useEffect(() => {
    const active = events.filter(e => e.status !== "RESOLVED").length;
    const critical = events.filter(e => e.severity === "critical" && e.status !== "RESOLVED").length;
    const resolved = events.filter(e => e.status === "RESOLVED").length;
    setStats({ active, critical, resolved, avgTime: active > 0 ? "~12m" : "—" });
  }, [events]);

  const activeEvents = events.filter(e => e.status !== "RESOLVED");

  // Sidebar tab views
  if (activeTab === "Intake Feed") {
    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg-card)" }}>
        <IngestionFeed items={intake} />
      </div>
    );
  }

  if (activeTab === "Swarm Log") {
    return (
      <div className="h-full flex flex-col" style={{ background: "var(--bg-card)" }}>
        <SwarmLog entries={logs} />
      </div>
    );
  }

  if (activeTab === "Analytics") {
    return <AnalyticsView events={events} logs={logs} intake={intake} />;
  }

  if (activeTab === "Officers") {
    return <OfficersView events={events} />;
  }

  if (activeTab === "Settings") {
    return <SettingsView status={status} events={events} logs={logs} intake={intake} />;
  }

  // Default: "Live Grid" — the main 3-panel dashboard
  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      {/* Mobile tab bar */}
      <div className="flex lg:hidden border-b shrink-0"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        {(["map", "intake", "swarm"] as const).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className="flex-1 py-2.5 text-[11px] font-mono uppercase tracking-wider text-center transition-colors border-b-2"
            style={{
              borderColor: mobileTab === tab ? "var(--accent-blue)" : "transparent",
              color: mobileTab === tab ? "var(--accent-blue)" : "var(--fg-muted)",
              background: mobileTab === tab ? "var(--accent-blue-dim)" : "transparent",
            }}>
            {tab === "map" ? `Grid (${stats.active})` : tab === "intake" ? `Intake (${intake.length})` : `Swarm (${logs.length})`}
          </button>
        ))}
      </div>

      {/* Mobile stats bar */}
      <div className="flex lg:hidden items-center gap-3 px-3 py-1.5 border-b overflow-x-auto shrink-0"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <StatPill label="Active" value={stats.active} color="var(--accent-blue)" />
        <StatPill label="Crit" value={stats.critical} color="var(--accent-crimson)" />
        <StatPill label="Done" value={stats.resolved} color="var(--accent-green)" />
      </div>

      {/* Left: Ingestion Feed — desktop only */}
      <div className="hidden lg:flex w-72 shrink-0 border-r flex-col"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <IngestionFeed items={intake} />
      </div>

      {/* Center: Map + Stats — desktop */}
      <div className="hidden lg:flex flex-1 flex-col min-w-0 min-h-0">
        <div className="flex items-center gap-6 px-4 py-2 border-b shrink-0"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
          <StatPill label="Active" value={stats.active} color="var(--accent-blue)" />
          <StatPill label="Critical" value={stats.critical} color="var(--accent-crimson)" />
          <StatPill label="Resolved" value={stats.resolved} color="var(--accent-green)" />
          <StatPill label="Avg Response" value={stats.avgTime} color="var(--fg-secondary)" />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: status === "connected" ? "var(--accent-green-dim)" : "var(--accent-amber-dim)",
                color: status === "connected" ? "var(--accent-green)" : "var(--accent-amber)",
              }}>
              {status === "connected" ? "● LIVE" : status === "connecting" ? "◌ CONNECTING" : "◉ DEMO"}
            </span>
            {(["Municipal", "Traffic", "Construction", "Emergency"] as const).map(d => {
              const count = events.filter(e => e.domain === d && e.status !== "RESOLVED").length;
              return (
                <span key={d} className="text-[10px] font-mono px-2 py-0.5 rounded"
                  style={{ background: "var(--bg-elevated)", color: "var(--fg-muted)" }}>
                  {d.slice(0, 5)} {count}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-h-0 p-2">
          <MapLayer events={activeEvents} />
        </div>
      </div>

      {/* Right: Swarm Log — desktop only */}
      <div className="hidden lg:flex w-72 shrink-0 border-l flex-col"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <SwarmLog entries={logs} />
      </div>

      {/* Mobile content — full height, one panel at a time */}
      <div className="flex-1 lg:hidden overflow-hidden min-h-0">
        {mobileTab === "map" && (
          <div className="h-full p-2">
            <MapLayer events={activeEvents} />
          </div>
        )}
        {mobileTab === "intake" && (
          <div className="h-full" style={{ background: "var(--bg-card)" }}>
            <IngestionFeed items={intake} />
          </div>
        )}
        {mobileTab === "swarm" && (
          <div className="h-full" style={{ background: "var(--bg-card)" }}>
            <SwarmLog entries={logs} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-mono uppercase" style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function AnalyticsView({ events, logs, intake }: { events: PulseEvent[]; logs: SwarmLogEntry[]; intake: IntakeFeedItem[] }) {
  const total = events.length;
  const critical = events.filter(e => e.severity === "critical").length;
  const high = events.filter(e => e.severity === "high").length;
  const resolved = events.filter(e => e.status === "RESOLVED").length;
  const dispatched = events.filter(e => e.assigned_officer).length;
  const avgScore = total > 0 ? Math.round(events.reduce((s, e) => s + (parseInt(String(e.severity_color === "#FF0000" ? "80" : e.severity_color === "#FFA500" ? "50" : "25")), 0), 0) / total) : 0;

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

function OfficersView({ events }: { events: PulseEvent[] }) {
  // Collect unique officers from dispatched events
  const officerMap = new Map<string, { officer_id: string; lat: number; lng: number; assignments: number; domains: Set<string> }>();
  events.forEach(e => {
    if (e.assigned_officer) {
      const existing = officerMap.get(e.assigned_officer.officer_id);
      if (existing) {
        existing.assignments++;
        existing.domains.add(e.domain);
        existing.lat = e.assigned_officer.current_lat;
        existing.lng = e.assigned_officer.current_lng;
      } else {
        officerMap.set(e.assigned_officer.officer_id, {
          officer_id: e.assigned_officer.officer_id,
          lat: e.assigned_officer.current_lat,
          lng: e.assigned_officer.current_lng,
          assignments: 1,
          domains: new Set([e.domain]),
        });
      }
    }
  });
  const officers = Array.from(officerMap.values()).sort((a, b) => b.assignments - a.assignments);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg" style={{ color: "var(--fg-primary)" }}>⊕</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>Field Officers</h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>{officers.length} active</span>
      </div>

      {officers.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
          <p className="text-[12px] font-mono" style={{ color: "var(--fg-muted)" }}>No officers dispatched yet. Trigger an event to see officer data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {officers.map(off => (
            <div key={off.officer_id} className="flex items-center gap-4 p-3 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
                {off.officer_id.slice(-3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "var(--fg-primary)" }}>{off.officer_id}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                  ({off.lat.toFixed(4)}, {off.lng.toFixed(4)}) · {Array.from(off.domains).join(", ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--accent-blue)" }}>{off.assignments}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>tasks</p>
              </div>
              <span className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono shrink-0"
                style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)" }} />
                Active
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ status, events, logs, intake }: { status: string; events: PulseEvent[]; logs: SwarmLogEntry[]; intake: IntakeFeedItem[] }) {
  const configItems = [
    { label: "Backend", value: "localhost:8000", ok: true },
    { label: "WebSocket", value: status === "connected" ? "Connected" : status, ok: status === "connected" },
    { label: "LLM Provider", value: "OpenRouter (Nemotron 120B)", ok: true },
    { label: "Vector DB", value: "Pinecone (civix-pulse-events)", ok: true },
    { label: "PostgreSQL", value: "Not configured", ok: false },
    { label: "LangSmith", value: "Tracing enabled", ok: true },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg" style={{ color: "var(--fg-primary)" }}>⚙</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>System Settings</h2>
      </div>

      {/* Connection status */}
      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>Service Status</h3>
        <div className="space-y-2">
          {configItems.map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: "var(--border-light)" }}>
              <span className="text-[12px] font-medium" style={{ color: "var(--fg-secondary)" }}>{item.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono" style={{ color: item.ok ? "var(--accent-green)" : "var(--accent-amber)" }}>{item.value}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: item.ok ? "var(--accent-green)" : "var(--accent-amber)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session stats */}
      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>Session Data</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xl font-semibold tabular-nums" style={{ color: "var(--accent-blue)" }}>{events.length}</p>
            <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>Events</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold tabular-nums" style={{ color: "var(--accent-amber)" }}>{logs.length}</p>
            <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>Logs</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold tabular-nums" style={{ color: "var(--fg-secondary)" }}>{intake.length}</p>
            <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>Intake</p>
          </div>
        </div>
      </div>

      {/* Architecture info */}
      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>Architecture</h3>
        <div className="space-y-1.5 text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
          <p>Pipeline: Systemic Auditor → Priority Agent → Dispatch Agent</p>
          <p>Graph Engine: LangGraph (cyclic state machine)</p>
          <p>Model: nvidia/nemotron-3-super-120b-a12b:free via OpenRouter</p>
          <p>Vector Search: Pinecone (1536 dims, cosine, serverless)</p>
          <p>Tracing: LangSmith (civix-pulse project)</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
      <p className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );
}
