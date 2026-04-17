"use client";

import { useState, useEffect, useCallback } from "react";
import type { IntakeFeedItem } from "@/lib/types";

/* ── channel icons ───────────────────────────────────────────── */
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

/* ── domain mapping ──────────────────────────────────────────── */
type Domain =
  | "MUNICIPAL"
  | "TRAFFIC"
  | "EMERGENCY"
  | "WATER"
  | "ELECTRICITY"
  | "CONSTRUCTION"
  | "GENERAL";

interface DomainStyle {
  text: string;
  bg: string;
}

const DOMAIN_STYLES: Record<Domain, DomainStyle> = {
  TRAFFIC:      { text: "text-orange-600", bg: "bg-orange-50" },
  EMERGENCY:    { text: "text-red-600",    bg: "bg-red-50" },
  WATER:        { text: "text-sky-600",    bg: "bg-sky-50" },
  ELECTRICITY:  { text: "text-amber-600",  bg: "bg-amber-50" },
  MUNICIPAL:    { text: "text-indigo-600", bg: "bg-indigo-50" },
  CONSTRUCTION: { text: "text-stone-600",  bg: "bg-stone-100" },
  GENERAL:      { text: "text-slate-600",  bg: "bg-slate-100" },
};

const ISSUE_DOMAIN_MAP: Record<string, Domain> = {
  pothole: "MUNICIPAL",
  garbage: "MUNICIPAL",
  streetlight: "MUNICIPAL",
  sewage: "MUNICIPAL",
  traffic: "TRAFFIC",
  signal: "TRAFFIC",
  accident: "TRAFFIC",
  fire: "EMERGENCY",
  flood: "EMERGENCY",
  collapse: "EMERGENCY",
  emergency: "EMERGENCY",
  water: "WATER",
  pipeline: "WATER",
  "low pressure": "WATER",
  electricity: "ELECTRICITY",
  power: "ELECTRICITY",
  outage: "ELECTRICITY",
  construction: "CONSTRUCTION",
  building: "CONSTRUCTION",
};

const CHANNEL_DOMAIN_MAP: Partial<Record<IntakeFeedItem["channel"], Domain>> = {
  sensor: "MUNICIPAL",
  camera: "TRAFFIC",
};

function resolveDomain(item: IntakeFeedItem): Domain {
  if (item.issue_type) {
    const key = item.issue_type.toLowerCase();
    for (const [keyword, domain] of Object.entries(ISSUE_DOMAIN_MAP)) {
      if (key.includes(keyword)) return domain;
    }
  }
  return CHANNEL_DOMAIN_MAP[item.channel] ?? "GENERAL";
}

/* ── helpers ─────────────────────────────────────────────────── */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function sentimentLabel(score: number): { label: string; color: string } {
  if (score <= -0.5) return { label: "Very Negative", color: "var(--accent-crimson)" };
  if (score < 0)     return { label: "Negative",      color: "var(--accent-amber)" };
  if (score === 0)   return { label: "Neutral",        color: "var(--fg-muted)" };
  if (score <= 0.5)  return { label: "Positive",       color: "var(--accent-blue)" };
  return { label: "Very Positive", color: "var(--accent-green)" };
}

/* ── domain tag chip ─────────────────────────────────────────── */
function DomainTag({ domain }: { domain: Domain }) {
  const style = DOMAIN_STYLES[domain];
  return (
    <span
      className={`uppercase text-[10px] tracking-widest font-bold px-2 py-1 rounded-full ${style.text} ${style.bg}`}
    >
      {domain}
    </span>
  );
}

