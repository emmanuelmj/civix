# Civix-Pulse — API Specification

> **Version:** 1.0.0 · **Last updated:** 2025-07-14
> **Owner:** Dev 1 (Backend Lead) · **Related:** [AGENT_SWARM.md](./AGENT_SWARM.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [features.md](./features.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Base URL & Authentication](#base-url--authentication)
3. [Error Response Format](#error-response-format)
4. [REST Endpoints](#rest-endpoints)
   - [POST /api/v1/trigger-analysis](#1-post-apiv1trigger-analysis)
   - [POST /api/v1/officer/update-location](#2-post-apiv1officerupdate-location)
   - [POST /api/v1/officer/verify-resolution](#3-post-apiv1officerverify-resolution)
   - [GET /api/v1/events](#4-get-apiv1events)
   - [GET /api/v1/events/{event_id}](#5-get-apiv1eventsevent_id)
   - [GET /api/v1/officers](#6-get-apiv1officers)
   - [GET /api/v1/clusters](#7-get-apiv1clusters)
   - [GET /api/v1/graph](#8-get-apiv1graph)
   - [GET /api/v1/dashboard/stats](#9-get-apiv1dashboardstats)
5. [WebSocket API](#websocket-api)
   - [Connection](#websocket-connection)
   - [Event Types](#websocket-event-types)

---

## Overview

The Civix-Pulse backend exposes a FastAPI server on port `8000`. It provides REST endpoints consumed by:

| Consumer | Endpoints Used |
|---|---|
| **n8n workflows** (Dev 2) | `POST /trigger-analysis` |
| **Command Center** (Dev 3) | `GET /events`, `GET /officers`, `GET /clusters`, `GET /graph`, `GET /dashboard/stats`, WebSocket |
| **Field Worker App** (Dev 4) | `POST /officer/update-location`, `POST /officer/verify-resolution` |

All data mutations trigger real-time WebSocket broadcasts to connected dashboard and mobile clients.

---

## Base URL & Authentication

### Base URL

```
http://localhost:8000    # Local development
https://api.civix.app    # Production (future)
```

### Authentication

All endpoints (except WebSocket upgrade) require a JWT Bearer token in the `Authorization` header.

```
Authorization: Bearer <jwt_token>
```

**Token payload:**

```json
{
  "sub": "user-id-or-officer-id",
  "role": "ADMIN" | "OFFICER" | "SYSTEM",
  "exp": 1718640000
}
```

| Role | Access |
|---|---|
| `SYSTEM` | n8n service account — can call `POST /trigger-analysis` |
| `OFFICER` | Field officers — can call `POST /officer/*` endpoints |
| `ADMIN` | Dashboard users — full read access to all `GET` endpoints |

**WebSocket authentication:** Pass the JWT as a query parameter:

```
ws://localhost:8000/ws/dashboard?token=<jwt_token>
```

---

## Error Response Format

All error responses follow a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error description",
    "details": {
      "field": "event_id",
      "reason": "Must be a valid UUID v4"
    },
    "request_id": "req-a1b2c3d4",
    "timestamp": "2026-04-17T10:30:00Z"
  }
}
```

### Standard Error Codes

| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Request body or params failed validation |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT token |
| `403` | `FORBIDDEN` | Valid token but insufficient role |
| `404` | `NOT_FOUND` | Resource does not exist |
| `409` | `CONFLICT` | Resource state conflict (e.g., event already resolved) |
| `413` | `PAYLOAD_TOO_LARGE` | Upload exceeds size limit (see [Verification Agent](./AGENT_SWARM.md#agent-4--verification-agent)) |
| `422` | `UNPROCESSABLE_ENTITY` | Semantically invalid request |
| `429` | `RATE_LIMITED` | Too many requests — retry after `Retry-After` header |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
| `503` | `SERVICE_UNAVAILABLE` | Downstream dependency unavailable (Pinecone, OpenAI, PostGIS) |

---

## REST Endpoints

### 1. POST /api/v1/trigger-analysis

**Purpose:** Main webhook called by Dev 2's n8n workflow to trigger the full agent swarm pipeline. See [AGENT_SWARM.md — Inter-Agent Communication Pattern](./AGENT_SWARM.md#inter-agent-communication-pattern) for pipeline details.

**Auth:** `SYSTEM` role required.

#### Request

```
POST /api/v1/trigger-analysis?event_id=550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `event_id` | `string (UUID v4)` | ✅ | The event ID stored in Pinecone by Dev 2's ingestion pipeline |

**Request Body:** None — the event data is fetched from Pinecone using the `event_id`.

#### Response — `202 Accepted`

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING",
  "message": "Agent swarm pipeline initiated",
  "pipeline_id": "pipe-7f3a9c12",
  "estimated_completion_ms": 5000
}
```

#### Response — `200 OK` (Pipeline Complete)

When the pipeline completes within the request timeout:

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "DISPATCHED",
  "impact_score": 92,
  "severity_color": "Red",
  "is_clustered": true,
  "master_event_id": "master-evt-001",
  "assigned_officer": {
    "officer_id": "OP-441",
    "name": "Raj Kumar",
    "distance_km": 1.2
  },
  "traces": [
    {
      "agent_name": "cluster_analysis",
      "latency_ms": 340,
      "reasoning": "Matched to master event master-evt-001 with similarity 0.91. Cluster now contains 12 events within 1.8km radius."
    },
    {
      "agent_name": "priority_logic",
      "latency_ms": 1200,
      "reasoning": "Live exposed wire near school zone. Life safety risk is high (+38), vulnerable population (+15), time-critical (+10). Cluster of 12 amplifies systemic risk (+15)."
    },
    {
      "agent_name": "spatial_dispatch",
      "latency_ms": 85,
      "reasoning": "Officer OP-441 (Raj Kumar) is 1.2km away with ELECTRICAL domain skill and 0 active dispatches."
    }
  ]
}
```

#### Error Responses

| Status | When |
|---|---|
| `400` | Missing or invalid `event_id` query parameter |
| `404` | `event_id` not found in Pinecone |
| `503` | Pinecone or OpenAI unavailable |

---

### 2. POST /api/v1/officer/update-location

**Purpose:** Receives GPS pings from the Field Worker mobile app (Dev 4) to update an officer's real-time location in PostGIS.

**Auth:** `OFFICER` role required.

#### Request

```
POST /api/v1/officer/update-location
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

```json
{
  "officer_id": "OP-441",
  "lat": 17.4501,
  "lng": 78.3900,
  "accuracy_meters": 12.5,
  "battery_percent": 78,
  "timestamp": "2026-04-17T10:25:00Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `officer_id` | `string` | ✅ | Must match the JWT `sub` claim |
| `lat` | `float` | ✅ | Latitude (-90 to 90) |
| `lng` | `float` | ✅ | Longitude (-180 to 180) |
| `accuracy_meters` | `float` | ❌ | GPS accuracy reported by device |
| `battery_percent` | `int` | ❌ | Device battery level (0–100) |
| `timestamp` | `string (ISO 8601)` | ✅ | Client-side timestamp |

#### Response — `200 OK`

```json
{
  "officer_id": "OP-441",
  "location_updated": true,
  "active_dispatches": [
    {
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "distance_to_event_km": 0.8,
      "severity_color": "Red",
      "sla_deadline": "2026-04-17T11:00:00Z"
    }
  ]
}
```

#### Side Effects

- Updates `officers.location` in PostGIS
- Broadcasts `OFFICER_LOCATION_UPDATE` via WebSocket (see [WebSocket Events](#officer_location_update))

#### Error Responses

| Status | When |
|---|---|
| `400` | Invalid coordinates or missing required fields |
| `403` | `officer_id` does not match JWT `sub` |

---

### 3. POST /api/v1/officer/verify-resolution

**Purpose:** Officer submits a verification photo and GPS coordinates to prove an issue is resolved. Triggers the [Verification Agent](./AGENT_SWARM.md#agent-4--verification-agent).

**Auth:** `OFFICER` role required.

#### Request

```
POST /api/v1/officer/verify-resolution
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | `string (UUID v4)` | ✅ | The event being resolved |
| `officer_id` | `string` | ✅ | Must match JWT `sub` |
| `photo` | `file (JPEG/PNG)` | ✅ | Verification photo, max 10 MB |
| `lat` | `float` | ✅ | Officer's current latitude |
| `lng` | `float` | ✅ | Officer's current longitude |
| `notes` | `string` | ❌ | Officer's notes on the resolution |

#### Response — `200 OK` (Verified)

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "officer_id": "OP-441",
  "verified": true,
  "confidence": 0.94,
  "gps_match": true,
  "vision_analysis": "Photo shows a properly insulated and secured electrical junction box. The previously reported exposed wire has been enclosed in a weatherproof casing with visible grounding.",
  "resolved_at": "2026-04-17T10:30:00Z",
  "status": "RESOLVED"
}
```

#### Response — `200 OK` (Rejected)

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "officer_id": "OP-441",
  "verified": false,
  "confidence": 0.32,
  "gps_match": true,
  "vision_analysis": "Photo shows the same exposed wire with no visible repair. The issue does not appear to be resolved.",
  "resolved_at": null,
  "status": "IN_PROGRESS"
}
```

#### Response — `200 OK` (GPS Mismatch)

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "officer_id": "OP-441",
  "verified": false,
  "confidence": 0.0,
  "gps_match": false,
  "vision_analysis": "GPS verification failed. Officer is 2.4km from the event location. Photo analysis skipped.",
  "resolved_at": null,
  "status": "DISPATCHED"
}
```

#### Side Effects

- On `verified=true`: Broadcasts `RESOLUTION_VERIFIED` via WebSocket, triggers citizen notification via n8n webhook
- On `verified=false` with `gps_match=false`: No state change, officer can retry
- On `verified=false` with confidence 0.50–0.79: Flags for `MANUAL_REVIEW`

#### Error Responses

| Status | When |
|---|---|
| `400` | Missing required fields |
| `403` | `officer_id` does not match JWT `sub` |
| `404` | `event_id` not found or not assigned to this officer |
| `409` | Event is already `RESOLVED` |
| `413` | Photo exceeds 10 MB |

---

### 4. GET /api/v1/events

**Purpose:** Lists pulse events with filtering and pagination. Primary data source for the Command Center event table (Dev 3).

**Auth:** `ADMIN` role required.

#### Request

```
GET /api/v1/events?status=DISPATCHED&category=ELECTRICAL&severity=Red&page=1&limit=25
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | `string` | — | Filter by status: `NEW`, `ANALYZING`, `DISPATCHED`, `IN_PROGRESS`, `RESOLVED`, `ESCALATED` |
| `category` | `string` | — | Filter by category: `MUNICIPAL`, `ELECTRICAL`, `WATER`, `SANITATION`, `ROADS` |
| `severity` | `string` | — | Filter by severity: `Red`, `Orange`, `Yellow` |
| `is_clustered` | `boolean` | — | Filter clustered events only |
| `page` | `int` | `1` | Page number (1-indexed) |
| `limit` | `int` | `25` | Results per page (max 100) |
| `sort_by` | `string` | `created_at` | Sort field: `created_at`, `impact_score`, `updated_at` |
| `sort_order` | `string` | `desc` | `asc` or `desc` |

#### Response — `200 OK`

```json
{
  "events": [
    {
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "source": "311_CALL",
      "category": "ELECTRICAL",
      "raw_text": "Live wire hanging near Greenfield Public School entrance",
      "impact_score": 92,
      "severity_color": "Red",
      "status": "DISPATCHED",
      "is_clustered": true,
      "master_event_id": "master-evt-001",
      "coordinates": { "lat": 17.4482, "lng": 78.3914 },
      "assigned_officer": {
        "officer_id": "OP-441",
        "name": "Raj Kumar"
      },
      "created_at": "2026-04-17T09:45:00Z",
      "updated_at": "2026-04-17T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 142,
    "total_pages": 6
  }
}
```

---

### 5. GET /api/v1/events/{event_id}

**Purpose:** Returns full event detail including the complete agent trace log. Used by the Command Center event detail view and swarm log panel.

**Auth:** `ADMIN` role required.

#### Request

```
GET /api/v1/events/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <jwt_token>
```

#### Response — `200 OK`

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "311_CALL",
  "category": "ELECTRICAL",
  "raw_text": "Live wire hanging near Greenfield Public School entrance",
  "coordinates": { "lat": 17.4482, "lng": 78.3914 },
  "citizen_id": "CIT-8821",
  "submitted_at": "2026-04-17T09:45:00Z",

  "is_clustered": true,
  "master_event": {
    "master_event_id": "master-evt-001",
    "similarity_score": 0.91,
    "cluster_size": 12
  },

  "impact_score": 92,
  "severity_color": "Red",
  "priority_reasoning": "Live exposed wire near school zone. Life safety risk is high (+38), vulnerable population (+15), time-critical (+10). Cluster of 12 amplifies systemic risk (+15).",

  "assigned_officer": {
    "officer_id": "OP-441",
    "name": "Raj Kumar",
    "current_lat": 17.4501,
    "current_lng": 78.3900,
    "distance_km": 1.2,
    "domain_match": "ELECTRICAL"
  },
  "dispatch_status": "DISPATCHED",

  "verification": null,
  "status": "DISPATCHED",

  "traces": [
    {
      "agent_name": "cluster_analysis",
      "started_at": "2026-04-17T09:46:00.000Z",
      "completed_at": "2026-04-17T09:46:00.340Z",
      "latency_ms": 340,
      "reasoning": "Matched to master event master-evt-001 with similarity 0.91. Cluster now contains 12 events within 1.8km radius.",
      "model": "text-embedding-3-small",
      "error": null
    },
    {
      "agent_name": "priority_logic",
      "started_at": "2026-04-17T09:46:00.341Z",
      "completed_at": "2026-04-17T09:46:01.541Z",
      "latency_ms": 1200,
      "reasoning": "Live exposed wire near school zone. Life safety risk is high (+38), vulnerable population (+15), time-critical (+10). Cluster of 12 amplifies systemic risk (+15).",
      "model": "gpt-4o",
      "error": null
    },
    {
      "agent_name": "spatial_dispatch",
      "started_at": "2026-04-17T09:46:01.542Z",
      "completed_at": "2026-04-17T09:46:01.627Z",
      "latency_ms": 85,
      "reasoning": "Officer OP-441 (Raj Kumar) is 1.2km away with ELECTRICAL domain skill and 0 active dispatches.",
      "model": null,
      "error": null
    }
  ],

  "created_at": "2026-04-17T09:45:00Z",
  "updated_at": "2026-04-17T09:46:02Z"
}
```

#### Error Responses

| Status | When |
|---|---|
| `404` | Event not found |

---

### 6. GET /api/v1/officers

**Purpose:** Lists all field officers with their current status, location, and active dispatch count. Powers the officer map layer in the Command Center (Dev 3).

**Auth:** `ADMIN` role required.

#### Request

```
GET /api/v1/officers?status=AVAILABLE&domain=ELECTRICAL
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | `string` | — | `AVAILABLE`, `DISPATCHED`, `EN_ROUTE`, `OFF_DUTY`, `UNRESPONSIVE` |
| `domain` | `string` | — | Filter by domain skill: `MUNICIPAL`, `ELECTRICAL`, `WATER`, `SANITATION`, `ROADS` |

#### Response — `200 OK`

```json
{
  "officers": [
    {
      "officer_id": "OP-441",
      "name": "Raj Kumar",
      "status": "AVAILABLE",
      "domain_skills": ["ELECTRICAL", "MUNICIPAL"],
      "current_lat": 17.4501,
      "current_lng": 78.3900,
      "active_dispatches": 0,
      "last_location_update": "2026-04-17T10:25:00Z",
      "battery_percent": 78
    },
    {
      "officer_id": "OP-112",
      "name": "Priya Sharma",
      "status": "DISPATCHED",
      "domain_skills": ["WATER", "SANITATION"],
      "current_lat": 17.4320,
      "current_lng": 78.4010,
      "active_dispatches": 2,
      "last_location_update": "2026-04-17T10:24:30Z",
      "battery_percent": 45
    }
  ],
  "total": 2
}
```

---

### 7. GET /api/v1/clusters

**Purpose:** Lists detected systemic clusters (Master Events) with their constituent events. Used by the [Cluster Analysis Agent](./AGENT_SWARM.md#agent-1--cluster-analysis-agent) insights panel in the Command Center.

**Auth:** `ADMIN` role required.

#### Request

```
GET /api/v1/clusters?min_size=3&status=ACTIVE
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `min_size` | `int` | `3` | Minimum events in the cluster |
| `status` | `string` | — | `ACTIVE` (unresolved) or `RESOLVED` |
| `category` | `string` | — | Filter by event category |

#### Response — `200 OK`

```json
{
  "clusters": [
    {
      "master_event_id": "master-evt-001",
      "category": "ELECTRICAL",
      "root_cause_hypothesis": "Possible transformer failure in Sector 7 affecting overhead lines within 1.8km radius",
      "cluster_size": 12,
      "severity_color": "Red",
      "avg_impact_score": 84,
      "centroid": { "lat": 17.4490, "lng": 78.3920 },
      "radius_km": 1.8,
      "first_reported_at": "2026-04-17T06:30:00Z",
      "last_reported_at": "2026-04-17T09:45:00Z",
      "status": "ACTIVE",
      "event_ids": [
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440001",
        "770e8400-e29b-41d4-a716-446655440002"
      ],
      "assigned_officers": ["OP-441", "OP-223"]
    }
  ],
  "total": 1
}
```

---

### 8. GET /api/v1/graph

**Purpose:** Returns a knowledge graph representation of events, clusters, officers, and their relationships for the interactive graph visualization in the Command Center dashboard (Dev 3).

**Auth:** `ADMIN` role required.

#### Request

```
GET /api/v1/graph?depth=2&center_event_id=550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <jwt_token>
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `depth` | `int` | `2` | Traversal depth from center node |
| `center_event_id` | `string` | — | Optional — center the graph on a specific event |
| `category` | `string` | — | Filter nodes by category |

#### Response — `200 OK`

```json
{
  "nodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "EVENT",
      "label": "Live wire near school",
      "severity_color": "Red",
      "impact_score": 92,
      "status": "DISPATCHED",
      "coordinates": { "lat": 17.4482, "lng": 78.3914 }
    },
    {
      "id": "master-evt-001",
      "type": "CLUSTER",
      "label": "Electrical cluster — Sector 7",
      "severity_color": "Red",
      "cluster_size": 12,
      "coordinates": { "lat": 17.4490, "lng": 78.3920 }
    },
    {
      "id": "OP-441",
      "type": "OFFICER",
      "label": "Raj Kumar",
      "status": "DISPATCHED",
      "coordinates": { "lat": 17.4501, "lng": 78.3900 }
    }
  ],
  "edges": [
    {
      "source": "550e8400-e29b-41d4-a716-446655440000",
      "target": "master-evt-001",
      "type": "MEMBER_OF",
      "weight": 0.91
    },
    {
      "source": "550e8400-e29b-41d4-a716-446655440000",
      "target": "OP-441",
      "type": "ASSIGNED_TO",
      "weight": 1.0
    }
  ]
}
```

### Node Types

| Type | Description |
|---|---|
| `EVENT` | Individual pulse event / grievance |
| `CLUSTER` | Master Event representing a systemic cluster |
| `OFFICER` | Field officer |

### Edge Types

| Type | Description | Weight |
|---|---|---|
| `MEMBER_OF` | Event belongs to a cluster | Cosine similarity (0.0–1.0) |
| `ASSIGNED_TO` | Event is assigned to an officer | `1.0` (binary) |
| `SIMILAR_TO` | Two events are semantically similar | Cosine similarity |

---

### 9. GET /api/v1/dashboard/stats

**Purpose:** Returns aggregate statistics for the Command Center dashboard header cards (Dev 3). Designed for polling every 10 seconds or driven by WebSocket updates.

**Auth:** `ADMIN` role required.

#### Request

```
GET /api/v1/dashboard/stats
Authorization: Bearer <jwt_token>
```

#### Response — `200 OK`

```json
{
  "total_events": 342,
  "events_by_status": {
    "NEW": 5,
    "ANALYZING": 2,
    "DISPATCHED": 18,
    "IN_PROGRESS": 31,
    "RESOLVED": 274,
    "ESCALATED": 12
  },
  "events_by_severity": {
    "Red": 14,
    "Orange": 45,
    "Yellow": 283
  },
  "events_by_category": {
    "MUNICIPAL": 89,
    "ELECTRICAL": 64,
    "WATER": 78,
    "SANITATION": 56,
    "ROADS": 55
  },
  "active_clusters": 4,
  "officers_available": 12,
  "officers_dispatched": 8,
  "officers_total": 24,
  "avg_resolution_time_minutes": 47.3,
  "sla_compliance_percent": 91.2,
  "events_last_24h": 28,
  "resolution_rate_percent": 80.1,
  "updated_at": "2026-04-17T10:30:00Z"
}
```

---

## WebSocket API

### WebSocket Connection

**URL:**

```
ws://localhost:8000/ws/dashboard?token=<jwt_token>
```

**Authentication:** JWT passed as the `token` query parameter. The server validates the token on connection upgrade. Invalid or expired tokens receive a `4001` close code.

**Heartbeat:** The server sends a `PING` frame every 30 seconds. Clients must respond with `PONG` within 10 seconds or the connection is closed.

**Reconnection:** Clients should implement exponential backoff reconnection: 1s → 2s → 4s → 8s → 16s (max).

### Message Envelope

All WebSocket messages follow a consistent envelope:

```json
{
  "event_type": "EVENT_TYPE_NAME",
  "timestamp": "2026-04-17T10:30:00Z",
  "data": { }
}
```

---

### WebSocket Event Types

#### NEW_DISPATCH

Broadcast when the [Spatial Dispatch Agent](./AGENT_SWARM.md#agent-3--spatial-dispatch-agent) assigns an officer to an event.

**Consumers:** Command Center (map update, event table), Field Worker App (new assignment notification).

```json
{
  "event_type": "NEW_DISPATCH",
  "timestamp": "2026-04-17T10:00:00Z",
  "data": {
    "pulse_event": {
      "event_id": "550e8400-e29b-41d4-a716-446655440000",
      "category": "MUNICIPAL",
      "raw_text": "Large pothole on MG Road causing traffic congestion",
      "impact_score": 92,
      "severity_color": "#FF0000",
      "coordinates": { "lat": 17.4482, "lng": 78.3914 },
      "is_clustered": false,
      "master_event_id": null
    },
    "assigned_officer": {
      "officer_id": "OP-441",
      "name": "Raj Kumar",
      "current_lat": 17.4501,
      "current_lng": 78.3900,
      "distance_km": 1.2,
      "domain_match": "MUNICIPAL"
    },
    "sla_deadline": "2026-04-17T10:30:00Z"
  }
}
```

---

#### RESOLUTION_VERIFIED

Broadcast when the [Verification Agent](./AGENT_SWARM.md#agent-4--verification-agent) confirms a resolution.

**Consumers:** Command Center (status update, stats refresh), n8n (citizen notification trigger).

```json
{
  "event_type": "RESOLUTION_VERIFIED",
  "timestamp": "2026-04-17T10:30:00Z",
  "data": {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "officer_id": "OP-441",
    "verified": true,
    "confidence": 0.94,
    "vision_analysis": "Photo shows completed repair with proper insulation.",
    "resolved_at": "2026-04-17T10:30:00Z"
  }
}
```

---

#### OFFICER_LOCATION_UPDATE

Broadcast when an officer sends a GPS ping via `POST /api/v1/officer/update-location`.

**Consumers:** Command Center (officer map layer, proximity indicators).

```json
{
  "event_type": "OFFICER_LOCATION_UPDATE",
  "timestamp": "2026-04-17T10:25:00Z",
  "data": {
    "officer_id": "OP-441",
    "name": "Raj Kumar",
    "lat": 17.4501,
    "lng": 78.3900,
    "status": "EN_ROUTE",
    "active_dispatches": 1,
    "battery_percent": 78
  }
}
```

---

#### CLUSTER_DETECTED

Broadcast when the [Cluster Analysis Agent](./AGENT_SWARM.md#agent-1--cluster-analysis-agent) identifies a new systemic cluster or an existing cluster crosses the `MIN_CLUSTER_SIZE` threshold.

**Consumers:** Command Center (cluster alert banner, graph view update).

```json
{
  "event_type": "CLUSTER_DETECTED",
  "timestamp": "2026-04-17T09:46:00Z",
  "data": {
    "master_event_id": "master-evt-001",
    "category": "ELECTRICAL",
    "cluster_size": 5,
    "centroid": { "lat": 17.4490, "lng": 78.3920 },
    "radius_km": 1.8,
    "root_cause_hypothesis": "Multiple electrical complaints concentrated near Sector 7 transformer station",
    "triggering_event_id": "550e8400-e29b-41d4-a716-446655440000",
    "severity_color": "Red"
  }
}
```

---

#### SLA_BREACH

Broadcast when a dispatched event exceeds its SLA deadline without officer acknowledgment. SLA thresholds are defined in the [Spatial Dispatch Agent configuration](./AGENT_SWARM.md#configuration-parameters-2).

**Consumers:** Command Center (SLA alert, escalation indicator), Admin notification system.

```json
{
  "event_type": "SLA_BREACH",
  "timestamp": "2026-04-17T11:00:00Z",
  "data": {
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "severity_color": "Red",
    "sla_deadline": "2026-04-17T10:30:00Z",
    "breach_duration_minutes": 30,
    "assigned_officer": {
      "officer_id": "OP-441",
      "name": "Raj Kumar",
      "status": "UNRESPONSIVE"
    },
    "escalation_action": "RE_DISPATCH",
    "new_officer": {
      "officer_id": "OP-223",
      "name": "Anita Desai"
    }
  }
}
```

---

## Appendix: Severity Color Mapping

The `severity_color` field uses both named values and hex codes depending on context:

| Named | Hex | Usage |
|---|---|---|
| `Yellow` | `#FFD600` | REST responses, database storage |
| `Orange` | `#FF9500` | REST responses, database storage |
| `Red` | `#FF0000` | REST responses, database storage |

WebSocket `NEW_DISPATCH` events use the hex code in `severity_color` for direct rendering in the dashboard. All other contexts use the named value. The Command Center (Dev 3) maintains a mapping for consistent rendering.
