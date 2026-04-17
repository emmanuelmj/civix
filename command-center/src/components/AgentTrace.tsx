"use client";

import type { PulseEvent, SwarmLogEntry } from "@/lib/types";

interface AgentTraceProps {
  event: PulseEvent;
  logs: SwarmLogEntry[];
  compact?: boolean;
}

interface PipelineStep {
  icon: string;
  label: string;
  sublabel: string;
  color: string;
  status: "completed" | "pending" | "skipped";
  details: string[];
}

function deriveImpactScore(severity: PulseEvent["severity"]): number {
  return severity === "critical" ? 92 : severity === "high" ? 68 : 35;
}

function severityLabel(severity: PulseEvent["severity"]): string {
  return severity === "critical"
    ? "Critical"
    : severity === "high"
      ? "High"
      : "Standard";
}

function formatTs(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildSteps(event: PulseEvent, logs: SwarmLogEntry[]): PipelineStep[] {
  const impactScore = deriveImpactScore(event.severity);
  const priorityLog = logs.find((l) => l.type === "analysis");

  return [
    // 1 – Multimodal Ingestion
    {
      icon: "◉",
      label: "Multimodal Ingestion",
      sublabel: "Intake & OCR / STT",
      color: "var(--accent-green)",
      status: "completed",
      details: [
        `Channel: ${event.domain}`,
        `Timestamp: ${formatTs(event.timestamp)}`,
        ...(event.citizen_name ? [`Citizen: ${event.citizen_name}`] : []),
      ],
    },

    // 2 – Systemic Auditor
    {
      icon: "⧉",
      label: "Systemic Auditor",
      sublabel: "Cluster Analysis",
      color: "var(--accent-amber)",
      status: "completed",
      details: event.cluster_found
        ? [
            `Cluster of ${event.cluster_size ?? "?"} detected`,
            `Cluster ID: ${event.cluster_id ?? "—"}`,
          ]
        : ["No cluster match"],
    },

    // 3 – Priority Logic Agent
    {
      icon: "◔",
      label: "Priority Logic Agent",
      sublabel: "Impact Matrix",
      color: "var(--accent-crimson)",
      status: "completed",
      details: [
        `Impact: ${impactScore}/100`,
        `Severity: ${severityLabel(event.severity)}`,
        ...(priorityLog ? [priorityLog.message] : [event.log_message]),
      ],
    },

    // 4 – Cluster Amplifier
    {
      icon: "⇧",
      label: "Cluster Amplifier",
      sublabel: "Escalation Check",
      color: "#a855f7",
      status: event.cluster_found ? "completed" : "skipped",
      details: event.cluster_found
        ? ["+15 boost applied"]
        : ["No amplification needed"],
    },

    // 5 – Dispatch Agent
    {
      icon: "⊕",
      label: "Dispatch Agent",
      sublabel: "Officer Assignment",
      color: "var(--accent-blue)",
      status: event.assigned_officer ? "completed" : "pending",
      details: event.assigned_officer
        ? [
            `Officer: ${event.assigned_officer.name ?? event.assigned_officer.officer_id}`,
            ...(event.assigned_officer.distance_km != null
              ? [`Distance: ${event.assigned_officer.distance_km.toFixed(1)} km`]
              : []),
            ...(event.assigned_officer.skills?.length
              ? [`Skills: ${event.assigned_officer.skills.join(", ")}`]
              : []),
          ]
        : ["Awaiting assignment"],
    },
  ];
}

function lastCompletedIndex(steps: PipelineStep[]): number {
  let idx = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].status === "completed") idx = i;
  }
  return idx;
}

/* ─── Compact Row ─── */
function CompactStep({
  step,
  isLast,
  lineActive,
}: {
  step: PipelineStep;
  isLast: boolean;
  lineActive: boolean;
}) {
  const filled = step.status === "completed";
  const dotColor = filled ? step.color : "var(--fg-muted)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Dot + line segment */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 16,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            border: `2px solid ${dotColor}`,
            background: filled ? dotColor : "transparent",
            flexShrink: 0,
          }}
        />
        {!isLast && (
          <div
            style={{
              width: 2,
              height: 16,
              background: lineActive ? step.color : "var(--border)",
              marginTop: 2,
            }}
          />
        )}
      </div>

      {/* Label */}
      <span
        className="text-[10px] font-mono font-medium"
        style={{ color: filled ? "var(--fg-primary)" : "var(--fg-muted)" }}
      >
        {step.icon} {step.label}
      </span>
    </div>
  );
}

/* ─── Full Row ─── */
function FullStep({
  step,
  isLast,
  lineActive,
}: {
  step: PipelineStep;
  isLast: boolean;
  lineActive: boolean;
}) {
  const filled = step.status === "completed";
  const dotColor = filled ? step.color : "var(--fg-muted)";

  const statusLabel =
    step.status === "completed"
      ? "completed"
      : step.status === "skipped"
        ? "skipped"
        : "pending";

  const statusColor =
    step.status === "completed"
      ? "var(--accent-green)"
      : step.status === "skipped"
        ? "var(--fg-muted)"
        : "var(--accent-amber)";

  return (
    <div style={{ display: "flex", gap: 14, minHeight: 72 }}>
      {/* Timeline rail: dot + connecting line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: `2.5px solid ${dotColor}`,
            background: filled ? dotColor : "transparent",
            flexShrink: 0,
            marginTop: 2,
          }}
        />
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              background: lineActive ? step.color : "var(--border)",
              marginTop: 4,
              borderRadius: 1,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
        {/* Step name + status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            className="text-[11px] font-mono font-bold"
            style={{ color: filled ? "var(--fg-primary)" : "var(--fg-muted)" }}
          >
            {step.icon} {step.label}
          </span>
          <span
            className="text-[9px] font-mono uppercase px-1.5 py-px rounded"
            style={{
              background: `${statusColor}18`,
              color: statusColor,
              letterSpacing: "0.04em",
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Sublabel */}
        <div
          className="text-[9px] font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--fg-muted)" }}
        >
          {step.sublabel}
        </div>

        {/* Detail lines */}
        {step.details.map((line, i) => (
          <div
            key={i}
            className="text-[10px] font-mono leading-relaxed"
            style={{ color: "var(--fg-secondary)" }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function AgentTrace({ event, logs, compact = false }: AgentTraceProps) {
  const steps = buildSteps(event, logs);
  const lastDone = lastCompletedIndex(steps);

  return (
    <div
      style={{
        padding: compact ? "8px 4px" : "16px 12px",
        background: "var(--bg-card)",
      }}
    >
      {/* Header */}
      {!compact && (
        <div
          className="text-[9px] font-mono uppercase tracking-widest mb-4"
          style={{ color: "var(--fg-muted)" }}
        >
          Agent Pipeline Trace
        </div>
      )}

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const lineActive = idx < lastDone;

          return compact ? (
            <CompactStep
              key={idx}
              step={step}
              isLast={isLast}
              lineActive={lineActive}
            />
          ) : (
            <FullStep
              key={idx}
              step={step}
              isLast={isLast}
              lineActive={lineActive}
            />
          );
        })}
      </div>
    </div>
  );
}
