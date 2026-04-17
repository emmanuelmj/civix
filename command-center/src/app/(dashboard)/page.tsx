"use client";

import { useEffect, useState } from "react";
import { MapLayer } from "@/components/MapLayer";
import { IngestionFeed } from "@/components/IngestionFeed";
import { SwarmLog } from "@/components/SwarmLog";
import { usePulseStream } from "@/lib/socket";
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
    return <PlaceholderView title="Analytics" icon="◔" description="Real-time governance analytics, cluster heatmaps, and SLA tracking." />;
  }

  if (activeTab === "Officers") {
    return <PlaceholderView title="Officers" icon="⊕" description="Field officer management, GPS tracking, and dispatch history." />;
  }

  if (activeTab === "Settings") {
    return <PlaceholderView title="Settings" icon="⚙" description="System configuration, agent tuning, and API key management." />;
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

function PlaceholderView({ title, icon, description }: { title: string; icon: string; description: string }) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: "var(--bg-elevated)", color: "var(--fg-muted)" }}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--fg-primary)" }}>{title}</h2>
        <p className="text-sm font-mono" style={{ color: "var(--fg-muted)" }}>{description}</p>
        <span className="inline-block mt-4 text-[10px] font-mono px-3 py-1 rounded-full"
          style={{ background: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}>
          Coming Soon
        </span>
      </div>
    </div>
  );
}
