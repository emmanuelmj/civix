"use client";

import { useEffect, useState } from "react";
import type { PulseEvent } from "@/lib/types";
import { fetchAnalyticsDepartments, type DepartmentAnalytics } from "@/lib/socket";

interface DepartmentStats {
  name: string;
  domain: string;
  totalEvents: number;
  resolved: number;
  avgResolutionMin: number | null;
  slaCompliance: number | null;
  satisfaction: number;
  clusterResolution: number;
}

function toTitle(domain: string): string {
  if (!domain) return "Unknown";
  return domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase();
}

function toStats(rows: DepartmentAnalytics[]): DepartmentStats[] {
  return rows.map((r) => ({
    name: `${toTitle(r.domain)} Services`,
    domain: r.domain,
    totalEvents: r.total_events,
    resolved: r.resolved,
    avgResolutionMin: r.avg_resolution_minutes,
    slaCompliance: r.sla_compliance_pct,
    satisfaction: r.satisfaction,
    clusterResolution: r.cluster_resolution_pct,
  }));
}

function RankBadge({ rank }: { rank: number }) {
  const colors = rank === 1
    ? { bg: "#fef3c7", fg: "#b45309" }
    : rank === 2
    ? { bg: "#f3f4f6", fg: "#6b7280" }
    : rank === 3
    ? { bg: "#fed7aa", fg: "#c2410c" }
    : { bg: "var(--bg-surface)", fg: "var(--fg-muted)" };

  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
      style={{ background: colors.bg, color: colors.fg }}>
      {rank}
    </span>
  );
}

function MeterBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-surface)" }}>
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

interface LeaderboardProps {
  // Kept for API compatibility; real data comes from backend analytics endpoint.
  events?: PulseEvent[];
}

export function Leaderboard({ events = [] }: LeaderboardProps) {
  const [departments, setDepartments] = useState<DepartmentStats[] | null>(null);

  // Re-fetch from backend whenever new events arrive (events.length changes)
  useEffect(() => {
    let active = true;
    const load = async () => {
      const rows = await fetchAnalyticsDepartments();
      if (active) setDepartments(toStats(rows));
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [events.length]);

  const loading = departments === null;
  const rows = (departments ?? []).slice().sort((a, b) => (b.slaCompliance ?? 0) - (a.slaCompliance ?? 0));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border-light)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--fg-primary)" }}>Department Leaderboard</h2>
        <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--fg-muted)" }}>
          Ranked by SLA compliance · Live updates
        </p>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[40px_1fr_80px_80px_70px_80px] gap-2 px-4 py-2 border-b text-[9px] font-mono uppercase tracking-wider"
        style={{ borderColor: "var(--border-light)", color: "var(--fg-muted)" }}>
        <span>#</span>
        <span>Department</span>
        <span className="text-right">Avg TTR</span>
        <span className="text-right">SLA %</span>
        <span className="text-right">Rating</span>
        <span className="text-right">Clusters</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
            Loading department analytics…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[11px] font-mono" style={{ color: "var(--fg-muted)" }}>
            No department data yet.
          </div>
        ) : (
          rows.map((dept, i) => {
            const sla = dept.slaCompliance;
            const slaColor =
              sla == null
                ? "var(--fg-muted)"
                : sla >= 80
                  ? "var(--accent-green)"
                  : sla >= 60
                    ? "var(--accent-amber)"
                    : "var(--accent-crimson)";
            return (
              <div
                key={dept.domain}
                className="grid grid-cols-[40px_1fr_80px_80px_70px_80px] gap-2 px-4 py-3 items-center border-b transition-colors hover:brightness-[0.98]"
                style={{
                  borderColor: "var(--border-light)",
                  background: i === 0 ? "var(--accent-green-dim)" : "transparent",
                }}
              >
                <RankBadge rank={i + 1} />
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--fg-primary)" }}>
                    {dept.name}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                    {dept.totalEvents} events · {dept.resolved} resolved
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono tabular-nums" style={{ color: "var(--fg-primary)" }}>
                    {dept.avgResolutionMin == null ? "—" : `${dept.avgResolutionMin}m`}
                  </p>
                  <MeterBar
                    value={dept.avgResolutionMin == null ? 0 : 60 - Math.min(dept.avgResolutionMin, 60)}
                    max={60}
                    color="var(--accent-blue)"
                  />
                </div>
                <div className="text-right">
                  <p
                    className="text-[12px] font-mono tabular-nums font-semibold"
                    style={{ color: slaColor }}
                  >
                    {sla == null ? "—" : `${sla}%`}
                  </p>
                  <MeterBar value={sla ?? 0} max={100} color={slaColor} />
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono tabular-nums" style={{ color: "var(--fg-primary)" }}>
                    {"★".repeat(Math.round(dept.satisfaction))}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                    {dept.satisfaction}/5
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-mono tabular-nums" style={{ color: "var(--fg-primary)" }}>
                    {dept.clusterResolution}%
                  </p>
                  <MeterBar value={dept.clusterResolution} max={100} color="var(--accent-blue)" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
