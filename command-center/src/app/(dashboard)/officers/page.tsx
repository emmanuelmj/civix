"use client";

import { usePulse } from "@/lib/pulse-context";

export default function OfficersPage() {
  const { events } = usePulse();

  const officerMap = new Map<string, { officer_id: string; lat: number; lng: number; assignments: number; domains: Set<string> }>();
  events.forEach(e => {
    if (e.assigned_officer) {
      const existing = officerMap.get(e.assigned_officer.officer_id);
      if (existing) {
        existing.assignments++;
        existing.domains.add(e.domain);
        existing.lat = e.assigned_officer.current_lat;
        existing.lng = e.assigned_officer.current_lng;
      } else {
        officerMap.set(e.assigned_officer.officer_id, {
          officer_id: e.assigned_officer.officer_id,
          lat: e.assigned_officer.current_lat,
          lng: e.assigned_officer.current_lng,
          assignments: 1,
          domains: new Set([e.domain]),
        });
      }
    }
  });
  const officers = Array.from(officerMap.values()).sort((a, b) => b.assignments - a.assignments);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg" style={{ color: "var(--fg-primary)" }}>⊕</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg-primary)" }}>Field Officers</h2>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>{officers.length} active</span>
      </div>

      {officers.length === 0 ? (
        <div className="flex items-center justify-center h-48 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
          <p className="text-[12px] font-mono" style={{ color: "var(--fg-muted)" }}>No officers dispatched yet. Trigger an event to see officer data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {officers.map(off => (
            <div key={off.officer_id} className="flex items-center gap-4 p-3 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border-light)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
                {off.officer_id.slice(-3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: "var(--fg-primary)" }}>{off.officer_id}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>
                  ({off.lat.toFixed(4)}, {off.lng.toFixed(4)}) · {Array.from(off.domains).join(", ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--accent-blue)" }}>{off.assignments}</p>
                <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>tasks</p>
              </div>
              <span className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono shrink-0"
                style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)" }} />
                Active
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
