"use client";

import { OfficersView } from "@/components/OfficersView";
import { usePulse } from "@/lib/pulse-context";

export default function OfficersPage() {
  const { events, officers } = usePulse();
  return <OfficersView events={events} officers={officers} />;
}
