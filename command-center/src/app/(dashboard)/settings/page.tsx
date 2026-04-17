"use client";

import { usePulse } from "@/lib/pulse-context";

export default function SettingsPage() {
  const { status, events, logs, intake } = usePulse();

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
