"use client";

import { AgentCanvas } from "@/components/AgentCanvas";
import { usePulse } from "@/lib/pulse-context";

export default function CanvasPage() {
  const { events, logs, status } = usePulse();
  return <AgentCanvas events={events} logs={logs} status={status} />;
}
