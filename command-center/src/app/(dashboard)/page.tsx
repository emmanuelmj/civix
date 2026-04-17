"use client";

import { useEffect, useState } from "react";
import { MapLayer } from "@/components/MapLayer";
import { IngestionFeed } from "@/components/IngestionFeed";
import { SwarmLog } from "@/components/SwarmLog";
import { GrievanceDetail } from "@/components/GrievanceDetail";
import { AnalyticsView } from "@/components/AnalyticsView";
import { FilterBar } from "@/components/FilterBar";
import { AgentTrace } from "@/components/AgentTrace";
import { IntakeFeedView } from "@/components/IntakeFeedView";
import { AgentCanvasView } from "@/components/AgentCanvasView";
import { ExecutiveReportsView } from "@/components/ExecutiveReportsView";
import { OfficersView } from "@/components/OfficersView";
import { usePulseStream, triggerAnalysis, triggerSingleDemo, fetchPineconeStatus, triggerRescan } from "@/lib/socket";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem, PineconeStatus } from "@/lib/types";
import { useDashboard } from "@/lib/dashboard-context";

export default function DashboardPage() {
  const { events, logs, intake, officers, status } = usePulseStream();
  const { activeTab } = useDashboard();
  const [stats, setStats] = useState({ active: 0, critical: 0, resolved: 0, avgTime: "—" });
  const [mobileTab, setMobileTab] = useState<"map" | "intake" | "swarm">("map");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<PulseEvent | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<PulseEvent[]>([]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg("");
    const result = await triggerAnalysis();
    setTriggerMsg(result.message);
    setTriggering(false);
    setTimeout(() => setTriggerMsg(""), 4000);
  };

  const handleDemoTrigger = async () => {
    setTriggering(true);
    setTriggerMsg("");
    const result = await triggerSingleDemo();
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
  const displayEvents = filteredEvents.length > 0 || events.length === 0 ? filteredEvents : activeEvents;

  // Sidebar tab views
  if (activeTab === "Intake Feed") {
    return <IntakeFeedView items={intake} />;
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
    return <OfficersView events={events} officers={officers} />;
  }

  if (activeTab === "Settings") {
    return <SettingsView status={status} events={events} logs={logs} intake={intake} />;
  }

  // Default: "Live Grid" — the main 3-panel dashboard
  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 relative">
      {/* Mobile tab bar */}
      <div className="flex lg:hidden border-b shrink-0 glass">
        {(["map", "intake", "swarm"] as const).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            className="flex-1 py-2.5 text-[10px] font-bold font-mono uppercase tracking-[0.15em] text-center transition-all duration-300 border-b-2"
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
      <div className="flex lg:hidden items-center gap-3 px-3 py-1.5 border-b overflow-x-auto shrink-0 glass">
        <StatPill label="Active" value={stats.active} color="var(--accent-blue)" />
        <StatPill label="Crit" value={stats.critical} color="var(--accent-crimson)" />
        <StatPill label="Done" value={stats.resolved} color="var(--accent-green)" />
      </div>

      {/* Left: Ingestion Feed — paper sidebar */}
      <div className="hidden lg:flex w-1/4 max-w-sm min-w-[260px] shrink-0 border-r flex-col overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <IngestionFeed items={intake} />
      </div>

      {/* Center: Map + Stats — desktop */}
      <div className="hidden lg:flex flex-[2] flex-col min-w-0 min-h-0 h-full overflow-hidden">
        {/* Stats bar — frosted glass over map */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b shrink-0 glass">
          {/* Stats group — always visible */}
          <div className="flex items-center gap-5 shrink-0">
            <StatPill label="Active" value={stats.active} color="var(--accent-blue)" />
            <StatPill label="Critical" value={stats.critical} color="var(--accent-crimson)" />
            <StatPill label="Resolved" value={stats.resolved} color="var(--accent-green)" />
            <StatPill label="Avg Resp" value={stats.avgTime} color="var(--fg-secondary)" />
          </div>
          {/* Spacer */}
          <div className="flex-1 min-w-0" />
          {/* Actions group */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDemoTrigger}
              disabled={triggering}
              className="px-3 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-[0.1em] transition-all duration-300 disabled:opacity-50 hover:scale-[1.03]"
              style={{
                background: triggering ? "var(--bg-surface)" : "var(--accent-green)",
                color: triggering ? "var(--fg-muted)" : "#fff",
                boxShadow: triggering ? "none" : "0 0 12px rgba(34,197,94,0.3)",
              }}
            >
              {triggering ? "⏳…" : "🎯 Demo"}
            </button>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-[0.1em] transition-all duration-300 disabled:opacity-50 hover:scale-[1.03]"
              style={{
                background: triggering ? "var(--bg-surface)" : "var(--accent-blue)",
                color: triggering ? "var(--fg-muted)" : "#fff",
                boxShadow: triggering ? "none" : "0 0 15px rgba(0,122,255,0.3)",
              }}
            >
              {triggering ? "⏳ Processing…" : "⚡ Trigger Swarm"}
            </button>
            {triggerMsg && (
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg animate-pulse"
                style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>
                {triggerMsg}
              </span>
            )}
            <span className="text-xs font-mono px-2 py-1 rounded-lg"
              style={{
                background: status === "connected" ? "var(--accent-green-dim)" : status === "disconnected" ? "var(--accent-crimson-dim)" : "var(--accent-amber-dim)",
                color: status === "connected" ? "var(--accent-green)" : status === "disconnected" ? "var(--accent-crimson)" : "var(--accent-amber)",
              }}>
              {status === "connected" ? "● LIVE" : status === "connecting" ? "◌ CONNECTING" : status === "disconnected" ? "✕ OFFLINE" : "↻ RECONNECTING"}
            </span>
          </div>
        </div>
        {/* Smart Filter Bar */}
        <div className="shrink-0 border-b glass">
          <FilterBar events={activeEvents} onFilterChange={setFilteredEvents} />
        </div>
        {/* Map — fluid fill */}
        <div className="flex-1 min-h-0 relative">
          <MapLayer events={displayEvents} officers={officers} onViewDetails={setSelectedEvent} />
        </div>
      </div>

      {/* Right: Swarm Log — paper sidebar */}
      <div className="hidden lg:flex w-1/4 max-w-sm min-w-[260px] shrink-0 border-l flex-col overflow-hidden"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
        <SwarmLog entries={logs} />
      </div>

      {/* Mobile content — full height, one panel at a time */}
      <div className="flex-1 lg:hidden overflow-hidden min-h-0 min-w-0">
        {mobileTab === "map" && (
          <div className="h-full w-full relative">
            <MapLayer events={displayEvents} officers={officers} onViewDetails={setSelectedEvent} />
          </div>
        )}
        {mobileTab === "intake" && (
          <div className="h-full glass">
            <IngestionFeed items={intake} />
          </div>
        )}
        {mobileTab === "swarm" && (
          <div className="h-full glass">
            <SwarmLog entries={logs} />
          </div>
        )}
      </div>

      {/* Grievance Detail Slide-out Panel */}
      {selectedEvent && (
        <GrievanceDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-[10px] font-semibold font-mono uppercase tracking-[0.15em]" style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="text-lg font-medium tracking-tight tabular-nums" style={{ color: "var(--fg-primary)" }}>{value}</span>
    </div>
  );
}

function SettingsView({ status, events, logs, intake }: { status: string; events: PulseEvent[]; logs: SwarmLogEntry[]; intake: IntakeFeedItem[] }) {
  const [pcStatus, setPcStatus] = useState<PineconeStatus | null>(null);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    fetchPineconeStatus().then(setPcStatus);
    const interval = setInterval(() => fetchPineconeStatus().then(setPcStatus), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRescan = async () => {
    setRescanning(true);
    await triggerRescan();
    setRescanning(false);
    setTimeout(() => fetchPineconeStatus().then(setPcStatus), 2000);
  };

  const configItems = [
    { label: "Backend API", value: "localhost:8000", ok: true },
    { label: "WebSocket", value: status === "connected" ? "Connected" : status, ok: status === "connected" },
    { label: "LLM Provider", value: "GitHub Models (GPT-4.1)", ok: true },
    { label: "Pinecone", value: pcStatus?.pinecone?.connected ? `Connected (${pcStatus.pinecone.total_vectors} vectors)` : "Disconnected", ok: !!pcStatus?.pinecone?.connected },
    { label: "Watcher", value: pcStatus?.watcher?.running ? `Polling every ${pcStatus.watcher.poll_interval_seconds}s` : "Not running", ok: !!pcStatus?.watcher?.running },
    { label: "LangSmith", value: "Tracing enabled", ok: true },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg" style={{ color: "var(--fg-primary)" }}>⚙</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>System Settings</h2>
      </div>

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

      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Pinecone Vector DB</h3>
          <button onClick={handleRescan} disabled={rescanning}
            className="text-[10px] font-mono px-2 py-1 rounded transition-all disabled:opacity-50"
            style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
            {rescanning ? "⏳ Scanning…" : "↻ Force Rescan"}
          </button>
        </div>
        <div className="space-y-1.5 text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
          <p>Index: {pcStatus?.pinecone?.index_name || "civix-pulse"}</p>
          <p>Vectors: {pcStatus?.pinecone?.total_vectors ?? "—"}</p>
          <p>Dimension: {pcStatus?.pinecone?.dimension ?? "—"}</p>
          <p>Processed by watcher: {pcStatus?.watcher?.processed_count ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
        <h3 className="text-[11px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--fg-muted)" }}>Architecture</h3>
        <div className="space-y-1.5 text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
          <p>Pipeline: Auditor → Priority → Cluster Amplifier → Dispatch</p>
          <p>Graph Engine: LangGraph (4-node StateGraph)</p>
          <p>Model: openai/gpt-4.1 via GitHub Models API</p>
          <p>Vector Search: Pinecone (cosine similarity, serverless)</p>
          <p>Tracing: LangSmith (civix-pulse project)</p>
          <p>Webhook: POST /api/v1/webhook/new-event</p>
        </div>
      </div>
    </div>
  );
}
