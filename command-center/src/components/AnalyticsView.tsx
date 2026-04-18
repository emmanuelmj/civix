"use client";

import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "@/lib/types";
import { useMemo } from "react";

/* ─── Domain color palette ─── */
const DOMAIN_COLORS: Record<string, string> = {
  Municipal: "#2563eb",
  Water: "#3b82f6",
  Electricity: "#ca8a04",
  Traffic: "#dc2626",
  Construction: "#9333ea",
  Emergency: "#ef4444",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#FFA500",
  standard: "#ca8a04",
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  twitter: "𝕏",
  portal: "🌐",
  camera: "📹",
  sensor: "📡",
  webhook: "⚡",
  api: "⌘",
  blob: "📄",
  demo: "🧪",
};

/* ─── Helpers ─── */

// Parse PostgreSQL interval "HH:MM:SS" or "X days HH:MM:SS" to minutes
function parseTTRMinutes(ttr: string): number | null {
  if (!ttr) return null;
  const dayMatch = ttr.match(/(\d+)\s+days?\s+(\d+):(\d+):(\d+)/);
  if (dayMatch) {
    return parseInt(dayMatch[1]) * 1440 + parseInt(dayMatch[2]) * 60 + parseInt(dayMatch[3]);
  }
  const timeMatch = ttr.match(/(\d+):(\d+):(\d+)/);
  if (timeMatch) {
    return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
  }
  return null;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0";
  return ((n / total) * 100).toFixed(1);
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-mono uppercase tracking-wider"
      style={{
        fontSize: 11,
        color: "var(--fg-muted)",
        marginBottom: 12,
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </h3>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  accent,
  pulse,
  trend,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
  pulse?: boolean;
  trend?: "up" | "down" | null;
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        padding: "20px 24px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          color: "var(--fg-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {pulse && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: accent ?? "#dc2626",
              display: "inline-block",
              animation: "kpi-pulse 1.5s ease-in-out infinite",
            }}
          />
        )}
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          className="font-semibold tabular-nums font-mono"
          style={{
            fontSize: 28,
            lineHeight: 1,
            color: accent ?? "var(--fg-primary)",
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            className="font-mono"
            style={{ fontSize: 14, color: "var(--fg-muted)" }}
          >
            {suffix}
          </span>
        )}
        {trend && (
          <span
            style={{
              fontSize: 14,
              marginLeft: 6,
              color: trend === "up" ? "var(--accent-green)" : "var(--accent-crimson)",
            }}
          >
            {trend === "up" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function AnalyticsView({
  events,
  logs,
  intake,
}: {
  events: PulseEvent[];
  logs: SwarmLogEntry[];
  intake: IntakeFeedItem[];
}) {
  /* ── KPI computations ── */
  const kpis = useMemo(() => {
    const total = events.length;
    const critical = events.filter((e) => e.severity === "critical" && e.status !== "RESOLVED").length;
    const avgImpact =
      total > 0
        ? events.reduce((s, e) => s + (e.impact_score ?? e.sentiment_score ?? 0), 0) / total
        : 0;
    const resolved = events.filter((e) => e.status === "RESOLVED").length;
    const resolutionRate = total > 0 ? (resolved / total) * 100 : 0;
    return { total, critical, avgImpact, resolutionRate, resolved };
  }, [events]);

  /* ── Avg Time-to-Resolution ── */
  const avgTTR = useMemo(() => {
    const ttrValues = events.map(e => parseTTRMinutes(e.time_to_resolution || "")).filter((v): v is number => v !== null);
    return ttrValues.length > 0 ? Math.round(ttrValues.reduce((a, b) => a + b, 0) / ttrValues.length) : null;
  }, [events]);

  /* ── Domain distribution ── */
  const domainDist = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      map[e.domain] = (map[e.domain] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, count }));
  }, [events]);

  /* ── Severity breakdown ── */
  const severityBreakdown = useMemo(() => {
    const map = { critical: 0, high: 0, standard: 0 };
    events.forEach((e) => {
      if (e.severity in map) map[e.severity]++;
    });
    return map;
  }, [events]);

  const severityTotal =
    severityBreakdown.critical + severityBreakdown.high + severityBreakdown.standard;

  const donutGradient = useMemo(() => {
    if (severityTotal === 0) return "conic-gradient(var(--border) 0deg 360deg)";
    const critPct = (severityBreakdown.critical / severityTotal) * 100;
    const highPct = (severityBreakdown.high / severityTotal) * 100;
    const stdPct = (severityBreakdown.standard / severityTotal) * 100;
    const a = critPct;
    const b = critPct + highPct;
    return `conic-gradient(${SEVERITY_COLORS.critical} 0% ${a}%, ${SEVERITY_COLORS.high} ${a}% ${b}%, ${SEVERITY_COLORS.standard} ${b}% ${b + stdPct}%)`;
  }, [severityBreakdown, severityTotal]);

  /* ── Hourly trend (last 24h) ── */
  const hourlyTrend = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 24 }, () => 0);
    const currentHour = new Date().getHours();
    events.forEach((e) => {
      const age = now - e.timestamp;
      if (age < 24 * 60 * 60 * 1000 && age >= 0) {
        const h = new Date(e.timestamp).getHours();
        buckets[h]++;
      }
    });
    const max = Math.max(...buckets, 1);
    return { buckets, max, currentHour };
  }, [events]);

  /* ── Channel breakdown ── */
  const channelDist = useMemo(() => {
    const map: Record<string, number> = {};
    intake.forEach((i) => {
      map[i.channel] = (map[i.channel] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([channel, count]) => ({ channel, count }));
  }, [intake]);

  /* ── Cluster intelligence ── */
  const clusterStats = useMemo(() => {
    const clustered = events.filter((e) => e.cluster_found);
    const totalClusters = new Set(clustered.map((e) => e.cluster_id)).size;
    const avgSize =
      clustered.length > 0
        ? clustered.reduce((s, e) => s + (e.cluster_size ?? 1), 0) / clustered.length
        : 0;
    return { totalClusters, avgSize, systemic: totalClusters, clusteredEvents: clustered.length };
  }, [events]);

  /* ── Officer performance ── */
  const officerPerf = useMemo(() => {
    const map: Record<string, { name: string; count: number; domains: Set<string> }> = {};
    events.forEach((e) => {
      if (e.assigned_officer) {
        const id = e.assigned_officer.officer_id;
        if (!map[id]) {
          map[id] = { name: e.assigned_officer.name ?? id, count: 0, domains: new Set() };
        }
        map[id].count++;
        map[id].domains.add(e.domain);
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [events]);

  const maxOfficerLoad = Math.max(...officerPerf.map((o) => o.count), 1);

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "24px 28px",
        background: "var(--bg-base)",
      }}
    >
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes kpi-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
      `}</style>

      {/* ── Section 1: KPI Header ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        <KpiCard
          label="Total Grievances"
          value={kpis.total}
          trend={kpis.total > 0 ? "up" : null}
        />
        <KpiCard
          label="Critical Active"
          value={kpis.critical}
          accent="var(--accent-crimson)"
          pulse={kpis.critical > 0}
        />
        <KpiCard
          label="Avg Impact Score"
          value={kpis.avgImpact.toFixed(2)}
        />
        <KpiCard
          label="Resolution Rate"
          value={kpis.resolutionRate.toFixed(1)}
          suffix="%"
          accent={kpis.resolutionRate >= 50 ? "var(--accent-green)" : undefined}
        />
        {avgTTR !== null && (
          <KpiCard
            label="Avg Resolution Time"
            value={avgTTR >= 60 ? `${(avgTTR / 60).toFixed(1)}` : `${avgTTR}`}
            suffix={avgTTR >= 60 ? "hrs" : "min"}
            accent="var(--accent-green)"
          />
        )}
      </div>

      {/* ── Two‑column grid for mid‑sections ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* ── Section 2: Domain Distribution ── */}
        <div
          className="rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            padding: "20px 24px",
          }}
        >
          <SectionHeader>Domain Distribution</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {domainDist.length === 0 && (
              <span className="font-mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                No data
              </span>
            )}
            {domainDist.map(({ domain, count }) => {
              const p = kpis.total > 0 ? (count / kpis.total) * 100 : 0;
              return (
                <div key={domain}>
                  <div
                    className="font-mono"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginBottom: 4,
                      color: "var(--fg-secondary)",
                    }}
                  >
                    <span>{domain}</span>
                    <span className="tabular-nums">
                      {count} · {p.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--bg-surface)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${p}%`,
                        borderRadius: 3,
                        background: DOMAIN_COLORS[domain] ?? "var(--fg-muted)",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: Severity Breakdown (Donut) ── */}
        <div
          className="rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ alignSelf: "flex-start", width: "100%" }}>
            <SectionHeader>Severity Breakdown</SectionHeader>
          </div>
          {/* Donut */}
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: donutGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "var(--bg-card)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                className="font-mono font-semibold tabular-nums"
                style={{ fontSize: 20, color: "var(--fg-primary)" }}
              >
                {severityTotal}
              </span>
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: 20 }}>
            {(["critical", "high", "standard"] as const).map((sev) => (
              <div key={sev} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: SEVERITY_COLORS[sev],
                    display: "inline-block",
                  }}
                />
                <span
                  className="font-mono tabular-nums"
                  style={{ fontSize: 11, color: "var(--fg-secondary)" }}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)} · {severityBreakdown[sev]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 4: Hourly Trend ── */}
      <div
        className="rounded-lg"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          padding: "20px 24px",
          marginBottom: 20,
        }}
      >
        <SectionHeader>Hourly Trend — Last 24h</SectionHeader>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
          {hourlyTrend.buckets.map((count, h) => {
            const heightPct = hourlyTrend.max > 0 ? (count / hourlyTrend.max) * 100 : 0;
            const isCurrent = h === hourlyTrend.currentHour;
            return (
              <div
                key={h}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    minHeight: 2,
                    height: `${heightPct}%`,
                    borderRadius: "2px 2px 0 0",
                    background: isCurrent ? "var(--accent-blue)" : "var(--bg-surface)",
                    transition: "height 0.3s ease",
                    maxHeight: 72,
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* Hour labels */}
        <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
          {hourlyTrend.buckets.map((_, h) => (
            <div
              key={h}
              className="font-mono tabular-nums"
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 8,
                color:
                  h === hourlyTrend.currentHour ? "var(--accent-blue)" : "var(--fg-muted)",
              }}
            >
              {h % 3 === 0 ? `${String(h).padStart(2, "0")}` : ""}
            </div>
          ))}
        </div>
      </div>

      {/* ── Two‑column: Channel + Cluster ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* ── Section 5: Intake Channel Breakdown ── */}
        <div
          className="rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            padding: "20px 24px",
          }}
        >
          <SectionHeader>Intake Channels</SectionHeader>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            {channelDist.length === 0 && (
              <span className="font-mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                No intake data
              </span>
            )}
            {channelDist.map(({ channel, count }) => (
              <div
                key={channel}
                className="rounded-lg"
                style={{
                  background: "var(--bg-surface)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 20 }}>{CHANNEL_ICONS[channel] ?? "📥"}</span>
                <div>
                  <div
                    className="font-mono font-semibold tabular-nums"
                    style={{ fontSize: 16, color: "var(--fg-primary)", lineHeight: 1.2 }}
                  >
                    {count}
                  </div>
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {channel} · {pct(count, intake.length)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 6: Cluster Intelligence ── */}
        <div
          className="rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            padding: "20px 24px",
          }}
        >
          <SectionHeader>Cluster Intelligence</SectionHeader>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div
              className="rounded-lg"
              style={{ background: "var(--bg-surface)", padding: "14px 16px" }}
            >
              <div
                className="font-mono font-semibold tabular-nums"
                style={{ fontSize: 24, color: "var(--fg-primary)", lineHeight: 1 }}
              >
                {clusterStats.totalClusters}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4, textTransform: "uppercase" }}
              >
                Clusters Detected
              </div>
            </div>
            <div
              className="rounded-lg"
              style={{ background: "var(--bg-surface)", padding: "14px 16px" }}
            >
              <div
                className="font-mono font-semibold tabular-nums"
                style={{ fontSize: 24, color: "var(--fg-primary)", lineHeight: 1 }}
              >
                {clusterStats.avgSize.toFixed(1)}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4, textTransform: "uppercase" }}
              >
                Avg Cluster Size
              </div>
            </div>
            <div
              className="rounded-lg"
              style={{ background: "var(--bg-surface)", padding: "14px 16px" }}
            >
              <div
                className="font-mono font-semibold tabular-nums"
                style={{ fontSize: 24, color: "var(--accent-crimson)", lineHeight: 1 }}
              >
                {clusterStats.systemic}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4, textTransform: "uppercase" }}
              >
                Systemic Issues
              </div>
            </div>
            <div
              className="rounded-lg"
              style={{ background: "var(--bg-surface)", padding: "14px 16px" }}
            >
              <div
                className="font-mono font-semibold tabular-nums"
                style={{ fontSize: 24, color: "var(--fg-primary)", lineHeight: 1 }}
              >
                {clusterStats.clusteredEvents}
              </div>
              <div
                className="font-mono"
                style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4, textTransform: "uppercase" }}
              >
                Linked Events
              </div>
            </div>
          </div>
          {/* Visual cluster indicator */}
          {clusterStats.totalClusters > 0 && (
            <div
              style={{
                marginTop: 14,
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(37,99,235,0.06)",
                border: "1px solid rgba(37,99,235,0.15)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14 }}>🔗</span>
              <span
                className="font-mono"
                style={{ fontSize: 11, color: "var(--accent-blue)" }}
              >
                {clusterStats.totalClusters} systemic pattern{clusterStats.totalClusters !== 1 ? "s" : ""} identified across {clusterStats.clusteredEvents} events
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 7: Officer Performance Grid ── */}
      <div
        className="rounded-lg"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          padding: "20px 24px",
          marginBottom: 20,
        }}
      >
        <SectionHeader>Officer Performance</SectionHeader>
        {officerPerf.length === 0 ? (
          <span className="font-mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            No officers assigned
          </span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {officerPerf.map((o) => (
              <div key={o.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* Officer name */}
                <div
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: "var(--fg-primary)",
                    width: 130,
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.name}
                </div>
                {/* Workload bar */}
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: "var(--bg-surface)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(o.count / maxOfficerLoad) * 100}%`,
                      borderRadius: 4,
                      background: "var(--accent-blue)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                {/* Stats */}
                <div
                  className="font-mono tabular-nums"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-secondary)",
                    flexShrink: 0,
                    width: 80,
                    textAlign: "right",
                  }}
                >
                  {o.count} tasks
                </div>
                {/* Domains */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {Array.from(o.domains).map((d) => (
                    <span
                      key={d}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: DOMAIN_COLORS[d] ?? "var(--fg-muted)",
                        display: "inline-block",
                      }}
                      title={d}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 8: Quick Stats Row ── */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Swarm Logs", value: logs.length },
          { label: "Intake Items", value: intake.length },
          {
            label: "Avg Response Time",
            value: (() => {
              const resolvedTtrs = events
                .map((e) => (e.time_to_resolution ? parseTTRMinutes(e.time_to_resolution) : null))
                .filter((v): v is number => v != null && v >= 0);
              if (resolvedTtrs.length === 0) return "—";
              const avg = resolvedTtrs.reduce((a, b) => a + b, 0) / resolvedTtrs.length;
              return `${avg.toFixed(0)}m`;
            })(),
          },
          {
            label: "Pipeline Throughput",
            value: `${events.length + intake.length}`,
            suffix: "items",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg"
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1px solid var(--border-light)",
              padding: "14px 18px",
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              {stat.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span
                className="font-mono font-semibold tabular-nums"
                style={{ fontSize: 20, color: "var(--fg-primary)", lineHeight: 1 }}
              >
                {stat.value}
              </span>
              {"suffix" in stat && stat.suffix && (
                <span
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--fg-muted)" }}
                >
                  {stat.suffix}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
