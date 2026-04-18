"use client";

import { useEffect, useRef } from "react";
import type { PulseEvent } from "@/lib/types";

interface GrievanceDetailProps {
  event: PulseEvent;
  onClose: () => void;
}

const SEVERITY_MAP: Record<PulseEvent["severity"], { label: string; color: string; dim: string }> = {
  standard: { label: "Standard", color: "var(--accent-green)", dim: "var(--accent-green-dim)" },
  high: { label: "High", color: "var(--accent-amber)", dim: "var(--accent-amber-dim)" },
  critical: { label: "Critical", color: "var(--accent-crimson)", dim: "var(--accent-crimson-dim)" },
};

const DOMAIN_COLOR: Record<PulseEvent["domain"], string> = {
  Municipal: "var(--accent-blue)",
  Traffic: "var(--accent-amber)",
  Construction: "var(--fg-secondary)",
  Emergency: "var(--accent-crimson)",
  Water: "var(--accent-blue)",
  Electricity: "var(--accent-amber)",
};

const PIPELINE_STEPS = [
  { icon: "◉", label: "Ingestion", agent: "Multimodal Swarm" },
  { icon: "⧉", label: "Systemic Auditor", agent: "Cluster Analysis" },
  { icon: "◔", label: "Priority Logic", agent: "Impact Matrix" },
  { icon: "⇧", label: "Amplifier", agent: "Escalation Check" },
  { icon: "⊕", label: "Dispatch", agent: "Officer Assignment" },
];

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      className="text-[9px] font-mono uppercase tracking-widest mb-3"
      style={{ color: "var(--fg-muted)" }}
    >
      {children}
    </div>
  );
}

