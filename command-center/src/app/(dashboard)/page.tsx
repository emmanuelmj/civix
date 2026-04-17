"use client";

import { useEffect, useState } from "react";
import { MapLayer } from "@/components/MapLayer";
import { IngestionFeed } from "@/components/IngestionFeed";
import { SwarmLog } from "@/components/SwarmLog";
import { usePulseStream, triggerAnalysis } from "@/lib/socket";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";
import { useDashboard } from "@/lib/dashboard-context";

export default function DashboardPage() {
  const { events, logs, intake, status } = usePulseStream();
  const { activeTab } = useDashboard();
  const [stats, setStats] = useState({ active: 0, critical: 0, resolved: 0, avgTime: "—" });
  const [mobileTab, setMobileTab] = useState<"map" | "intake" | "swarm">("map");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState("");

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg("");
    const result = await triggerAnalysis();
    setTriggerMsg(result.message);
    setTriggering(false);
    setTimeout(() => setTriggerMsg(""), 4000);
  };

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

  if (activeTab === "Agent Canvas") {
    return <AgentCanvasView events={events} logs={logs} status={status} />;
  }

  if (activeTab === "Reports") {
    return <ExecutiveReportsView events={events} logs={logs} intake={intake} />;
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
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="ml-2 px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-all disabled:opacity-50"
            style={{
              background: triggering ? "var(--bg-elevated)" : "var(--accent-blue)",
              color: triggering ? "var(--fg-muted)" : "#fff",
            }}
          >
            {triggering ? "⏳ Processing…" : "⚡ Trigger Analysis"}
          </button>
          {triggerMsg && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded animate-pulse"
              style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>
              {triggerMsg}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: status === "connected" ? "var(--accent-green-dim)" : "var(--accent-amber-dim)",
                color: status === "connected" ? "var(--accent-green)" : "var(--accent-amber)",
              }}>
              {status === "connected" ? "● LIVE" : status === "connecting" ? "◌ CONNECTING" : "◉ DEMO"}
            </span>
            {(["Municipal", "Water", "Electricity", "Traffic", "Construction", "Emergency"] as const).map(d => {
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

// ---------------------------------------------------------------------------
// Agent Orchestration Canvas — live pipeline visualization
// ---------------------------------------------------------------------------

interface AgentNode {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  status: "idle" | "active" | "done";
  color: string;
  metric?: string;
}

function AgentCanvasView({ events, logs, status }: { events: PulseEvent[]; logs: SwarmLogEntry[]; status: string }) {
  const analysisLogs = logs.filter(l => l.type === "analysis");
  const dispatchLogs = logs.filter(l => l.type === "dispatch");
  const verifyLogs = logs.filter(l => l.type === "verification");
  const systemLogs = logs.filter(l => l.type === "system");
  const lastLog = logs[0];

  const nodes: AgentNode[] = [
    {
      id: "ingestion",
      label: "Multimodal Ingestion",
      sublabel: "OCR · Speech-to-Text · NLP",
      icon: "◉",
      status: events.length > 0 ? "done" : "idle",
      color: "var(--accent-green)",
      metric: `${events.length} processed`,
    },
    {
      id: "auditor",
      label: "Systemic Auditor",
      sublabel: "Pinecone Cluster Analysis",
      icon: "⧉",
      status: analysisLogs.length > 0 ? "done" : "idle",
      color: "var(--accent-amber)",
      metric: `${events.filter(e => e.log_message?.includes("Cluster")).length} clusters`,
    },
    {
      id: "priority",
      label: "Priority Logic Agent",
      sublabel: "LLM Impact Matrix (Nemotron 120B)",
      icon: "◔",
      status: analysisLogs.length > 0 ? "done" : "idle",
      color: "var(--accent-crimson)",
      metric: `${events.filter(e => e.severity === "critical").length} critical`,
    },
    {
      id: "dispatch",
      label: "Dispatch Agent",
      sublabel: "Spatial Officer Matching",
      icon: "⊕",
      status: dispatchLogs.length > 0 ? "done" : "idle",
      color: "var(--accent-blue)",
      metric: `${events.filter(e => e.assigned_officer).length} dispatched`,
    },
    {
      id: "verify",
      label: "Verification Agent",
      sublabel: "Photo AI · Citizen Feedback",
      icon: "✓",
      status: verifyLogs.length > 0 ? "done" : "idle",
      color: "var(--accent-green)",
      metric: `${events.filter(e => e.status === "RESOLVED").length} verified`,
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg" style={{ color: "var(--fg-primary)" }}>⬡</span>
          <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>Agent Orchestration Canvas</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{
            background: status === "connected" ? "var(--accent-green-dim)" : "var(--accent-amber-dim)",
            color: status === "connected" ? "var(--accent-green)" : "var(--accent-amber)",
          }}>
            {status === "connected" ? "● LIVE" : "◉ DEMO"}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
          LangGraph · {events.length} events processed
        </span>
      </div>

      {/* Pipeline Flow */}
      <div className="rounded-lg border p-5" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-5" style={{ color: "var(--fg-muted)" }}>
          Pipeline Flow — Sequential Graph
        </h3>
        <div className="flex flex-col lg:flex-row items-stretch gap-0">
          {nodes.map((node, i) => (
            <div key={node.id} className="flex flex-col lg:flex-row items-center flex-1">
              {/* Node */}
              <div className="w-full lg:flex-1 rounded-lg border p-4 transition-all"
                style={{
                  borderColor: node.status === "done" ? node.color : "var(--border-light)",
                  background: node.status === "done" ? `${node.color}08` : "var(--bg-elevated)",
                }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base" style={{ color: node.color }}>{node.icon}</span>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--fg-primary)" }}>{node.label}</span>
                  <span className="ml-auto w-2 h-2 rounded-full" style={{
                    background: node.status === "done" ? node.color : "var(--border)",
                    boxShadow: node.status === "done" ? `0 0 6px ${node.color}` : "none",
                  }} />
                </div>
                <p className="text-[10px] font-mono mb-2" style={{ color: "var(--fg-muted)" }}>{node.sublabel}</p>
                <p className="text-[11px] font-mono font-semibold" style={{ color: node.color }}>{node.metric}</p>
              </div>
              {/* Arrow */}
              {i < nodes.length - 1 && (
                <>
                  <div className="hidden lg:flex items-center px-1">
                    <div className="w-6 h-px" style={{ background: node.status === "done" ? node.color : "var(--border)" }} />
                    <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent"
                      style={{ borderLeftColor: node.status === "done" ? node.color : "var(--border)" }} />
                  </div>
                  <div className="flex lg:hidden items-center justify-center py-1">
                    <div className="h-4 w-px" style={{ background: node.status === "done" ? node.color : "var(--border)" }} />
                    <div className="absolute w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent mt-5"
                      style={{ borderTopColor: node.status === "done" ? node.color : "var(--border)" }} />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent agent actions */}
        <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
          <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>
            Recent Agent Actions
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {logs.slice(0, 15).map(log => {
              const typeColor: Record<string, string> = {
                analysis: "var(--accent-amber)",
                dispatch: "var(--accent-blue)",
                verification: "var(--accent-green)",
                system: "var(--fg-muted)",
                escalation: "var(--accent-crimson)",
              };
              return (
                <div key={log.id} className="flex items-start gap-2 py-1.5">
                  <span className="text-[9px] font-mono font-bold px-1 py-px rounded mt-0.5 shrink-0"
                    style={{ background: `${typeColor[log.type] || "var(--fg-muted)"}18`, color: typeColor[log.type] || "var(--fg-muted)" }}>
                    {log.type.slice(0, 4).toUpperCase()}
                  </span>
                  <span className="text-[11px] font-mono leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                    {log.message}
                  </span>
                </div>
              );
            })}
            {logs.length === 0 && (
              <p className="text-[11px] font-mono py-4 text-center" style={{ color: "var(--fg-muted)" }}>
                No agent activity yet. Trigger an event to see the swarm in action.
              </p>
            )}
          </div>
        </div>

        {/* Agent health */}
        <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
          <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>
            Agent Health Matrix
          </h3>
          <div className="space-y-3">
            {[
              { name: "Systemic Auditor", desc: "Pinecone vector similarity", logs: analysisLogs.length, color: "var(--accent-amber)" },
              { name: "Priority Agent", desc: "OpenRouter LLM scoring", logs: analysisLogs.length, color: "var(--accent-crimson)" },
              { name: "Dispatch Agent", desc: "Spatial officer matching", logs: dispatchLogs.length, color: "var(--accent-blue)" },
              { name: "Verification Agent", desc: "Photo + feedback loop", logs: verifyLogs.length, color: "var(--accent-green)" },
            ].map(agent => (
              <div key={agent.name} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{
                  background: agent.logs > 0 ? agent.color : "var(--border)",
                  boxShadow: agent.logs > 0 ? `0 0 6px ${agent.color}` : "none",
                }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium" style={{ color: "var(--fg-primary)" }}>{agent.name}</p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>{agent.desc}</p>
                </div>
                <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: agent.color }}>
                  {agent.logs} ops
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Executive Reports — per-department breakdown
// ---------------------------------------------------------------------------

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

function ExecutiveReportsView({ events, logs, intake }: { events: PulseEvent[]; logs: SwarmLogEntry[]; intake: IntakeFeedItem[] }) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const now = new Date();

  // Group events by domain (matching both upper and title case)
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
      {/* Header */}
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

        {/* Department bars */}
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

      {/* Department detail report (when selected) */}
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

      {/* All department cards (when none selected) */}
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

function DepartmentReport({ dept, label, color, events: deptEvents, logs: deptLogs }: {
  dept: string;
  label: string;
  color: string;
  events: PulseEvent[];
  logs: SwarmLogEntry[];
}) {
  const critical = deptEvents.filter(e => e.severity === "critical");
  const resolved = deptEvents.filter(e => e.status === "RESOLVED");
  const pending = deptEvents.filter(e => e.status !== "RESOLVED");
  const resRate = deptEvents.length > 0 ? Math.round((resolved.length / deptEvents.length) * 100) : 0;

  return (
    <div className="rounded-lg border p-5 space-y-4" style={{ background: "var(--bg-card)", borderColor: color }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg-primary)" }}>{label}</h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: `${color}18`, color }}>
          {deptEvents.length} grievances
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total" value={deptEvents.length} color={color} />
        <KpiCard label="Critical" value={critical.length} color="var(--accent-crimson)" />
        <KpiCard label="Pending" value={pending.length} color="var(--accent-amber)" />
        <KpiCard label="Resolution Rate" value={`${resRate}%`} color="var(--accent-green)" />
      </div>

      {/* Event list */}
      <div>
        <h4 className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>
          Grievance Log
        </h4>
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

      {/* Agent activity for this department */}
      {deptLogs.length > 0 && (
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--fg-muted)" }}>
            Agent Activity
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {deptLogs.slice(0, 8).map(log => (
              <p key={log.id} className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                {log.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
