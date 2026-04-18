"use client";

import { ExecutiveReportsView } from "@/components/ExecutiveReportsView";
import { usePulse } from "@/lib/pulse-context";

export default function ReportsPage() {
  const { events, logs, intake } = usePulse();
  return <ExecutiveReportsView events={events} logs={logs} intake={intake} />;
}