function InlineBadge({
  children,
  color,
  dim,
}: {
  children: React.ReactNode;
  color: string;
  dim?: string;
}) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{ background: dim ?? `${color}18`, color }}
    >
      {children}
    </span>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className="w-full h-1.5 rounded-full overflow-hidden"
      style={{ background: "var(--bg-surface)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}

export function GrievanceDetail({ event, onClose }: GrievanceDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const sev = SEVERITY_MAP[event.severity];
  const domainColor = DOMAIN_COLOR[event.domain];

  // Use real impact score from backend, fall back to severity-based estimate
  const impactScore = event.impact_score
    ?? (event.severity === "critical" ? 92 : event.severity === "high" ? 68 : 35);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 animate-[fadeIn_200ms_ease-out]"
        style={{ background: "rgba(0,0,0,0.35)" }}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        className="fixed top-0 right-0 z-50 h-full overflow-y-auto animate-[slideIn_250ms_ease-out]"
        style={{
          width: 420,
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border-light)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-light)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[11px] font-mono font-medium truncate"
              style={{ color: "var(--fg-secondary)" }}
            >
              {event.event_id.slice(0, 12)}…
            </span>
            <InlineBadge color={domainColor}>{event.domain}</InlineBadge>
            <InlineBadge color={sev.color} dim={sev.dim}>
              {sev.label}
            </InlineBadge>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:opacity-80"
            style={{ background: "var(--bg-surface)", color: "var(--fg-muted)" }}
            aria-label="Close detail panel"
          >
            <span className="text-sm leading-none">✕</span>
          </button>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* ── Citizen Info ── */}
          <section>
            <SectionLabel>Citizen Info</SectionLabel>
            <div
              className="rounded-lg p-4 border space-y-2"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
                  Name
                </span>
                <span className="text-[12px] font-medium" style={{ color: "var(--fg-primary)" }}>
                  {event.citizen_name ?? "Anonymous"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
                  Citizen ID
                </span>
                <span className="text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
                  {event.citizen_id ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
                  Filed
                </span>
                <span className="text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
            </div>
          </section>

          {/* ── Complaint Details ── */}
          <section>
            <SectionLabel>Complaint Details</SectionLabel>
            <div
              className="rounded-lg p-4 border space-y-3"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
              }}
            >
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-primary)" }}>
                {event.summary}
              </p>
              {event.original_text && event.original_text !== event.summary && (
                <div
                  className="rounded-md p-3 border"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider block mb-1"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    Original Text
                  </span>
                  <p
                    className="text-[11px] font-mono italic leading-relaxed"
                    style={{ color: "var(--fg-secondary)" }}
                  >
                    {event.original_text}
                  </p>
                </div>
              )}
              {event.issue_type && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                    Issue Type
                  </span>
                  <InlineBadge color="var(--accent-blue)">{event.issue_type}</InlineBadge>
                </div>
              )}
            </div>
          </section>

          {/* ── AI Analysis ── */}
          <section>
            <SectionLabel>AI Analysis</SectionLabel>
            <div
              className="rounded-lg p-4 border space-y-4"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
              }}
            >
              {/* LLM Reasoning */}
              <div>
                <span
                  className="text-[9px] font-mono uppercase tracking-wider block mb-1.5"
                  style={{ color: "var(--fg-muted)" }}
                >
                  LLM Reasoning
                </span>
                <p
                  className="text-[11px] font-mono leading-relaxed"
                  style={{ color: "var(--fg-secondary)" }}
                >
                  {event.log_message}
                </p>
              </div>

              {/* Impact Score */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                    Impact Score
                  </span>
                  <span className="text-[11px] font-mono font-medium" style={{ color: sev.color }}>
                    {impactScore}/100
                  </span>
                </div>
                <ProgressBar value={impactScore} color={sev.color} />
              </div>

              {/* Severity + Panic + Sentiment row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Severity indicator */}
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: event.severity_color || sev.color }}
                  />
                  <span className="text-[10px] font-mono" style={{ color: "var(--fg-secondary)" }}>
                    {sev.label}
                  </span>
                </div>

                {/* Panic flag */}
                {event.panic_flag && (
                  <div
                    className="flex items-center gap-1 px-2 py-0.5 rounded"
                    style={{
                      background: "var(--accent-crimson-dim)",
                      color: "var(--accent-crimson)",
                    }}
                  >
                    <span className="text-[10px]">⚠</span>
                    <span className="text-[10px] font-mono font-bold uppercase">Panic</span>
                  </div>
                )}

                {/* Sentiment */}
                {event.sentiment_score != null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                      Sentiment
                    </span>
                    <div className="flex gap-px">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-3 rounded-sm"
                          style={{
                            background:
                              i < event.sentiment_score!
                                ? event.sentiment_score! <= 3
                                  ? "var(--accent-crimson)"
                                  : event.sentiment_score! <= 6
                                    ? "var(--accent-amber)"
                                    : "var(--accent-green)"
                                : "var(--bg-surface)",
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-secondary)" }}>
                      {event.sentiment_score}/10
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Cluster Intelligence ── */}
          {event.cluster_found && (
            <section>
              <SectionLabel>Cluster Intelligence</SectionLabel>
              <div
                className="rounded-lg p-4 border"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--accent-blue)",
                  borderLeftWidth: 3,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">🔗</span>
                  <span
                    className="text-[11px] font-mono font-medium"
                    style={{ color: "var(--accent-blue)" }}
                  >
                    Part of cluster
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                      Cluster ID
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
                      {event.cluster_id ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                      Cluster Size
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {Array.from({ length: Math.min(event.cluster_size ?? 0, 6) }).map((_, i) => (
                          <span
                            key={i}
                            className="w-3 h-3 rounded-full border"
                            style={{
                              background: "var(--accent-blue-dim)",
                              borderColor: "var(--bg-elevated)",
                              opacity: 1 - i * 0.12,
                            }}
                          />
                        ))}
                      </div>
                      <span
                        className="text-[11px] font-mono font-medium"
                        style={{ color: "var(--accent-blue)" }}
                      >
                        {event.cluster_size} linked
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Agent Trace Timeline ── */}
          <section>
            <SectionLabel>Agent Trace</SectionLabel>
            <div
              className="rounded-lg p-4 border"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border)",
              }}
            >
              <div className="relative">
                {PIPELINE_STEPS.map((step, i) => {
                  const isLast = i === PIPELINE_STEPS.length - 1;
                  return (
                    <div key={step.label} className="flex gap-3" style={{ paddingBottom: isLast ? 0 : 16 }}>
                      {/* Vertical line + dot */}
                      <div className="flex flex-col items-center" style={{ width: 20 }}>
                        <span
                          className="flex items-center justify-center w-5 h-5 rounded-full text-[10px]"
                          style={{
                            background: "var(--accent-green-dim)",
                            color: "var(--accent-green)",
                          }}
                        >
                          {step.icon}
                        </span>
                        {!isLast && (
                          <div
                            className="flex-1 w-px mt-1"
                            style={{ background: "var(--border)" }}
                          />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[11px] font-mono font-medium"
                            style={{ color: "var(--fg-primary)" }}
                          >
                            {step.label}
                          </span>
                          <span
                            className="text-[9px] font-mono px-1.5 py-px rounded"
                            style={{
                              background: "var(--accent-green-dim)",
                              color: "var(--accent-green)",
                            }}
                          >
                            completed
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono block mt-0.5"
                          style={{ color: "var(--fg-muted)" }}
                        >
                          {step.agent}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Officer Assignment ── */}
          {event.assigned_officer && (
            <section>
              <SectionLabel>Officer Assignment</SectionLabel>
              <div
                className="rounded-lg p-4 border"
                style={{
                  background: "var(--bg-elevated)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                      Officer
                    </span>
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "var(--fg-primary)" }}
                    >
                      {event.assigned_officer.name ?? "Field Officer"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                      ID
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--fg-secondary)" }}>
                      {event.assigned_officer.officer_id}
                    </span>
                  </div>
                  {event.assigned_officer.distance_km != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                        Distance
                      </span>
                      <span
                        className="text-[11px] font-mono"
                        style={{ color: "var(--fg-secondary)" }}
                      >
                        {event.assigned_officer.distance_km.toFixed(1)} km
                      </span>
                    </div>
                  )}
                  {event.assigned_officer.skills && event.assigned_officer.skills.length > 0 && (
                    <div>
                      <span
                        className="text-[10px] font-mono block mb-1.5"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        Skills
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {event.assigned_officer.skills.map((skill) => (
                          <InlineBadge key={skill} color="var(--accent-blue)">
                            {skill}
                          </InlineBadge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                      Status
                    </span>
                    <InlineBadge
                      color={
                        event.status === "RESOLVED"
                          ? "var(--accent-green)"
                          : event.status === "DISPATCHED" || event.status === "IN_PROGRESS"
                            ? "var(--accent-amber)"
                            : "var(--fg-secondary)"
                      }
                    >
                      {event.status}
                    </InlineBadge>
                  </div>
                  {event.time_to_resolution && (
                    <div style={{ marginTop: 8, padding: "6px 12px", background: "var(--accent-green-dim, #f0fdf4)", borderRadius: 8, fontSize: 12, color: "var(--accent-green, #16a34a)" }}>
                      ⏱ Resolved in {event.time_to_resolution}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
