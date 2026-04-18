"use client";

import { IntakeFeedView } from "@/components/IntakeFeedView";
import { usePulse } from "@/lib/pulse-context";

export default function IntakePage() {
  const { intake } = usePulse();
  return <IntakeFeedView items={intake} />;
}
