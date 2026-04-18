"use client";

import { SettingsView } from "@/components/SettingsView";
import { usePulse } from "@/lib/pulse-context";

export default function SettingsPage() {
  const { status, events, logs, intake } = usePulse();
  return <SettingsView status={status} events={events} logs={logs} intake={intake} />;
}
