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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* debounced search */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  /* close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <div
      className="flex items-center gap-3 px-4 shrink-0"
      style={{
        height: 44,
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
      }}
    >
      {/* Search input */}
      <div
        className="flex items-center gap-1.5 flex-1"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0 10px",
          height: 32,
          maxWidth: 280,
        }}
      >
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="var(--fg-muted)" strokeWidth="2" strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…"
          className="flex-1 outline-none bg-transparent text-xs"
          style={{
            color: "var(--fg-primary)",
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-sm leading-none"
            style={{ color: "var(--fg-muted)" }}
          >
            ×
          </button>
        )}
      </div>

      {/* Filter dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-[0.1em] transition-all duration-200 hover:brightness-110"
          style={{
            background: activeCount > 0 ? "var(--accent-blue)" : "var(--bg-surface)",
            color: activeCount > 0 ? "#fff" : "var(--fg-secondary)",
            border: `1px solid ${activeCount > 0 ? "var(--accent-blue)" : "var(--border)"}`,
            boxShadow: activeCount > 0 ? "0 0 12px rgba(37,99,235,0.25)" : "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filter
          {activeCount > 0 && (
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
            >
              {activeCount}
            </span>
          )}
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown panel — light theme with scroll */}
        {dropdownOpen && (
          <div
            className="absolute left-0 z-50 mt-2 rounded-xl overflow-y-auto no-scrollbar"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid var(--border-light)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
              width: 260,
              maxHeight: "70vh",
            }}
          >
            {/* Domain section */}
            <div className="px-4 pt-4 pb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.25em]"
                style={{ color: "var(--fg-muted)" }}>
                Domain
              </span>
            </div>
            <div className="px-2 pb-2 space-y-0.5">
              {DOMAINS.map((d) => {
                const active = activeDomains.has(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDomain(d)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-150"
                    style={{
                      background: active ? `${DOMAIN_COLORS[d]}14` : "transparent",
                      color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
                    }}
                  >
                    {/* Custom checkbox */}
                    <span
                      className="flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0"
                      style={{
                        borderColor: active ? DOMAIN_COLORS[d] : "var(--border)",
                        background: active ? DOMAIN_COLORS[d] : "transparent",
                      }}
                    >
                      {active && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    {/* Color dot */}
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DOMAIN_COLORS[d] }} />
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="mx-4 border-t" style={{ borderColor: "var(--border-light)" }} />

            {/* Severity section */}
            <div className="px-4 pt-3 pb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.25em]"
                style={{ color: "var(--fg-muted)" }}>
                Severity
              </span>
            </div>
            <div className="px-2 pb-2 space-y-0.5">
              {SEVERITIES.map((s) => {
                const active = activeSeverities.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSeverity(s)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono capitalize transition-all duration-150"
                    style={{
                      background: active ? `${SEVERITY_COLORS[s]}14` : "transparent",
                      color: active ? "var(--fg-primary)" : "var(--fg-secondary)",
                    }}
                  >
                    <span
                      className="flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0"
                      style={{
                        borderColor: active ? SEVERITY_COLORS[s] : "var(--border)",
                        background: active ? SEVERITY_COLORS[s] : "transparent",
                      }}
                    >
                      {active && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SEVERITY_COLORS[s] }} />
                    {s}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="mx-4 border-t" style={{ borderColor: "var(--border-light)" }} />

            {/* Toggles section */}
            <div className="px-4 pt-3 pb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.25em]"
                style={{ color: "var(--fg-muted)" }}>
                Flags
              </span>
            </div>
            <div className="px-2 pb-3 space-y-0.5">
              <button
                onClick={() => setClusteredOnly(!clusteredOnly)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-150"
                style={{
                  background: clusteredOnly ? "rgba(168,85,247,0.08)" : "transparent",
                  color: clusteredOnly ? "var(--fg-primary)" : "var(--fg-secondary)",
                }}
              >
                <span
                  className="flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0"
                  style={{
                    borderColor: clusteredOnly ? "#a855f7" : "var(--border)",
                    background: clusteredOnly ? "#a855f7" : "transparent",
                  }}
                >
                  {clusteredOnly && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                🔗 Clustered Only
              </button>
              <button
                onClick={() => setPanicOnly(!panicOnly)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-mono transition-all duration-150"
                style={{
                  background: panicOnly ? "rgba(239,68,68,0.08)" : "transparent",
                  color: panicOnly ? "var(--fg-primary)" : "var(--fg-secondary)",
                }}
              >
                <span
                  className="flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0"
                  style={{
                    borderColor: panicOnly ? "#ef4444" : "var(--border)",
                    background: panicOnly ? "#ef4444" : "transparent",
                  }}
                >
                  {panicOnly && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                🚨 Panic Only
              </button>
            </div>

            {/* Footer: reset + count */}
            {activeCount > 0 && (
              <>
                <div className="mx-4 border-t" style={{ borderColor: "var(--border-light)" }} />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                    {activeCount} active
                  </span>
                  <button
                    onClick={resetAll}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider transition-colors"
                    style={{ color: "var(--accent-crimson)" }}
                  >
                    Clear All
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Results count */}
      <span className="shrink-0 text-[10px] font-bold font-mono uppercase tracking-[0.1em]"
        style={{ color: "var(--fg-muted)" }}>
        {filtered.length} / {events.length}
      </span>

      {/* Active filter badge + reset (inline) */}
      {activeCount > 0 && (
        <button
          onClick={resetAll}
          className="shrink-0 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded transition-all duration-200 hover:brightness-110"
          style={{
            background: "var(--accent-crimson-dim)",
            color: "var(--accent-crimson)",
          }}
        >
          ✕ Reset
        </button>
      )}
    </div>
  );
}
