"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PulseEvent } from "@/lib/types";

/* ── types ─────────────────────────────────────────────────────── */

interface FilterBarProps {
  events: PulseEvent[];
  onFilterChange: (filtered: PulseEvent[]) => void;
}

type Domain = PulseEvent["domain"];
type Severity = PulseEvent["severity"];

const DOMAINS: Domain[] = ["Municipal", "Traffic", "Water", "Electricity", "Construction", "Emergency"];
const SEVERITIES: Severity[] = ["critical", "high", "standard"];

const DOMAIN_COLORS: Record<Domain, string> = {
  Municipal:    "#6366f1",
  Traffic:      "#f59e0b",
  Water:        "#3b82f6",
  Electricity:  "#eab308",
  Construction: "#a855f7",
  Emergency:    "#ef4444",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  standard: "#71717a",
};

/* ── component ─────────────────────────────────────────────────── */

export function FilterBar({ events, onFilterChange }: FilterBarProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeDomains, setActiveDomains] = useState<Set<Domain>>(new Set());
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(new Set());
  const [clusteredOnly, setClusteredOnly] = useState(false);
  const [panicOnly, setPanicOnly] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* debounced search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  /* active filter count */
  const activeCount =
    (debouncedSearch ? 1 : 0) +
    activeDomains.size +
    activeSeverities.size +
    (clusteredOnly ? 1 : 0) +
    (panicOnly ? 1 : 0);

  /* filter logic */
  const applyFilters = useCallback(() => {
    let result = events;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (e) =>
          e.summary.toLowerCase().includes(q) ||
          e.event_id.toLowerCase().includes(q) ||
          (e.citizen_name && e.citizen_name.toLowerCase().includes(q)) ||
          (e.issue_type && e.issue_type.toLowerCase().includes(q)),
      );
    }

    if (activeDomains.size > 0) {
      result = result.filter((e) => activeDomains.has(e.domain));
    }

    if (activeSeverities.size > 0) {
      result = result.filter((e) => activeSeverities.has(e.severity));
    }

    if (clusteredOnly) {
      result = result.filter((e) => e.cluster_found === true);
    }

    if (panicOnly) {
      result = result.filter((e) => e.panic_flag === true);
    }

    return result;
  }, [events, debouncedSearch, activeDomains, activeSeverities, clusteredOnly, panicOnly]);

  useEffect(() => {
    onFilterChange(applyFilters());
  }, [applyFilters, onFilterChange]);

  /* toggle helpers */
  const toggleDomain = (d: Domain) =>
    setActiveDomains((prev) => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });

  const toggleSeverity = (s: Severity) =>
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const resetAll = () => {
    setSearch("");
    setDebouncedSearch("");
    setActiveDomains(new Set());
    setActiveSeverities(new Set());
    setClusteredOnly(false);
    setPanicOnly(false);
  };

  const filtered = applyFilters();

  /* ── shared styles ──────────────────────────────────────────── */

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 9999,
    fontSize: 10,
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    cursor: "pointer",
    transition: "all 120ms ease",
    whiteSpace: "nowrap",
    userSelect: "none",
    lineHeight: "18px",
    border: "1px solid",
  };

  const chipStyle = (active: boolean, color: string): React.CSSProperties => ({
    ...chipBase,
    background: active ? color : "transparent",
    color: active ? "#fff" : color,
    borderColor: active ? color : `${color}66`,
    opacity: active ? 1 : 0.7,
  });

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    ...chipBase,
    background: active ? "var(--accent-blue, #3b82f6)" : "transparent",
    color: active ? "#fff" : "var(--fg-muted, #71717a)",
    borderColor: active ? "var(--accent-blue, #3b82f6)" : "var(--border, #333)",
  });

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <div
      className="flex items-center gap-2 px-3 shrink-0 overflow-x-auto"
      style={{
        height: 44,
        background: "var(--bg-card, #141414)",
        borderBottom: "1px solid var(--border-light, #222)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
      }}
    >
      {/* Search input */}
      <div
        className="flex items-center gap-1.5 shrink-0"
        style={{
          background: "var(--bg-surface, #1a1a1a)",
          border: "1px solid var(--border, #333)",
          borderRadius: 6,
          padding: "0 8px",
          height: 28,
          minWidth: 160,
          maxWidth: 220,
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--fg-muted, #71717a)" strokeWidth="2" strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…"
          className="flex-1 outline-none bg-transparent"
          style={{
            fontSize: 11,
            color: "var(--fg-primary, #e5e5e5)",
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ color: "var(--fg-muted, #71717a)", lineHeight: 1, fontSize: 14 }}
          >
            ×
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-5 shrink-0" style={{ background: "var(--border, #333)" }} />

      {/* Domain chips */}
      <div className="flex items-center gap-1 shrink-0">
        {activeDomains.size > 0 && (
          <button
            onClick={() => setActiveDomains(new Set())}
            style={{
              ...chipBase,
              background: "transparent",
              color: "var(--fg-muted, #71717a)",
              borderColor: "var(--border, #333)",
              fontSize: 9,
            }}
          >
            All
          </button>
        )}
        {DOMAINS.map((d) => (
          <button
            key={d}
            onClick={() => toggleDomain(d)}
            style={chipStyle(activeDomains.has(d), DOMAIN_COLORS[d])}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-5 shrink-0" style={{ background: "var(--border, #333)" }} />

      {/* Severity chips */}
      <div className="flex items-center gap-1 shrink-0">
        {SEVERITIES.map((s) => (
          <button
            key={s}
            onClick={() => toggleSeverity(s)}
            style={chipStyle(activeSeverities.has(s), SEVERITY_COLORS[s])}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-5 shrink-0" style={{ background: "var(--border, #333)" }} />

      {/* Cluster toggle */}
      <button onClick={() => setClusteredOnly(!clusteredOnly)} style={toggleStyle(clusteredOnly)}>
        🔗 Clustered
      </button>

      {/* Panic toggle */}
      <button onClick={() => setPanicOnly(!panicOnly)} style={toggleStyle(panicOnly)}>
        🚨 Panic
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Results count */}
      <span
        className="shrink-0"
        style={{ fontSize: 10, color: "var(--fg-muted, #71717a)", fontFamily: "inherit" }}
      >
        Showing {filtered.length} of {events.length}
      </span>

      {/* Active filter badge + reset */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 18,
              height: 18,
              borderRadius: 9999,
              fontSize: 10,
              fontWeight: 600,
              background: "var(--accent-blue, #3b82f6)",
              color: "#fff",
              padding: "0 5px",
              fontFamily: "inherit",
            }}
          >
            {activeCount}
          </span>
          <button
            onClick={resetAll}
            style={{
              fontSize: 10,
              color: "var(--fg-muted, #71717a)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
