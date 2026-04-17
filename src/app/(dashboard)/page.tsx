"use client";

import { useEffect, useRef, useState } from "react";
import { MapLayer } from "@/components/MapLayer";
import { IngestionFeed } from "@/components/IngestionFeed";
import { SwarmLog } from "@/components/SwarmLog";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";
import { generatePulseEvent, generateSwarmLog, generateIntakeItem } from "@/lib/mock-data";

const MAX_ITEMS = 50;

export default function DashboardPage() {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [logs, setLogs] = useState<SwarmLogEntry[]>([]);
  const [intake, setIntake] = useState<IntakeFeedItem[]>([]);
  const [stats, setStats] = useState({ active: 0, critical: 0, resolved: 0, avgTime: "—" });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Seed a few events
    const seed = Array.from({ length: 6 }, () => generatePulseEvent());
    const seedLogs = seed.flatMap(e => [generateSwarmLog(e), generateSwarmLog(e)]);
    const seedIntake = Array.from({ length: 4 }, () => generateIntakeItem());
    setEvents(seed);
    setLogs(seedLogs);
    setIntake(seedIntake);

    // Simulate live stream
    intervalRef.current = setInterval(() => {
      const roll = Math.random();

      if (roll < 0.4) {
        // New pulse event
        const evt = generatePulseEvent();
        setEvents(prev => [evt, ...prev].slice(0, MAX_ITEMS));
        setLogs(prev => [generateSwarmLog(evt), ...prev].slice(0, MAX_ITEMS));
      } else if (roll < 0.7) {
        // New intake
        setIntake(prev => [generateIntakeItem(), ...prev].slice(0, MAX_ITEMS));
      } else {
        // Swarm chatter
        setLogs(prev => [generateSwarmLog(), ...prev].slice(0, MAX_ITEMS));
      }

      // Resolve a random event sometimes
      if (Math.random() < 0.1) {
        setEvents(prev => {
          const copy = [...prev];
          const unresolvedIdx = copy.findIndex(e => e.status !== "RESOLVED");
          if (unresolvedIdx >= 0) {
            copy[unresolvedIdx] = { ...copy[unresolvedIdx], status: "RESOLVED" };
            setLogs(p => [{
              id: `res-${Date.now().toString(36)}`,
              type: "verification" as const,
              message: `Task closed. ${copy[unresolvedIdx].summary} — resolved.`,
              timestamp: Date.now(),
              event_id: copy[unresolvedIdx].event_id,
            }, ...p].slice(0, MAX_ITEMS));
          }
          return copy;
        });
      }
    }, 2500);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Compute stats
  useEffect(() => {
    const active = events.filter(e => e.status !== "RESOLVED").length;
    const critical = events.filter(e => e.severity === "critical" && e.status !== "RESOLVED").length;
    const resolved = events.filter(e => e.status === "RESOLVED").length;
    setStats({ active, critical, resolved, avgTime: active > 0 ? "~12m" : "—" });
  }, [events]);

  return (
    <div className="flex h-full">
      {/* Left: Ingestion Feed */}
      <div className="w-72 shrink-0 border-r flex flex-col"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <IngestionFeed items={intake} />
      </div>

      {/* Center: Map + Stats */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Stats bar */}
        <div className="flex items-center gap-6 px-4 py-2 border-b"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <StatPill label="Active" value={stats.active} color="var(--accent-blue)" />
          <StatPill label="Critical" value={stats.critical} color="var(--accent-crimson)" />
          <StatPill label="Resolved" value={stats.resolved} color="var(--accent-green)" />
          <StatPill label="Avg Response" value={stats.avgTime} color="var(--fg-secondary)" />
          <div className="ml-auto flex items-center gap-2">
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

        {/* Map */}
        <div className="flex-1 p-2">
          <MapLayer events={events.filter(e => e.status !== "RESOLVED")} />
        </div>
      </div>

      {/* Right: Swarm Log */}
      <div className="w-72 shrink-0 border-l flex flex-col"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
        <SwarmLog entries={logs} />
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] font-mono uppercase" style={{ color: "var(--fg-muted)" }}>{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}
