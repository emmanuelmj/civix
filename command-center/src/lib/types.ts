export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Officer {
  officer_id: string;
  name?: string;
  skills?: string[];
  current_lat: number;
  current_lng: number;
  distance_km?: number;
  active_tasks?: number;
}

export interface PulseEvent {
  event_id: string;
  status: "NEW" | "ANALYZING" | "DISPATCHED" | "IN_PROGRESS" | "RESOLVED";
  coordinates: Coordinates;
  severity_color: string;
  severity: "standard" | "high" | "critical";
  domain: "Municipal" | "Traffic" | "Construction" | "Emergency" | "Water" | "Electricity";
  summary: string;
  assigned_officer?: Officer;
  log_message: string;
  timestamp: number;
  thumbnail?: string;
  original_text?: string;
  // Cluster info from Systemic Auditor
  cluster_found?: boolean;
  cluster_id?: string;
  cluster_size?: number;
  // Citizen & issue metadata
  citizen_name?: string;
  citizen_id?: string;
  issue_type?: string;
  panic_flag?: boolean;
  sentiment_score?: number;
}

export interface SwarmLogEntry {
  id: string;
  type: "analysis" | "dispatch" | "verification" | "escalation" | "system";
  message: string;
  timestamp: number;
  event_id?: string;
}

export interface IntakeFeedItem {
  id: string;
  channel: "whatsapp" | "twitter" | "portal" | "camera" | "sensor" | "webhook" | "api" | "demo" | "blob";
  original_text: string;
  translated_text: string;
  thumbnail?: string;
  timestamp: number;
  coordinates?: Coordinates;
  citizen_name?: string;
  citizen_id?: string;
  issue_type?: string;
  panic_flag?: boolean;
  sentiment_score?: number;
}

export interface PineconeStatus {
  pinecone: {
    connected: boolean;
    index_name?: string;
    total_vectors?: number;
    dimension?: number;
  };
  watcher: {
    running: boolean;
    processed_count?: number;
    poll_interval_seconds?: number;
  };
}
