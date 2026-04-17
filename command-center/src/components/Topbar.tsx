"use client";

import { useEffect, useState } from "react";

export function Topbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
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
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-7 h-7 rounded-md"
          style={{ color: "var(--fg-secondary)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
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
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
          <span>Hyderabad</span>
          <span style={{ color: "var(--fg-secondary)" }}>{time}</span>
        </div>

        <div className="hidden sm:block w-px h-4" style={{ background: "var(--border)" }} />

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
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
