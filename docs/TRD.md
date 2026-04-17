# Technical Requirements Document

**Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm  
**Version:** 1.0  
**Last Updated:** 2025-07-12  
**Status:** Active Development (Hackathon)

> Related docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECHSTACK.md](./TECHSTACK.md) · [AGENT_SWARM.md](./AGENT_SWARM.md) · [API_SPEC.md](./API_SPEC.md) · [features.md](./features.md)

---

## Table of Contents

1. [System Architecture Constraints](#1-system-architecture-constraints)
2. [Data Governance](#2-data-governance)
3. [Scalability](#3-scalability)
4. [Security](#4-security)
5. [Integration Specifications](#5-integration-specifications)
6. [Testing Strategy](#6-testing-strategy)

---

## 1. System Architecture Constraints

### 1.1 Deployment Model

Civix-Pulse runs as a Docker Compose stack on a single host during development, with a clear path to Kubernetes for production. All services communicate over a shared Docker bridge network (`civix-net`). No service-mesh overhead — direct container-to-container networking via Docker DNS.

| Property | Value |
|---|---|
| Orchestration | Docker Compose v3.8 |
| Target Host | Dell Vostro 15 3000 (8 GB RAM, 4-core CPU) |
| Total Container Budget | ~5 GB RAM, 4 vCPUs shared |
| External Dependencies | Cloud-hosted APIs only (Anthropic, Google AI, Pinecone, Bhashini) |
| Local Persistence | PostgreSQL + PostGIS (volume-mounted) |
| Cache Layer | Redis 7 (in-memory, no persistence) |

### 1.2 Service Boundaries

The monorepo is divided into four independently deployable units, each owned by one developer. See [ARCHITECTURE.md §1](./ARCHITECTURE.md#1-high-level-architecture) for the full topology.

| Service | Owner | Runtime | Exposed Port | Internal Port |
|---|---|---|---|---|
| `backend` | Dev 1 | Python 3.12 / Uvicorn | `8000` | `8000` |
| `command-center` | Dev 3 | Node 20 / Next.js 15 | `3000` | `3000` |
| `field-worker-app` | Dev 4 | Expo Dev Server | `8081` | `8081` |
| `postgres` | — | PostgreSQL 16 + PostGIS 3.4 | — | `5432` |
| `redis` | — | Redis 7-alpine | — | `6379` |
| `n8n` | Dev 2 | n8n self-hosted | `5678` | `5678` |

### 1.3 In-Process AI Execution

LangChain runs **in-process** within the FastAPI backend — there is no separate AI microservice. This eliminates network overhead for agent orchestration and simplifies the deployment model.

```
FastAPI (Uvicorn worker)
 └── /api/v1/trigger-analysis
      └── LangChain RunnableSequence
           ├── Pinecone similarity search (cloud API call)
           ├── Priority Agent (Claude Sonnet API call)
           ├── Spatial Matchmaker (PostGIS SQL query)
           └── WebSocket broadcast (Redis pub/sub)
```

**Why in-process:** At hackathon scale (~100 concurrent events), a single Uvicorn worker with async I/O handles the load without the complexity of a task queue. All heavy computation (LLM inference, vector search, OCR) is offloaded to cloud APIs. The Python process itself only orchestrates.

### 1.4 Cloud-Hosted Services

| Service | Hosting | Purpose | Latency Budget |
|---|---|---|---|
| Pinecone | Managed (us-east-1) | Vector similarity search, cluster detection | < 200 ms |
| Anthropic (Claude Sonnet) | API | Priority scoring, reasoning | < 3 s |
| Google AI (Gemini Flash) | API | Photo verification (vision) | < 2 s |
| Bhashini | API | Hindi speech-to-text | < 5 s |

---

## 2. Data Governance

### 2.1 PII Classification

All data entering the system is classified into one of three tiers at ingestion time by the n8n intake workflow.

| Tier | Classification | Examples | Handling |
|---|---|---|---|
| **Tier 1 — Restricted** | Direct PII | Name, phone number, Aadhaar, address | Encrypted at rest (AES-256). Masked in logs. Never stored in Pinecone. Access restricted to `admin` role. |
| **Tier 2 — Internal** | Indirect PII | GPS coordinates, officer ID, complaint location | Stored in PostGIS. Access restricted to `officer` + `department_head` + `admin`. |
| **Tier 3 — Public** | Aggregated / Anonymized | Cluster heat maps, resolution statistics, severity trends | Available to all authenticated roles. Used in dashboard visualizations. |

### 2.2 Audit Trail Requirements

Every agent decision is logged as an immutable audit record. This is the core governance primitive — judges will evaluate the system on its ability to explain *why* each decision was made.

**Rule:** No agent action may proceed without first writing an audit record. The audit log is append-only; records are never updated or deleted.

#### Audit Record JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentAuditRecord",
  "type": "object",
  "required": [
    "record_id",
    "timestamp",
    "agent_name",
    "action",
    "inputs",
    "reasoning",
    "output",
    "confidence",
    "event_id",
    "duration_ms"
  ],
  "properties": {
    "record_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for this audit record."
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of when the decision was made."
    },
    "agent_name": {
      "type": "string",
      "enum": [
        "ingestion_agent",
        "cluster_agent",
        "priority_agent",
        "spatial_matchmaker",
        "verification_agent",
        "resolution_agent"
      ],
      "description": "Which agent in the swarm produced this record."
    },
    "action": {
      "type": "string",
      "description": "Human-readable action label, e.g. 'cluster_check', 'priority_score', 'officer_dispatch'."
    },
    "inputs": {
      "type": "object",
      "description": "Complete inputs provided to the agent for this decision. Tier 1 PII fields must be redacted."
    },
    "reasoning": {
      "type": "string",
      "description": "LLM chain-of-thought or rule-based explanation of why this output was produced."
    },
    "output": {
      "type": "object",
      "description": "Structured output of the agent decision."
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Agent's self-assessed confidence score (0.0–1.0)."
    },
    "event_id": {
      "type": "string",
      "description": "The grievance event this decision pertains to."
    },
    "duration_ms": {
      "type": "integer",
      "description": "Wall-clock execution time in milliseconds."
    },
    "parent_record_id": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "Links to the previous agent's audit record in the pipeline, forming a decision chain."
    },
    "model_version": {
      "type": ["string", "null"],
      "description": "LLM model identifier used, e.g. 'claude-sonnet-4-20250514'. Null for rule-based agents."
    }
  }
}
```

#### Example Audit Record

```json
{
  "record_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timestamp": "2025-07-12T14:30:00Z",
  "agent_name": "priority_agent",
  "action": "priority_score",
  "inputs": {
    "event_id": "EVT-2025-00123",
    "category": "water_supply",
    "description": "No water supply in Block C for 3 days",
    "affected_population_estimate": 450,
    "source_channel": "whatsapp"
  },
  "reasoning": "As a City Planner, I assess this as high-impact: water supply disruption affecting ~450 residents for 72+ hours constitutes a public health risk. The duration exceeds the 24-hour threshold for critical infrastructure. Cross-referencing with 3 similar complaints in a 2km radius suggests systemic failure.",
  "output": {
    "impact_score": 87,
    "severity_color": "Red",
    "recommended_department": "water_works",
    "escalation_required": true
  },
  "confidence": 0.92,
  "event_id": "EVT-2025-00123",
  "duration_ms": 2340,
  "parent_record_id": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
  "model_version": "claude-sonnet-4-20250514"
}
```

### 2.3 Data Retention Policy

| Data Category | Retention Period | Storage | Deletion Method |
|---|---|---|---|
| Audit trail records | Indefinite (regulatory) | PostgreSQL | Never deleted |
| Grievance event metadata | 3 years | PostgreSQL + Pinecone | Soft delete (archived flag) |
| Citizen PII (Tier 1) | 1 year post-resolution | PostgreSQL (encrypted) | Hard delete with crypto-shredding |
| Verification photos | 6 months post-resolution | Object storage (S3-compatible) | Hard delete |
| Officer GPS traces | 30 days | PostgreSQL | Hard delete (batch job) |
| Redis cache entries | 24 hours (TTL) | Redis | Auto-eviction |
| WebSocket event logs | 7 days | Application logs | Log rotation |

---

## 3. Scalability

### 3.1 Load Profile

| Metric | Hackathon Demo | Production Target |
|---|---|---|
| Concurrent grievances in pipeline | 10–20 | 5,000 |
| Events ingested per hour | 50 | 10,000 |
| WebSocket connections | 5–10 | 500 |
| Officer GPS pings per second | 2–5 | 200 |
| Pinecone queries per minute | 20 | 2,000 |
| LLM API calls per minute | 10 | 500 |

### 3.2 Horizontal Scaling Strategy

The system is designed for vertical scaling at hackathon phase with a clear horizontal scaling path.

**Phase 1 — Hackathon (Single Host)**
- 1× Uvicorn worker, async I/O for all external calls
- PostgreSQL with connection pooling (max 20 connections)
- Redis single-instance for pub/sub and caching

**Phase 2 — Pilot Deployment**
- Uvicorn behind Nginx with 4 workers
- Read replicas for PostgreSQL
- Redis Cluster (3 nodes) for pub/sub fan-out
- Celery task queue for LLM calls exceeding 5s timeout

**Phase 3 — City-Scale Production**
- Kubernetes with Horizontal Pod Autoscaler on CPU/memory
- Pinecone pod-based index (p1.x1) for dedicated throughput
- PostgreSQL with Citus for distributed spatial queries
- CDN for static assets (Next.js)

### 3.3 Local Hardware Optimization

Resource limits per container on the Dell Vostro 15 3000 (8 GB RAM total, ~5 GB for Docker):

| Container | Memory Limit | CPU Limit | Notes |
|---|---|---|---|
| `backend` | 1.0 GB | 1.0 CPU | Uvicorn + LangChain in-process |
| `command-center` | 512 MB | 0.5 CPU | Next.js production build (static export preferred) |
| `postgres` | 1.5 GB | 1.0 CPU | PostGIS spatial queries are memory-intensive |
| `redis` | 256 MB | 0.25 CPU | Cache-only, no persistence |
| `n8n` | 512 MB | 0.5 CPU | Workflow engine |
| `field-worker-app` | 256 MB | 0.25 CPU | Expo dev server (dev only) |
| **Total** | **~4.0 GB** | **3.5 CPU** | Leaves ~1 GB headroom for OS |

**Optimization rules:**
- All LLM inference is cloud API — zero local GPU/CPU cost for AI.
- Use `python:3.12-slim` base images (< 150 MB) instead of full Python images.
- Multi-stage Docker builds to exclude dev dependencies from production images.
- PostgreSQL `shared_buffers` tuned to 384 MB (25% of container limit).
- Redis `maxmemory` set to 200 MB with `allkeys-lru` eviction policy.

---

## 4. Security

### 4.1 Authentication — JWT

All API endpoints (except health checks) require a valid JWT bearer token.

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Token Lifetime | 24 hours (access), 7 days (refresh) |
| Issuer | `civix-pulse-backend` |
| Audience | `civix-pulse` |
| Storage (frontend) | `httpOnly` secure cookie |
| Storage (mobile) | Expo SecureStore |

#### JWT Payload Schema

```json
{
  "sub": "usr_abc123",
  "role": "officer",
  "department": "water_works",
  "iat": 1720800000,
  "exp": 1720886400,
  "iss": "civix-pulse-backend",
  "aud": "civix-pulse"
}
```

### 4.2 Role-Based Access Control

| Role | Dashboard | Dispatch | Verify | Audit Logs | Admin |
|---|---|---|---|---|---|
| `citizen` | — | — | — | — | — |
| `officer` | Read | Self | Self | — | — |
| `department_head` | Read | Department | Department | Read | — |
| `admin` | Full | Full | Full | Full | Full |

**Endpoint-level enforcement:**

```python
# FastAPI dependency injection pattern
from fastapi import Depends, Security
from app.auth import require_role

@router.post("/api/v1/trigger-analysis")
async def trigger_analysis(
    payload: TriggerAnalysisRequest,
    user: User = Security(require_role, scopes=["admin", "department_head"])
):
    ...
```

### 4.3 Input Validation

All request bodies are validated through Pydantic v2 models with strict type coercion. See [API_SPEC.md](./API_SPEC.md) for complete endpoint schemas.

**Validation rules:**
- All string inputs are stripped and length-limited (max 5,000 chars for descriptions).
- GPS coordinates are range-validated (latitude: -90 to 90, longitude: -180 to 180).
- File uploads are type-checked (MIME allowlist: `image/jpeg`, `image/png`, `image/webp`) and size-limited (10 MB).
- Event IDs follow the pattern `EVT-YYYY-NNNNN` and are validated via regex.
- SQL injection prevented by parameterized queries (SQLAlchemy ORM / asyncpg).
- XSS mitigated by React's default output encoding and server-side HTML sanitization.

### 4.4 Content Integrity

| Mechanism | Scope | Implementation |
|---|---|---|
| Photo hash verification | Verification photos | SHA-256 hash computed at upload, stored in DB, verified before vision AI analysis |
| Audit record immutability | Agent decisions | Append-only table with `INSERT`-only grants; no `UPDATE`/`DELETE` permissions |
| WebSocket message signing | Real-time events | HMAC-SHA256 signature on each broadcast payload |
| API request idempotency | Webhook ingestion | `Idempotency-Key` header with 24-hour dedup window in Redis |

---

## 5. Integration Specifications

### 5.1 External API Inventory

| API | Provider | Purpose | Auth Method | Rate Limit | Fallback |
|---|---|---|---|---|---|
| Claude Sonnet | Anthropic | Priority scoring, reasoning chains | API key (header) | 60 RPM | Retry 3× with exponential backoff → degrade to rule-based scoring |
| Gemini Flash | Google AI | Photo verification (vision) | API key (header) | 120 RPM | Retry 2× → manual verification queue |
| Pinecone | Pinecone.io | Vector similarity search | API key (header) | 100 QPS | Cache recent vectors in Redis → skip cluster check |
| Bhashini | MeitY | Hindi speech-to-text | API key + app ID | 30 RPM | Queue for retry → flag for manual transcription |
| Browser-Use | Self-hosted | Government portal filing (Playwright) | Local process | N/A | Skip portal filing → create manual task |

### 5.2 Fallback Strategy

Every external integration follows a three-tier degradation pattern:

```
Tier 1: Primary API call with timeout
  ↓ failure
Tier 2: Retry with exponential backoff (max 3 attempts, base 1s)
  ↓ failure  
Tier 3: Graceful degradation (rule-based fallback or manual queue)
```

All fallback activations are logged as audit records with `agent_name: "fallback_handler"` and `confidence: 0.0`.

### 5.3 n8n Webhook Contract

The webhook payload sent from n8n (Dev 2) to FastAPI (Dev 1) at `POST /api/v1/trigger-analysis` must conform to the following schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "n8nWebhookPayload",
  "type": "object",
  "required": [
    "event_id",
    "source_channel",
    "category",
    "description",
    "location",
    "timestamp"
  ],
  "properties": {
    "event_id": {
      "type": "string",
      "pattern": "^EVT-\\d{4}-\\d{5}$",
      "description": "Unique event identifier assigned by n8n."
    },
    "source_channel": {
      "type": "string",
      "enum": ["whatsapp", "web_form", "voice_call", "email", "handwritten_letter", "portal_scrape"],
      "description": "The intake channel through which the complaint was received."
    },
    "category": {
      "type": "string",
      "enum": [
        "water_supply", "sanitation", "roads", "electricity",
        "public_safety", "pollution", "drainage", "streetlights", "other"
      ],
      "description": "Complaint category determined by LLM classification in n8n."
    },
    "description": {
      "type": "string",
      "maxLength": 5000,
      "description": "Cleaned complaint text (post-OCR/STT processing)."
    },
    "location": {
      "type": "object",
      "required": ["lat", "lng"],
      "properties": {
        "lat": { "type": "number", "minimum": -90, "maximum": 90 },
        "lng": { "type": "number", "minimum": -180, "maximum": 180 },
        "address": { "type": "string", "description": "Human-readable address (optional)." },
        "ward": { "type": "string", "description": "Municipal ward identifier (optional)." }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of when the complaint was originally received."
    },
    "citizen_id": {
      "type": ["string", "null"],
      "description": "Anonymized citizen reference. Null for anonymous complaints."
    },
    "attachments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["image", "audio", "document"] },
          "url": { "type": "string", "format": "uri" },
          "mime_type": { "type": "string" }
        }
      },
      "description": "Media attachments from the complaint."
    },
    "pinecone_vector_id": {
      "type": ["string", "null"],
      "description": "If n8n has already embedded the complaint, the Pinecone vector ID is provided here."
    },
    "metadata": {
      "type": "object",
      "description": "Additional key-value metadata from the source channel.",
      "additionalProperties": true
    }
  }
}
```

#### Example Webhook Payload

```json
{
  "event_id": "EVT-2025-00456",
  "source_channel": "whatsapp",
  "category": "water_supply",
  "description": "No water supply in Block C, Sector 22 for the last 3 days. Multiple families affected.",
  "location": {
    "lat": 28.6139,
    "lng": 77.2090,
    "address": "Block C, Sector 22, New Delhi",
    "ward": "W-14"
  },
  "timestamp": "2025-07-12T09:15:00Z",
  "citizen_id": "CIT-anon-789",
  "attachments": [
    {
      "type": "image",
      "url": "https://storage.civix.app/uploads/dry-tap-photo.jpg",
      "mime_type": "image/jpeg"
    }
  ],
  "pinecone_vector_id": "vec_abc123",
  "metadata": {
    "whatsapp_message_id": "wamid.xyz",
    "language_detected": "hi"
  }
}
```

---

## 6. Testing Strategy

### 6.1 Testing Pyramid

```
          ╱ Visual / E2E ╲          ← Playwright (critical paths only)
         ╱   Contract      ╲        ← Pact (n8n ↔ FastAPI, FastAPI ↔ Dashboard)
        ╱   Integration     ╲       ← TestContainers (PostGIS, Redis)
       ╱     Unit Tests      ╲      ← pytest, Vitest (fast, isolated)
      ╱━━━━━━━━━━━━━━━━━━━━━━━╲
```

### 6.2 Unit Tests

| Component | Framework | Coverage Target | Key Areas |
|---|---|---|---|
| `backend/` | pytest + pytest-asyncio | 80% | Pydantic models, LangChain prompt templates, spatial query builders |
| `command-center/` | Vitest + React Testing Library | 70% | Component rendering, Zustand store mutations, WebSocket message parsing |
| `field-worker-app/` | Jest + React Native Testing Library | 60% | Service functions, GPS utilities, camera permission flows |

**LangChain-specific testing:** Mock LLM responses using `FakeLLM` from `langchain_community.llms.fake` to test prompt templates and output parsers without API calls.

### 6.3 Integration Tests

| Test Scope | Tool | What It Validates |
|---|---|---|
| PostGIS spatial queries | pytest + testcontainers-python | `ST_Distance`, `ST_DWithin` queries return correct officer matches |
| Redis pub/sub fan-out | pytest + fakeredis | WebSocket broadcast reaches all subscribed clients |
| Pinecone similarity search | pytest + mock server | Cluster detection at cosine > 0.85 threshold |
| End-to-end pipeline | Docker Compose + pytest | Full webhook → cluster → priority → dispatch → broadcast flow |

### 6.4 Contract Tests

Contract tests ensure the interfaces between independently developed services remain compatible.

| Contract | Consumer | Provider | Schema |
|---|---|---|---|
| n8n → FastAPI webhook | `omnichannel-intake` (Dev 2) | `backend` (Dev 1) | `n8nWebhookPayload` (§5.3) |
| FastAPI → Dashboard WebSocket | `backend` (Dev 1) | `command-center` (Dev 3) | `WebSocketEvent` schema |
| FastAPI → Mobile push | `backend` (Dev 1) | `field-worker-app` (Dev 4) | `DispatchNotification` schema |

### 6.5 Visual / E2E Tests

| Test | Tool | Purpose |
|---|---|---|
| Dashboard critical path | Playwright | Login → view map → click event → see audit trail |
| Responsive layout | Playwright viewport presets | Dashboard renders correctly at 1366×768 (target laptop resolution) |
| Accessibility | axe-core via Playwright | WCAG 2.1 AA compliance on dashboard |

### 6.6 CI Pipeline

```
push/PR → lint (ruff + eslint) → unit tests → integration tests → contract tests → build Docker images
```

All tests must pass before merging to `main`. Visual tests run nightly.

---

*This document is the single source of truth for technical constraints. For architecture diagrams, see [ARCHITECTURE.md](./ARCHITECTURE.md). For technology selection rationale, see [TECHSTACK.md](./TECHSTACK.md).*
