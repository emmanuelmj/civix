"use client";

import { AnalyticsView } from "@/components/AnalyticsView";
import { usePulse } from "@/lib/pulse-context";

export default function AnalyticsPage() {
  const { events, logs, intake } = usePulse();
  return <AnalyticsView events={events} logs={logs} intake={intake} />;
}
