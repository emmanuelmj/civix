"use client";

import { SwarmLog } from "@/components/SwarmLog";
import { usePulse } from "@/lib/pulse-context";

export default function SwarmLogPage() {
  const { logs } = usePulse();
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-card)" }}>
      <SwarmLog entries={logs} />
    </div>
  );
}