/* ── detail panel ────────────────────────────────────────────── */
function DetailPanel({
  item,
  onClose,
}: {
  item: IntakeFeedItem;
  onClose: () => void;
}) {
  const domain = resolveDomain(item);
  const sentiment = item.sentiment_score != null ? sentimentLabel(item.sentiment_score) : null;
  // Normalise score from [-1,1] to [0,100] for the bar width
  const barWidth =
    item.sentiment_score != null
      ? Math.round(((item.sentiment_score + 1) / 2) * 100)
      : 0;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden
      />

      {/* panel */}
      <aside
        className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-50 transform transition-transform duration-300 translate-x-0 flex flex-col overflow-y-auto no-scrollbar"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
            style={{ color: "var(--fg-muted)" }}
          >
            Grievance Detail
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: "var(--fg-secondary)" }}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex-1 px-6 py-6 space-y-6">
          {/* citizen metadata */}
          <section className="space-y-3">
            <h3
              className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
              style={{ color: "var(--fg-muted)" }}
            >
              Citizen
            </h3>
            <div className="space-y-1.5">
              {item.citizen_name && (
                <p className="text-sm font-medium" style={{ color: "var(--fg-primary)" }}>
                  {item.citizen_name}
                </p>
              )}
              {item.citizen_id && (
                <p className="text-xs font-mono" style={{ color: "var(--fg-secondary)" }}>
                  ID: {item.citizen_id}
                </p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm">{CHANNEL_ICONS[item.channel]}</span>
                <span
                  className="text-xs font-mono uppercase font-semibold tracking-wider"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {item.channel}
                </span>
              </div>
            </div>
          </section>

          {/* domain */}
          <section className="space-y-3">
            <h3
              className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
              style={{ color: "var(--fg-muted)" }}
            >
              Domain
            </h3>
            <DomainTag domain={domain} />
          </section>

          {/* translated text */}
          <section className="space-y-3">
            <h3
              className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
              style={{ color: "var(--fg-muted)" }}
            >
              Translated Text
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--fg-primary)" }}
            >
              {item.translated_text}
            </p>
          </section>

          {/* original text */}
          {item.original_text !== item.translated_text && (
            <section className="space-y-3">
              <h3
                className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
                style={{ color: "var(--fg-muted)" }}
              >
                Original Text
              </h3>
              <p
                className="text-sm leading-relaxed italic font-mono"
                style={{ color: "var(--fg-secondary)" }}
              >
                {item.original_text}
              </p>
            </section>
          )}

          {/* sentiment */}
          {sentiment && (
            <section className="space-y-3">
              <h3
                className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
                style={{ color: "var(--fg-muted)" }}
              >
                Sentiment
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: sentiment.color }}
                  >
                    {sentiment.label}
                  </span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    {item.sentiment_score!.toFixed(2)}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ background: "var(--bg-surface)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: sentiment.color,
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* timestamp */}
          <section className="space-y-3">
            <h3
              className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
              style={{ color: "var(--fg-muted)" }}
            >
              Timestamp
            </h3>
            <p className="text-sm font-mono" style={{ color: "var(--fg-primary)" }}>
              {formatFullTimestamp(item.timestamp)}
            </p>
          </section>

          {/* coordinates */}
          {item.coordinates && (
            <section className="space-y-3">
              <h3
                className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
                style={{ color: "var(--fg-muted)" }}
              >
                Coordinates
              </h3>
              <p className="text-sm font-mono" style={{ color: "var(--fg-primary)" }}>
                {item.coordinates.lat.toFixed(6)}, {item.coordinates.lng.toFixed(6)}
              </p>
            </section>
          )}

          {/* panic flag */}
          {item.panic_flag && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <span className="text-sm">🚨</span>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--accent-crimson)" }}
              >
                Panic Flag Active
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/* ── main component ──────────────────────────────────────────── */
export function IntakeFeedView({ items }: { items: IntakeFeedItem[] }) {
  const [selected, setSelected] = useState<IntakeFeedItem | null>(null);

  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <h1
            className="text-[10px] font-semibold font-mono uppercase tracking-[0.2em]"
            style={{ color: "var(--fg-muted)" }}
          >
            Intake Feed
          </h1>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--bg-surface)", color: "var(--fg-secondary)" }}
          >
            {items.length}
          </span>
        </div>
        <span
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] font-mono"
          style={{ color: "var(--fg-muted)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              background: "var(--accent-green)",
              boxShadow: "0 0 6px rgba(22,163,74,0.6)",
            }}
          />
          live
        </span>
      </div>

      {/* feed list */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
        {items.map((item) => {
          const domain = resolveDomain(item);
          const domainStyle = DOMAIN_STYLES[domain];

          return (
            <div
              key={item.id}
              onClick={() => setSelected(item)}
              className={`feed-card p-4 rounded-xl break-words transition-all duration-300 hover:-translate-y-0.5 cursor-pointer paper-card`}
              style={
                item.panic_flag
                  ? {
                      borderColor: "rgba(239,68,68,0.4)",
                      boxShadow: "0 0 16px rgba(239,68,68,0.12)",
                    }
                  : undefined
              }
            >
              {/* top row: channel + domain + time */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm">{CHANNEL_ICONS[item.channel]}</span>
                <DomainTag domain={domain} />
                {item.panic_flag && <span className="text-xs">🚨</span>}
                <span
                  className="ml-auto text-xs font-mono whitespace-nowrap"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {formatTimestamp(item.timestamp)}
                </span>
              </div>

              {/* body */}
              <p
                className="text-sm leading-relaxed break-words"
                style={{ color: "var(--fg-primary)" }}
              >
                {item.translated_text}
              </p>

              {/* footer: citizen name */}
              {item.citizen_name && (
                <p
                  className="text-xs mt-2 font-mono"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  — {item.citizen_name}
                </p>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div
            className="flex items-center justify-center h-40 text-sm font-mono"
            style={{ color: "var(--fg-muted)" }}
          >
            Waiting for intake…
          </div>
        )}
      </div>

      {/* slide-over detail panel */}
      {selected && <DetailPanel item={selected} onClose={handleClose} />}
    </div>
  );
}
