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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--fg-muted)" }}>
            Swarm Log
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}>
            {entries.length}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>⧉ brain</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {entries.map((entry) => {
          const style = TYPE_STYLES[entry.type];
          return (
            <div key={entry.id} className="feed-card px-2.5 py-2 rounded-md"
              style={{ background: "var(--bg-elevated)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono font-bold px-1 py-px rounded"
                  style={{ background: `${style.color}22`, color: style.color }}>
                  {style.prefix}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                  {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              <p className="text-[11px] font-mono leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                {entry.message}
              </p>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[11px] font-mono"
            style={{ color: "var(--fg-muted)" }}>
            Swarm idle…
          </div>
        )}
      </div>
    </div>
  );
}
