"use client";

import { useEffect, useState, useCallback } from "react";
import { MapLayer } from "@/components/MapLayer";
import { IngestionFeed } from "@/components/IngestionFeed";
import { SwarmLog } from "@/components/SwarmLog";
import { GrievanceDetail } from "@/components/GrievanceDetail";
import { FilterBar } from "@/components/FilterBar";
import { triggerAnalysis, triggerSingleDemo, fetchAnalyticsKpis } from "@/lib/socket";
import type { PulseEvent } from "@/lib/types";
import { usePulse } from "@/lib/pulse-context";

export default function DashboardPage() {
  const { events, logs, intake, officers, status } = usePulse();
  const [stats, setStats] = useState({ active: 0, critical: 0, resolved: 0, avgTime: "—" });
  const [mobileTab, setMobileTab] = useState<"map" | "intake" | "swarm">("map");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<PulseEvent | null>(null);
  const [filteredEvents, setFilteredEvents] = useState<PulseEvent[] | null>(null);

  const handleFilterChange = useCallback((filtered: PulseEvent[]) => {
    setFilteredEvents(filtered);
  }, []);

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
    setStats(prev => ({ ...prev, active, critical, resolved }));
  }, [events]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const k = await fetchAnalyticsKpis();
      if (!alive) return;
      setStats(prev => ({
        ...prev,
        avgTime: k?.avg_resolution_minutes != null ? `~${k.avg_resolution_minutes}m` : "—",
      }));
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const activeEvents = events.filter(e => e.status !== "RESOLVED");
  // null = FilterBar hasn't initialized yet → show all; otherwise respect filter results (even if empty)
  const displayEvents = filteredEvents ?? activeEvents;

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
          <FilterBar events={activeEvents} onFilterChange={handleFilterChange} />
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
