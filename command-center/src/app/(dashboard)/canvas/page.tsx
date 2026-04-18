"use client";

import { AgentCanvasView } from "@/components/AgentCanvasView";
import { usePulse } from "@/lib/pulse-context";

export default function CanvasPage() {
  const { events, logs, status } = usePulse();
  return <AgentCanvasView events={events} logs={logs} status={status} />;
}
