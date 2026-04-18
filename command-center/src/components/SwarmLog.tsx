"use client";

import type { SwarmLogEntry } from "@/lib/types";

const TYPE_STYLES: Record<SwarmLogEntry["type"], { color: string; prefix: string }> = {
  analysis: { color: "var(--accent-amber)", prefix: "ANALYSIS" },
  dispatch: { color: "var(--accent-blue)", prefix: "DISPATCH" },
  verification: { color: "var(--accent-green)", prefix: "VERIFIED" },
  escalation: { color: "var(--accent-crimson)", prefix: "ESCALATE" },
  system: { color: "var(--fg-muted)", prefix: "SYSTEM" },
};

interface SwarmLogProps {
  entries: SwarmLogEntry[];
}

export function SwarmLog({ entries }: SwarmLogProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono uppercase tracking-[0.2em]"
            style={{ color: "var(--fg-muted)" }}>
            Swarm Log
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}>
            {entries.length}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] font-mono" style={{ color: "var(--fg-muted)" }}>⧉ brain</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
        {entries.map((entry) => {
          const style = TYPE_STYLES[entry.type];
          const isEscalation = entry.type === "escalation";
          return (
            <div key={entry.id}
              className={`feed-card px-3.5 py-3 rounded-xl break-words transition-all duration-300 hover:-translate-y-0.5 cursor-pointer paper-card ${isEscalation ? "glow-critical" : ""}`}
              style={isEscalation ? { borderColor: "rgba(239,68,68,0.3)" } : undefined}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] px-1.5 py-0.5 rounded"
                  style={{ background: `${style.color}22`, color: style.color }}>
                  {style.prefix}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--fg-muted)" }}>
                  {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              <p className="text-sm font-mono leading-relaxed break-words" style={{ color: "var(--fg-secondary)" }}>
                {entry.message}
              </p>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center"
            style={{ color: "var(--fg-muted)" }}>
            <span className="text-2xl" aria-hidden>⧉</span>
            <p className="text-sm font-mono">Swarm idle…</p>
            <p className="text-[11px] font-mono leading-relaxed" style={{ maxWidth: 260 }}>
              Agent activity will stream here in real time once a grievance is ingested.
              Actions from the Auditor, Priority, Dispatch, and Verification agents appear as
              they are emitted by the LangGraph pipeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
