# API Specification

> **Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm
> **Team:** Vertex
> **Base URL:** `http://localhost:8000/api/v1`

---

## Overview

The Civix-Pulse API is a RESTful service built with FastAPI. All endpoints produce and consume `application/json` unless otherwise noted. Authentication is via JWT Bearer tokens. Interactive documentation is available at `/docs` (Swagger UI) and `/redoc`.

---

## Authentication

### POST `/auth/login`

Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "email": "officer@civix.gov.in",
  "password": "string"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "usr-001",
    "email": "officer@civix.gov.in",
    "role": "officer",
    "name": "Ramesh Kumar",
    "department": "water",
    "ward": "Ward 12"
  }
}
```

**Roles:** `citizen`, `officer`, `department_head`, `admin`

---

## Complaints

### POST `/complaints`

Submit a new grievance. Triggers the LangGraph agent pipeline.

**Headers:** `Authorization: Bearer <token>` (optional for citizen submissions via n8n)

**Request:**
```json
{
  "source": "whatsapp",
  "text": "Water pressure is very low since 3 days in Jayanagar 4th block",
  "audio_url": null,
  "image_url": null,
  "location": {
    "lat": 12.9250,
    "lng": 77.5938
  },
  "language": "en",
  "citizen_id": "cit-00421"
}
```

**Response (201):**
```json
{
  "complaint_id": "GRV-2026-00142",
  "status": "ingesting",
  "message": "Complaint received. Agent pipeline initiated.",
  "created_at": "2026-04-17T07:30:00Z"
}
```

### GET `/complaints`

List complaints with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | all | Filter: `ingesting`, `triaging`, `analyzing`, `resolving`, `verifying`, `resolved`, `failed` |
| `priority` | string | all | Filter: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `category` | string | all | Filter: `water`, `electricity`, `roads`, `sanitation`, `other` |
| `ward` | string | all | Filter by ward name |
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Results per page (max 100) |
| `sort` | string | `-created_at` | Sort field. Prefix with `-` for descending. |

**Response (200):**
```json
{
  "complaints": [
    {
      "complaint_id": "GRV-2026-00142",
      "text_en": "Water pressure is very low since 3 days in Jayanagar 4th block",
      "category": "water",
      "subcategory": "low_pressure",
      "status": "analyzing",
      "priority": {
        "level": "HIGH",
        "score": 7.4
      },
      "location": { "lat": 12.9250, "lng": 77.5938 },
      "ward": "Ward 12",
      "source": "whatsapp",
      "assigned_officer": "usr-007",
      "sla_deadline": "2026-04-20T07:30:00Z",
      "cluster_id": "cluster-047",
      "created_at": "2026-04-17T07:30:00Z",
      "updated_at": "2026-04-17T07:31:15Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "pages": 8
  }
}
```

### GET `/complaints/{complaint_id}`

Get full details for a single complaint, including agent traces.

**Response (200):**
```json
{
  "complaint_id": "GRV-2026-00142",
  "raw_input": {
    "source": "whatsapp",
    "text": "Water pressure is very low since 3 days in Jayanagar 4th block",
    "language": "en"
  },
  "parsed_complaint": {
    "text_en": "Water pressure is very low since 3 days in Jayanagar 4th block",
    "category": "water",
    "subcategory": "low_pressure",
    "location": { "lat": 12.9250, "lng": 77.5938 },
    "ward": "Ward 12",
    "extracted_entities": {
      "landmark": "Jayanagar 4th block",
      "duration": "3 days"
    }
  },
  "priority": {
    "overall_score": 7.4,
    "priority_level": "HIGH",
    "factors": {
      "severity": { "score": 7, "reason": "Water pressure affects daily needs." },
      "blast_radius": { "score": 8, "reason": "Entire block likely affected." },
      "vulnerability": { "score": 6, "reason": "Residential area with mixed demographics." },
      "sentiment_urgency": { "score": 7, "reason": "Duration emphasis suggests growing frustration." },
      "time_decay": { "score": 5, "reason": "3-day duration, moderate decay." }
    },
    "recommended_sla_hours": 72,
    "vulnerability_flags": []
  },
  "cluster": {
    "cluster_id": "cluster-047",
    "cluster_size": 47,
    "is_systemic": true,
    "root_cause_hypothesis": "Pump Station 7 pressure drop — fixing it would likely resolve 47 complaints.",
    "infrastructure_entity": "Pump Station 7",
    "confidence": 0.89
  },
  "resolution": {
    "assigned_officer_id": "usr-007",
    "portal_filing_status": "submitted",
    "portal_submission_id": "BWSSB-2026-8841",
    "playwright_trace_url": "https://minio.local/traces/grv-142-trace.zip",
    "sla_deadline": "2026-04-20T07:30:00Z",
    "sla_hours": 72
  },
  "verification": null,
  "traces": [
    {
      "trace_id": "trc-001",
      "agent": "ingestion_agent",
      "timestamp": "2026-04-17T07:30:02Z",
      "reasoning": "Text input detected. Language: English. Category classified as 'water/low_pressure'.",
      "confidence": 0.95,
      "latency_ms": 820
    },
    {
      "trace_id": "trc-002",
      "agent": "priority_agent",
      "timestamp": "2026-04-17T07:30:04Z",
      "reasoning": "Impact score: 7.4/10. Elevated due to blast radius (entire block) and 3-day duration.",
      "confidence": 0.88,
      "latency_ms": 1240
    }
  ],
  "status": "resolving",
  "created_at": "2026-04-17T07:30:00Z",
  "updated_at": "2026-04-17T07:31:15Z"
}
```

---

## Verification

### POST `/complaints/{complaint_id}/verify`

Upload a verification photo for a resolved complaint.

**Headers:** `Authorization: Bearer <token>` (officer role required)

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `photo` | file | Yes | JPEG/PNG image (max 10MB) |
| `notes` | string | No | Officer's notes on resolution |

**Response (200):**
```json
{
  "complaint_id": "GRV-2026-00142",
  "verification": {
    "resolved": true,
    "confidence": 0.92,
    "reason": "Photo shows restored water flow at the tap. Pressure appears normal.",
    "photo_url": "https://minio.local/verify/grv-142-verify.jpg",
    "verified_at": "2026-04-18T14:22:00Z"
  },
  "status": "resolved"
}
```

---

## Agents

### GET `/agents/status`

Get real-time status of all agent nodes in the swarm.

**Response (200):**
```json
{
  "agents": [
    {
      "name": "ingestion_agent",
      "status": "idle",
      "complaints_processed": 142,
      "avg_latency_ms": 950,
      "last_active": "2026-04-17T07:31:00Z"
    },
    {
      "name": "priority_agent",
      "status": "processing",
      "active_complaint": "GRV-2026-00143",
      "complaints_processed": 141,
      "avg_latency_ms": 1180,
      "last_active": "2026-04-17T07:31:15Z"
    },
    {
      "name": "systemic_auditor",
      "status": "idle",
      "complaints_processed": 140,
      "clusters_found": 12,
      "avg_latency_ms": 2340,
      "last_active": "2026-04-17T07:30:55Z"
    },
    {
      "name": "resolution_agent",
      "status": "idle",
      "complaints_processed": 138,
      "portal_filings": 95,
      "avg_latency_ms": 8500,
      "last_active": "2026-04-17T07:30:30Z"
    },
    {
      "name": "proactive_sensor",
      "status": "idle",
      "detections": 7,
      "last_scan": "2026-04-17T06:00:00Z"
    },
    {
      "name": "verification_agent",
      "status": "idle",
      "verified": 82,
      "rejected": 11,
      "avg_latency_ms": 1800,
      "last_active": "2026-04-17T07:25:00Z"
    }
  ]
}
```

### GET `/agents/traces/{complaint_id}`

Get all agent reasoning traces for a specific complaint.

**Response (200):**
```json
{
  "complaint_id": "GRV-2026-00142",
  "traces": [
    {
      "trace_id": "trc-001",
      "agent": "ingestion_agent",
      "timestamp": "2026-04-17T07:30:02Z",
      "inputs": { "source": "whatsapp", "language": "en" },
      "reasoning": "Text input detected. Category: water/low_pressure.",
      "output": { "category": "water", "subcategory": "low_pressure" },
      "confidence": 0.95,
      "model": "claude-sonnet-4-20250514",
      "latency_ms": 820
    }
  ]
}
```

---

## Clusters

### GET `/clusters`

List all detected systemic clusters.

**Response (200):**
```json
{
  "clusters": [
    {
      "cluster_id": "cluster-047",
      "complaint_count": 47,
      "root_cause_hypothesis": "Pump Station 7 pressure drop",
      "infrastructure_entity": "Pump Station 7",
      "category": "water",
      "confidence": 0.89,
      "ward": "Ward 12",
      "first_detected": "2026-04-15T10:00:00Z",
      "status": "active"
    }
  ]
}
```

### GET `/clusters/{cluster_id}`

Get cluster details with all member complaints.

**Response (200):**
```json
{
  "cluster_id": "cluster-047",
  "root_cause_hypothesis": "Pump Station 7 pressure drop — 47 complaints within a 1.5km radius over 5 days, all reporting low water pressure.",
  "infrastructure_entity": "Pump Station 7",
  "confidence": 0.89,
  "recommended_action": "Dispatch maintenance team to inspect Pump Station 7 pressure regulators.",
  "complaints": ["GRV-2026-00096", "GRV-2026-00101", "GRV-2026-00142"],
  "center_location": { "lat": 12.9250, "lng": 77.5938 },
  "radius_km": 1.5
}
```

---

## Knowledge Graph

### GET `/graph`

Get the full knowledge graph for dashboard rendering.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ward` | string | all | Filter by ward |
| `category` | string | all | Filter by complaint category |
| `depth` | int | 2 | Graph traversal depth from root nodes |

**Response (200):**
```json
{
  "nodes": [
    { "id": "GRV-2026-00142", "type": "complaint", "label": "Low water pressure...", "priority": "HIGH" },
    { "id": "cluster-047", "type": "root_cause", "label": "Pump Station 7 Failure" },
    { "id": "dept-water", "type": "department", "label": "Water Supply Dept" },
    { "id": "usr-007", "type": "officer", "label": "Ramesh Kumar" }
  ],
  "edges": [
    { "source": "GRV-2026-00142", "target": "cluster-047", "relation": "caused_by" },
    { "source": "cluster-047", "target": "dept-water", "relation": "assigned_to" },
    { "source": "GRV-2026-00142", "target": "usr-007", "relation": "assigned_to" }
  ]
}
```

---

## Proactive Sensing

### POST `/sensing/satellite`

Trigger satellite image analysis for a specific area.

**Request:**
```json
{
  "image_before_url": "https://minio.local/satellite/ward12-before.tif",
  "image_after_url": "https://minio.local/satellite/ward12-after.tif",
  "ward": "Ward 12",
  "detection_targets": ["garbage pile", "waterlogging", "road damage"]
}
```

**Response (200):**
```json
{
  "detections": [
    {
      "issue": "waterlogging",
      "confidence": 0.87,
      "bounding_box": { "x": 120, "y": 340, "w": 200, "h": 150 },
      "auto_filed_complaint": "GRV-2026-00155"
    }
  ]
}
```

### POST `/sensing/cctv`

Trigger CCTV footage analysis.

**Request:**
```json
{
  "video_url": "https://minio.local/cctv/zone4-cam3-clip.mp4",
  "location": { "lat": 12.9350, "lng": 77.6100 },
  "ward": "Ward 14"
}
```

**Response (200):**
```json
{
  "detections": [
    {
      "issue": "open manhole",
      "severity": 9,
      "confidence": 0.91,
      "timestamp_in_video": "00:12",
      "auto_filed_complaint": "GRV-2026-00156"
    }
  ]
}
```

---

## Reports

### GET `/reports/executive`

Generate an executive summary report.

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `period` | string | `7d` | Report period: `24h`, `7d`, `30d` |
| `format` | string | `json` | Output: `json` or `pdf` |

**Response (200 — JSON):**
```json
{
  "period": "2026-04-10 to 2026-04-17",
  "total_complaints": 142,
  "resolved": 82,
  "pending": 60,
  "avg_resolution_hours": 18.5,
  "sla_compliance_rate": 0.87,
  "systemic_clusters": 12,
  "proactive_detections": 7,
  "top_categories": [
    { "category": "water", "count": 58 },
    { "category": "roads", "count": 34 },
    { "category": "sanitation", "count": 28 }
  ],
  "department_performance": [
    { "department": "Water Supply", "avg_hours": 14.2, "sla_rate": 0.92 },
    { "department": "Roads", "avg_hours": 22.8, "sla_rate": 0.78 }
  ]
}
```

---

## WebSocket

### WS `/ws/dashboard`

Real-time event stream for the dashboard Agent Canvas and Knowledge Graph.

**Connection:** `ws://localhost:8000/ws/dashboard?token=<jwt>`

**Event Types:**

```json
{"event": "agent_status_change", "data": {"complaint_id": "...", "agent": "...", "status": "..."}}
{"event": "priority_scored", "data": {"complaint_id": "...", "score": 7.4, "level": "HIGH"}}
{"event": "cluster_detected", "data": {"cluster_id": "...", "size": 47, "root_cause": "..."}}
{"event": "resolution_filed", "data": {"complaint_id": "...", "portal_id": "BWSSB-2026-8841"}}
{"event": "verification_complete", "data": {"complaint_id": "...", "resolved": true}}
{"event": "graph_update", "data": {"nodes": [...], "edges": [...]}}
{"event": "sla_breach", "data": {"complaint_id": "...", "hours_overdue": 4.5}}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "COMPLAINT_NOT_FOUND",
    "message": "Complaint GRV-2026-99999 does not exist.",
    "status": 404
  }
}
```

| Status | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request body failed Pydantic validation |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Role does not have permission for this action |
| 404 | `NOT_FOUND` | Resource does not exist |
| 413 | `FILE_TOO_LARGE` | Upload exceeds size limit |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `AGENT_UNAVAILABLE` | LLM provider is unreachable |

---

## References

- [Architecture](ARCHITECTURE.md) — System design showing API Gateway placement.
- [Agent Swarm](AGENT_SWARM.md) — Agent node specifications triggered by these endpoints.
- [TRD](TRD.md) — Performance and security requirements.
