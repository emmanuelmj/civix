"use client";

import type { PulseEvent, SwarmLogEntry } from "@/lib/types";

interface AgentNode {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  status: "idle" | "active" | "done";
  color: string;
  metric?: string;
}

interface AgentCanvasProps {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  status?: string;
}

export function AgentCanvas({ events, logs, status = "live" }: AgentCanvasProps) {
  const analysisLogs = logs.filter(l => l.type === "analysis");
  const dispatchLogs = logs.filter(l => l.type === "dispatch");
  const verifyLogs = logs.filter(l => l.type === "verification");

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
      sublabel: "LLM Impact Matrix (GPT-4.1)",
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
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              { name: "Priority Agent", desc: "GPT-4.1 impact scoring", logs: analysisLogs.length, color: "var(--accent-crimson)" },
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
