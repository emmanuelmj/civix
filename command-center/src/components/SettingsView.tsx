"use client";

import { useEffect, useState } from "react";
import { fetchPineconeStatus, triggerRescan, type ConnectionStatus } from "@/lib/socket";
import type { PulseEvent, SwarmLogEntry, IntakeFeedItem, PineconeStatus } from "@/lib/types";

interface Props {
  status: ConnectionStatus;
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  intake: IntakeFeedItem[];
}

export function SettingsView({ status, events, logs, intake }: Props) {
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
