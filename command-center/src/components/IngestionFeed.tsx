"use client";

import type { IntakeFeedItem } from "@/lib/types";

const CHANNEL_ICONS: Record<IntakeFeedItem["channel"], string> = {
  whatsapp: "💬",
  twitter: "𝕏",
  portal: "🌐",
  camera: "📹",
  sensor: "📡",
  webhook: "⚡",
  api: "⌘",
  demo: "▶",
  blob: "📄",
};

const CHANNEL_COLORS: Record<IntakeFeedItem["channel"], string> = {
  whatsapp: "var(--accent-green)",
  twitter: "var(--accent-blue)",
  portal: "var(--fg-secondary)",
  camera: "var(--accent-amber)",
  sensor: "var(--accent-amber)",
  webhook: "var(--accent-crimson)",
  api: "var(--accent-blue)",
  demo: "var(--fg-muted)",
  blob: "var(--accent-green)",
};

interface IngestionFeedProps {
  items: IntakeFeedItem[];
}

export function IngestionFeed({ items }: IngestionFeedProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold font-mono uppercase tracking-[0.2em]"
            style={{ color: "var(--fg-muted)" }}>
            Intake Feed
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
            {items.length}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] font-mono" style={{ color: "var(--fg-muted)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px rgba(22,163,74,0.6)" }} />
          live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
        {items.map((item) => {
          const isCritical = item.translated_text?.toLowerCase().includes("urgent") ||
            item.translated_text?.toLowerCase().includes("emergency");
          return (
            <div key={item.id}
              className={`feed-card p-3.5 rounded-xl break-words transition-all duration-300 hover:-translate-y-0.5 cursor-pointer paper-card ${isCritical ? "glow-critical" : ""}`}
              style={isCritical ? { borderColor: "rgba(239,68,68,0.3)" } : undefined}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{CHANNEL_ICONS[item.channel]}</span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-[0.15em]"
                  style={{ color: CHANNEL_COLORS[item.channel] }}>
                  {item.channel}
                </span>
                <span className="ml-auto text-xs font-mono" style={{ color: "var(--fg-muted)" }}>
                  {new Date(item.timestamp).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-words" style={{ color: "var(--fg-primary)" }}>
                {item.translated_text}
              </p>
              {item.original_text !== item.translated_text && (
                <p className="text-xs mt-1.5 font-mono italic break-words" style={{ color: "var(--fg-muted)" }}>
                  orig: {item.original_text.slice(0, 80)}{item.original_text.length > 80 ? "…" : ""}
                </p>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm font-mono"
            style={{ color: "var(--fg-muted)" }}>
            Waiting for intake…
          </div>
        )}
      </div>
    </div>
  );
}
