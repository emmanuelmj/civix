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
};

interface IngestionFeedProps {
  items: IntakeFeedItem[];
}

export function IngestionFeed({ items }: IngestionFeedProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--fg-muted)" }}>
            Intake Feed
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
            {items.length}
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
          <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: "var(--accent-green)" }} />
          live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="feed-card p-2.5 rounded-md border"
            style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs">{CHANNEL_ICONS[item.channel]}</span>
              <span className="text-[10px] font-mono uppercase"
                style={{ color: CHANNEL_COLORS[item.channel] }}>
                {item.channel}
              </span>
              <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                {new Date(item.timestamp).toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-primary)" }}>
              {item.translated_text}
            </p>
            {item.original_text !== item.translated_text && (
              <p className="text-[10px] mt-1 font-mono italic" style={{ color: "var(--fg-muted)" }}>
                orig: {item.original_text.slice(0, 60)}{item.original_text.length > 60 ? "…" : ""}
              </p>
            )}
          </div>
        ))}

        {items.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[11px] font-mono"
            style={{ color: "var(--fg-muted)" }}>
            Waiting for intake…
          </div>
        )}
      </div>
    </div>
  );
}
