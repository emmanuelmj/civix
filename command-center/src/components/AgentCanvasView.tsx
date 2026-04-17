"use client";

import { useMemo } from "react";
import type { PulseEvent, SwarmLogEntry } from "@/lib/types";

/* ─── Pipeline node definitions ─── */

interface PipelineNode {
  id: string;
  icon: string;
  label: string;
  color: string;
  x: number;
  y: number;
}

const NODES: PipelineNode[] = [
  { id: "ingestion",  icon: "◉", label: "Multimodal Ingestion", color: "#22C55E", x: 80,  y: 100 },
  { id: "auditor",    icon: "⧉", label: "Systemic Auditor",     color: "#F59E0B", x: 300, y: 50  },
  { id: "priority",   icon: "◔", label: "Priority Logic Agent", color: "#EF4444", x: 520, y: 100 },
  { id: "amplifier",  icon: "⇧", label: "Cluster Amplifier",    color: "#a855f7", x: 740, y: 50  },
  { id: "dispatch",   icon: "⊕", label: "Dispatch Agent",       color: "#007AFF", x: 960, y: 100 },
];

const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
];

/* ─── Helpers ─── */

const LABEL_CLS = "text-[10px] font-semibold font-mono uppercase tracking-[0.2em]";

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const LOG_TYPE_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  analysis:     { label: "ANALYSIS",     bg: "#fef3dc", fg: "#b45309" },
  dispatch:     { label: "DISPATCH",     bg: "#dbeafe", fg: "#1d4ed8" },
  verification: { label: "VERIFY",       bg: "#dcf5e7", fg: "#15803d" },
  escalation:   { label: "ESCALATION",   bg: "#fde8e6", fg: "#dc2626" },
  system:       { label: "SYSTEM",       bg: "var(--bg-surface)", fg: "var(--fg-secondary)" },
};

/* ─── Component ─── */

