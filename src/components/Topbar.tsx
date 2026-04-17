"use client";

import { useEffect, useState } from "react";

export function Topbar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-IN", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="h-11 flex items-center justify-between px-5 border-b shrink-0"
      style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>
          Command Center
        </h1>
        <span className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded font-mono"
          style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: "var(--accent-green)" }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ background: "var(--accent-green)" }} />
          </span>
          LIVE
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
          <span>Hyderabad</span>
          <span style={{ color: "var(--fg-secondary)" }}>{time}</span>
        </div>

        <div className="w-px h-4" style={{ background: "var(--border)" }} />

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
            4 agents
          </span>
          <span className="flex gap-0.5">
            {[1, 2, 3, 4].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)" }} />
            ))}
          </span>
        </div>
      </div>
    </header>
  );
}
