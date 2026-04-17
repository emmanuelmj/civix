import type { PulseEvent, SwarmLogEntry, IntakeFeedItem } from "./types";

const HYDERABAD_CENTER = { lat: 17.385, lng: 78.4867 };
const OFFICER_NAMES = ["OP-441", "OP-227", "OP-318", "OP-512", "OP-109", "OP-663"];
const DOMAINS: PulseEvent["domain"][] = ["Municipal", "Traffic", "Construction", "Emergency"];
const CHANNELS: IntakeFeedItem["channel"][] = ["whatsapp", "twitter", "portal", "camera", "sensor"];

const SCENARIOS = [
  { summary: "Water main break on MG Road", domain: "Municipal" as const, severity: "critical" as const, log: "Water Main Break classified as Critical. Flooding reported." },
  { summary: "Pothole causing traffic buildup near Hitech City", domain: "Traffic" as const, severity: "high" as const, log: "Pothole cluster detected. Traffic backup 2.3km." },
  { summary: "Exposed live wire near Gachibowli school", domain: "Emergency" as const, severity: "critical" as const, log: "CRITICAL: Live electrical hazard in school zone. Override priority." },
  { summary: "Streetlight out on Jubilee Hills Road No. 36", domain: "Municipal" as const, severity: "standard" as const, log: "Streetlight failure logged. Standard priority." },
  { summary: "Construction debris blocking Ameerpet footpath", domain: "Construction" as const, severity: "high" as const, log: "Construction violation: debris on public walkway." },
  { summary: "Traffic signal malfunction at Kukatpally junction", domain: "Traffic" as const, severity: "high" as const, log: "Signal outage. Manual traffic control recommended." },
  { summary: "Garbage overflow near Charminar", domain: "Municipal" as const, severity: "standard" as const, log: "Sanitation alert: overflow at collection point CH-14." },
  { summary: "Crane operating without safety perimeter", domain: "Construction" as const, severity: "critical" as const, log: "CRITICAL: Crane safety violation. No perimeter fencing detected." },
  { summary: "Multi-car accident on ORR near Shamshabad", domain: "Emergency" as const, severity: "critical" as const, log: "CRITICAL: Multi-vehicle collision. Emergency dispatch initiated." },
  { summary: "Low water pressure in Secunderabad Ward 7", domain: "Municipal" as const, severity: "standard" as const, log: "Cluster: 23 complaints mapped to Pumping Station SEC-7." },
];

const INTAKE_MESSAGES = [
  { orig: "पानी नहीं आ रहा सुबह से", trans: "No water supply since morning", ch: "whatsapp" as const },
  { orig: "Huge pothole on road 36 almost hit my car", trans: "Huge pothole on road 36 almost hit my car", ch: "twitter" as const },
  { orig: "బిల్డింగ్ సైట్ లో హెల్మెట్ లేకుండా పని చేస్తున్నారు", trans: "Workers at building site without helmets", ch: "whatsapp" as const },
  { orig: "[Camera Feed] Anomaly detected: waterlogging", trans: "Waterlogging detected at CCTV node KP-22", ch: "camera" as const },
  { orig: "Traffic jam since 1 hour near cyber towers", trans: "Traffic jam since 1 hour near Cyber Towers", ch: "portal" as const },
  { orig: "[IoT Sensor] Water pressure drop below threshold", trans: "Water pressure anomaly at sensor WP-SEC-07", ch: "sensor" as const },
  { orig: "सड़क पर तार गिरा है बहुत खतरनाक है", trans: "Fallen wire on road, very dangerous", ch: "whatsapp" as const },
  { orig: "Garbage not picked up for 3 days in colony", trans: "Garbage not picked up for 3 days in colony", ch: "portal" as const },
];

function jitter(center: number, range: number) {
  return center + (Math.random() - 0.5) * range;
}

let eventCounter = 0;

function uid() {
  return `evt-${Date.now().toString(36)}-${(eventCounter++).toString(36)}`;
}

const SEVERITY_COLORS = { standard: "#ca8a04", high: "#dc2626", critical: "#dc2626" };

export function generatePulseEvent(): PulseEvent {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  const officer = OFFICER_NAMES[Math.floor(Math.random() * OFFICER_NAMES.length)];
  const statuses: PulseEvent["status"][] = ["NEW", "ANALYZING", "DISPATCHED", "IN_PROGRESS"];
  return {
    event_id: uid(),
    status: statuses[Math.floor(Math.random() * statuses.length)],
    coordinates: { lat: jitter(HYDERABAD_CENTER.lat, 0.08), lng: jitter(HYDERABAD_CENTER.lng, 0.08) },
    severity_color: SEVERITY_COLORS[scenario.severity],
    severity: scenario.severity,
    domain: scenario.domain,
    summary: scenario.summary,
    assigned_officer: Math.random() > 0.3 ? {
      officer_id: officer,
      current_lat: jitter(HYDERABAD_CENTER.lat, 0.06),
      current_lng: jitter(HYDERABAD_CENTER.lng, 0.06),
    } : undefined,
    log_message: scenario.log,
    timestamp: Date.now(),
  };
}

export function generateSwarmLog(event?: PulseEvent): SwarmLogEntry {
  const types: SwarmLogEntry["type"][] = ["analysis", "dispatch", "verification", "system"];
  const type = event ? (Math.random() > 0.5 ? "dispatch" : "analysis") : types[Math.floor(Math.random() * types.length)];

  const messages: Record<SwarmLogEntry["type"], string[]> = {
    analysis: [
      "Priority Agent: Impact score calculated — School Zone modifier applied.",
      "Systemic Auditor: Cluster detected — 23 complaints linked to single pump station.",
      "Domain classified: Municipal → Water Infrastructure.",
      "NLP: Sentiment = Urgent. Language = Hindi. Translated via Bhashini.",
    ],
    dispatch: [
      `Resolution Agent: Dispatching ${event?.assigned_officer?.officer_id ?? "OP-441"} to coordinates.`,
      "Matchmaker: Filtering available officers within 2km radius.",
      "Escalation: Officer declined. Pinging next closest unit.",
      `Live-Grid: Drawing dispatch line to ${event?.assigned_officer?.officer_id ?? "OP-227"}.`,
    ],
    verification: [
      "Verification: Geo-tagged photo received. Analyzing completion.",
      "Citizen notified via WhatsApp: 'Your issue has been resolved by Officer Raj.'",
      "Task closed. Time-to-resolution: 47 minutes.",
    ],
    escalation: [
      "ESCALATION: 3 officers declined. Alerting Sector Commander.",
      "SLA breach in 12 minutes. Auto-escalation queued.",
    ],
    system: [
      "Swarm heartbeat: All 4 agents responsive.",
      "Ingestion rate: 3.2 events/min across all channels.",
      "Model routing: Gemini Flash handling classification batch.",
    ],
  };

  const pool = messages[type];
  return {
    id: uid(),
    type,
    message: pool[Math.floor(Math.random() * pool.length)],
    timestamp: Date.now(),
    event_id: event?.event_id,
  };
}

export function generateIntakeItem(): IntakeFeedItem {
  const msg = INTAKE_MESSAGES[Math.floor(Math.random() * INTAKE_MESSAGES.length)];
  return {
    id: uid(),
    channel: msg.ch,
    original_text: msg.orig,
    translated_text: msg.trans,
    timestamp: Date.now(),
    coordinates: { lat: jitter(HYDERABAD_CENTER.lat, 0.08), lng: jitter(HYDERABAD_CENTER.lng, 0.08) },
  };
}