export function AgentCanvasView({
  events,
  logs,
  status,
}: {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  status: string;
}) {
  /* ── Derived stats ── */
  const stats = useMemo(() => {
    const clusterCount = events.filter((e) => e.cluster_found).length;
    const criticalCount = events.filter((e) => e.severity === "critical").length;
    const boostedCount = events.filter((e) => e.cluster_found && (e.cluster_size ?? 0) > 1).length;
    const dispatchedCount = events.filter(
      (e) => e.status === "DISPATCHED" || e.status === "IN_PROGRESS" || e.status === "RESOLVED",
    ).length;
    return { clusterCount, criticalCount, boostedCount, dispatchedCount };
  }, [events]);

  const agentActivity = useMemo(() => {
    const counts: Record<string, number> = {
      analysis: 0,
      dispatch: 0,
      verification: 0,
      escalation: 0,
      system: 0,
    };
    logs.forEach((l) => {
      counts[l.type] = (counts[l.type] || 0) + 1;
    });
    return counts;
  }, [logs]);

  const isActive = status === "connected" || events.length > 0;
  const recentLogs = useMemo(() => [...logs].reverse().slice(0, 15), [logs]);

  /* ── Node stat labels ── */
  function nodeStats(id: string): [string, string] {
    switch (id) {
      case "ingestion":
        return [`Events: ${events.length}`, "Latency: ~18ms"];
      case "auditor":
        return [`Clusters: ${stats.clusterCount}`, "Similarity: cosine"];
      case "priority":
        return [`Critical: ${stats.criticalCount}`, "Model: GPT-4.1"];
      case "amplifier":
        return [`Boosted: ${stats.boostedCount}`, "+15 score"];
      case "dispatch":
        return [`Dispatched: ${stats.dispatchedCount}`, "Algorithm: Haversine"];
      default:
        return ["—", "—"];
    }
  }

  /* ── SVG edge path builder ── */
  const NODE_W = 170;
  const NODE_H = 90;

  function edgePath(from: PipelineNode, to: PipelineNode): string {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const cx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  /* ── Agent health data ── */
  const agents = [
    { name: "Systemic Auditor",     icon: "⧉", color: "#F59E0B", ops: agentActivity.analysis,     logType: "analysis" as const },
    { name: "Priority Logic Agent", icon: "◔", color: "#EF4444", ops: agentActivity.escalation + agentActivity.analysis, logType: "escalation" as const },
    { name: "Dispatch Agent",       icon: "⊕", color: "#007AFF", ops: agentActivity.dispatch,      logType: "dispatch" as const },
    { name: "Verification Agent",   icon: "✓", color: "#22C55E", ops: agentActivity.verification,  logType: "verification" as const },
  ];

  return (
    <>
      {/* Inline keyframes for data-packet animation */}
      <style jsx>{`
        @keyframes packet-flow {
          0%   { offset-distance: 0%; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 4px 1px currentColor; }
          50%      { box-shadow: 0 0 12px 4px currentColor; }
        }
        @keyframes idle-breathe {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 0.8; }
        }
      `}</style>

      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--fg-primary)" }}
            >
              Agent Orchestration Canvas
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--fg-muted)" }}
            >
              LangGraph pipeline — real-time node graph
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: isActive ? "#22C55E" : "var(--fg-muted)",
                boxShadow: isActive ? "0 0 6px #22C55E" : "none",
              }}
            />
            <span
              className={LABEL_CLS}
              style={{ color: isActive ? "#22C55E" : "var(--fg-muted)" }}
            >
              {isActive ? "Pipeline Active" : "Idle"}
            </span>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div
          className="rounded-xl border overflow-x-auto"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-light)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="relative" style={{ minWidth: 1200, height: 260, padding: "20px 30px" }}>
            {/* SVG connectors + animated packets */}
            <svg
              className="absolute inset-0"
              width="100%"
              height="100%"
              style={{ pointerEvents: "none" }}
            >
              <defs>
                {EDGES.map(([fi, ti], idx) => {
                  const d = edgePath(NODES[fi], NODES[ti]);
                  return (
                    <path
                      key={`path-def-${idx}`}
                      id={`edge-path-${idx}`}
                      d={d}
                      fill="none"
                    />
                  );
                })}
              </defs>

              {/* Connector lines */}
              {EDGES.map(([fi, ti], idx) => {
                const d = edgePath(NODES[fi], NODES[ti]);
                return (
                  <path
                    key={`edge-${idx}`}
                    d={d}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={2}
                    strokeDasharray={isActive ? "none" : "6 4"}
                  />
                );
              })}

              {/* Animated data packets */}
              {isActive &&
                EDGES.map(([fi, ti], idx) => {
                  const fromNode = NODES[fi];
                  const toNode = NODES[ti];
                  const packetColor = toNode.color;
                  const d = edgePath(fromNode, toNode);
                  return [0, 1, 2].map((pIdx) => (
                    <circle
                      key={`packet-${idx}-${pIdx}`}
                      r={4}
                      fill={packetColor}
                      opacity={0}
                      style={{
                        offsetPath: `path("${d}")`,
                        animation: `packet-flow 2.4s ${pIdx * 0.8}s linear infinite`,
                      }}
                    />
                  ));
                })}
            </svg>

            {/* Pipeline nodes */}
            {NODES.map((node) => {
              const [stat1, stat2] = nodeStats(node.id);
              const nodeIsActive =
                isActive &&
                (node.id === "ingestion"
                  ? events.length > 0
                  : node.id === "auditor"
                    ? stats.clusterCount > 0
                    : node.id === "priority"
                      ? stats.criticalCount > 0
                      : node.id === "amplifier"
                        ? stats.boostedCount > 0
                        : stats.dispatchedCount > 0);

              return (
                <div
                  key={node.id}
                  className="absolute flex flex-col items-center"
                  style={{ left: node.x + 30, top: node.y + 20 }}
                >
                  {/* Node card */}
                  <div
                    className={`rounded-xl border px-5 py-3 text-center transition-shadow ${nodeIsActive ? "animate-pulse" : ""}`}
                    style={{
                      width: NODE_W,
                      background: "var(--bg-elevated)",
                      borderColor: nodeIsActive ? node.color : "var(--border-light)",
                      boxShadow: nodeIsActive
                        ? `0 0 16px ${node.color}33`
                        : "var(--shadow-card)",
                    }}
                  >
                    <span
                      className="text-2xl leading-none block"
                      style={{ color: node.color }}
                    >
                      {node.icon}
                    </span>
                    <span
                      className="text-[11px] font-semibold block mt-1.5 leading-tight"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {node.label}
                    </span>
                  </div>

                  {/* Stats badges */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                      style={{
                        background: `${node.color}14`,
                        color: node.color,
                      }}
                    >
                      {stat1}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                      style={{
                        background: "var(--bg-surface)",
                        color: "var(--fg-muted)",
                      }}
                    >
                      {stat2}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom 3-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1 — Recent Agent Actions */}
          <div
            className="rounded-xl border lg:col-span-1"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-light)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="px-5 py-3 border-b"
              style={{ borderColor: "var(--border-light)" }}
            >
              <span
                className={LABEL_CLS}
                style={{ color: "var(--fg-muted)" }}
              >
                Recent Agent Actions
              </span>
            </div>
            <div className="px-4 py-3 space-y-1.5 max-h-[340px] overflow-y-auto">
              {recentLogs.length === 0 && (
                <p
                  className="text-xs text-center py-8"
                  style={{ color: "var(--fg-muted)", animation: "idle-breathe 3s ease-in-out infinite" }}
                >
                  Awaiting agent activity…
                </p>
              )}
              {recentLogs.map((log) => {
                const badge = LOG_TYPE_BADGE[log.type] ?? LOG_TYPE_BADGE.system;
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 py-1.5 px-2 rounded-lg transition-colors hover:bg-[var(--bg-surface)]"
                  >
                    <span
                      className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[11px] leading-snug truncate"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {log.message}
                      </p>
                      <span
                        className="text-[9px] font-mono"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {formatTs(log.timestamp)}
                        {log.event_id && ` · ${log.event_id.slice(0, 8)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2 — Agent Health Matrix */}
          <div
            className="rounded-xl border"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-light)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="px-5 py-3 border-b"
              style={{ borderColor: "var(--border-light)" }}
            >
              <span
                className={LABEL_CLS}
                style={{ color: "var(--fg-muted)" }}
              >
                Agent Health Matrix
              </span>
            </div>
            <div className="p-4 space-y-3">
              {agents.map((agent) => {
                const active = agent.ops > 0;
                return (
                  <div
                    key={agent.name}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: "var(--bg-surface)" }}
                  >
                    {/* Status dot */}
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{
                        background: active ? agent.color : "var(--fg-muted)",
                        color: agent.color,
                        animation: active ? "glow-pulse 2s ease-in-out infinite" : "none",
                      }}
                    />
                    <span className="text-lg leading-none" style={{ color: agent.color }}>
                      {agent.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[11px] font-semibold truncate"
                        style={{ color: "var(--fg-primary)" }}
                      >
                        {agent.name}
                      </p>
                      <p
                        className="text-[10px] font-mono"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {active ? "Online" : "Standby"} · {agent.ops} ops
                      </p>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold"
                      style={{
                        background: active ? `${agent.color}18` : "var(--bg-surface)",
                        color: active ? agent.color : "var(--fg-muted)",
                      }}
                    >
                      {active ? "ACTIVE" : "IDLE"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 — System Telemetry */}
          <div
            className="rounded-xl border"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-light)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="px-5 py-3 border-b"
              style={{ borderColor: "var(--border-light)" }}
            >
              <span
                className={LABEL_CLS}
                style={{ color: "var(--fg-muted)" }}
              >
                System Telemetry
              </span>
            </div>
            <div className="p-4 space-y-4">
              {/* Connection */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Connection
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: status === "connected" ? "#22C55E" : status === "connecting" ? "#F59E0B" : "var(--fg-muted)",
                    }}
                  />
                  <span
                    className="text-[11px] font-mono font-semibold uppercase"
                    style={{
                      color: status === "connected" ? "#22C55E" : status === "connecting" ? "#F59E0B" : "var(--fg-muted)",
                    }}
                  >
                    {status}
                  </span>
                </div>
              </div>

              {/* Events processed */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Events Processed
                </span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {events.length}
                </span>
              </div>

              {/* Agent ops total */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Total Agent Ops
                </span>
                <span
                  className="text-sm font-bold tabular-nums"
                  style={{ color: "var(--fg-primary)" }}
                >
                  {logs.length}
                </span>
              </div>

              {/* Model */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Primary Model
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                  style={{ background: "var(--bg-surface)", color: "var(--fg-secondary)" }}
                >
                  GPT-4.1
                </span>
              </div>

              {/* Orchestration engine */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  Orchestration
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                  style={{ background: "var(--bg-surface)", color: "var(--fg-secondary)" }}
                >
                  LangGraph v0.2
                </span>
              </div>

              {/* Uptime bar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    Pipeline Uptime
                  </span>
                  <span
                    className="text-[10px] font-mono font-semibold"
                    style={{ color: "#22C55E" }}
                  >
                    99.8%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: "99.8%", background: "#22C55E" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
