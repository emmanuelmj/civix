"use client";

import { IngestionFeed } from "@/components/IngestionFeed";
import { usePulse } from "@/lib/pulse-context";

export default function IntakeFeedPage() {
  const { intake } = usePulse();
  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-card)" }}>
      <IngestionFeed items={intake} />
    </div>
  );
}
