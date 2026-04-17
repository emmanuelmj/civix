# System Architecture

**Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm  
**Version:** 1.0  
**Last Updated:** 2025-07-12

> Related docs: [TRD.md](./TRD.md) · [TECHSTACK.md](./TECHSTACK.md) · [AGENT_SWARM.md](./AGENT_SWARM.md) · [API_SPEC.md](./API_SPEC.md) · [features.md](./features.md)

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Complaint Lifecycle](#2-complaint-lifecycle)
3. [Swarm State Machine](#3-swarm-state-machine)
4. [Real-Time Dashboard Architecture](#4-real-time-dashboard-architecture)
5. [Docker Compose Network Topology](#5-docker-compose-network-topology)
6. [Security Boundaries](#6-security-boundaries)

---

## 1. High-Level Architecture

Four developer domains, connected through a centralized FastAPI backend. All heavy AI inference is offloaded to cloud APIs. Data flows left-to-right from citizen intake to officer resolution.

```mermaid
graph LR
    subgraph "Intake Channels"
        WA[WhatsApp]
        WEB[Web Form]
        VOICE[Voice Call]
        EMAIL[Email]
        LETTER[Handwritten Letter]
    end

    subgraph "Dev 2 — Omnichannel Intake"
        N8N[n8n Workflow Engine<br/>:5678]
        OCR[OCR Processing]
        STT[Bhashini STT]
        LLM_CLASS[LLM Classification]
    end

    subgraph "Cloud AI Services"
        PINECONE[(Pinecone<br/>Vector DB)]
        CLAUDE[Claude Sonnet<br/>Anthropic]
        GEMINI[Gemini Flash<br/>Google AI]
        BHASHINI_API[Bhashini API<br/>MeitY]
    end

    subgraph "Dev 1 — Backend"
        API[FastAPI<br/>:8000]
        LANG[LangChain<br/>Agent Pipeline]
        WS[WebSocket<br/>Server]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>+ PostGIS<br/>:5432)]
        REDIS[(Redis<br/>:6379)]
    end

    subgraph "Dev 3 — Command Center"
        DASH[Next.js Dashboard<br/>:3000]
        MAP[Leaflet Map]
        GRAPH[Cytoscape.js<br/>Knowledge Graph]
    end

    subgraph "Dev 4 — Field Worker App"
        MOBILE[Expo Mobile App<br/>:8081]
        CAM[Camera Module]
        GPS[GPS Tracker]
    end

    WA & WEB & VOICE & EMAIL & LETTER --> N8N
    N8N --> OCR & STT & LLM_CLASS
    STT -.-> BHASHINI_API
    N8N -->|POST /trigger-analysis| API
    N8N -->|embed + upsert| PINECONE

    API --> LANG
    LANG -->|similarity search| PINECONE
    LANG -->|priority scoring| CLAUDE
    LANG -->|spatial match| PG
    API --> WS
    WS -->|pub/sub| REDIS

    REDIS -->|broadcast| DASH
    REDIS -->|broadcast| MOBILE

    MOBILE -->|POST /officer/update-location| API
    MOBILE -->|POST /officer/verify-resolution| API
    CAM -->|verification photo| GEMINI
    GPS -->|5s pings| API

    API -->|audit log| PG
    API -->|cache| REDIS
```

### Domain Ownership

| Domain | Owner | Responsibilities | Dependencies |
|---|---|---|---|
| `omnichannel-intake/` | Dev 2 | n8n workflows, Pinecone ingestion, LLM prompts, OCR/STT | Bhashini API, Pinecone, n8n |
| `backend/` | Dev 1 | FastAPI server, LangChain swarm logic, PostGIS queries, WebSocket | PostgreSQL, Redis, Pinecone, Claude |
| `command-center/` | Dev 3 | Next.js dashboard, Leaflet map, Cytoscape knowledge graph | WebSocket (from backend), Redis |
| `field-worker-app/` | Dev 4 | Expo mobile app, camera verification, GPS tracking | REST API (backend), Gemini Flash |

---

## 2. Complaint Lifecycle

The complete journey of a citizen complaint through the system — from intake to verified resolution. Every numbered step produces an audit record (see [TRD.md §2.2](./TRD.md#22-audit-trail-requirements)).

```mermaid
sequenceDiagram
    actor Citizen
    participant n8n as n8n<br/>(Dev 2)
    participant API as FastAPI<br/>(Dev 1)
    participant Pinecone as Pinecone<br/>(Cloud)
    participant Claude as Claude Sonnet<br/>(Anthropic)
    participant PostGIS as PostgreSQL<br/>+ PostGIS
    participant Redis as Redis<br/>(Pub/Sub)
    participant Dashboard as Next.js<br/>(Dev 3)
    participant Mobile as Expo App<br/>(Dev 4)
    actor Officer

    Citizen->>n8n: Submit complaint<br/>(WhatsApp / Web / Voice / Letter)

    Note over n8n: Step 1 — Multimodal Ingestion
    n8n->>n8n: OCR / STT / LLM classify
    n8n->>Pinecone: Embed complaint vector
    n8n->>API: POST /api/v1/trigger-analysis<br/>{event_id, category, location, ...}

    Note over API: Step 2 — Cluster Detection
    API->>Pinecone: Similarity search<br/>(cosine > 0.85, 2km, 12h)
    Pinecone-->>API: Matching vectors (or empty)

    alt Cluster Found (≥3 similar events)
        API->>PostGIS: Link to Master Event
        API->>API: Escalate severity
    else New Isolated Event
        API->>API: Proceed as new event
    end

    Note over API: Step 3 — Priority Scoring
    API->>Claude: Evaluate as City Planner<br/>{description, category, cluster_size}
    Claude-->>API: {impact_score: 87,<br/>severity_color: "Red"}

    Note over API: Step 4 — Spatial Dispatch
    API->>PostGIS: ST_Distance query<br/>nearest officer with matching skills
    PostGIS-->>API: Officer ID + distance
    API->>PostGIS: UPDATE officer SET<br/>status = 'DISPATCHED'

    Note over API: Step 5 — Real-time Broadcast
    API->>Redis: PUBLISH dispatch_channel<br/>{type: NEW_DISPATCH, ...}
    Redis-->>Dashboard: WebSocket push
    Redis-->>Mobile: WebSocket push

    Dashboard->>Dashboard: Update map + swarm graph
    Mobile->>Officer: Push notification<br/>with dispatch details

    Note over Officer: Step 6 — Resolution & Verification
    Officer->>Officer: Travel to location<br/>(GPS tracked every 5s)
    Officer->>Mobile: Take verification photo
    Mobile->>API: POST /api/v1/officer/verify-resolution<br/>{photo, event_id}
    API->>API: Gemini Flash — verify photo
    
    alt Verified ✓
        API->>PostGIS: UPDATE event SET<br/>status = 'RESOLVED'
        API->>Redis: PUBLISH resolution_channel
        Redis-->>Dashboard: Update status
        API->>n8n: Trigger citizen notification
        n8n->>Citizen: WhatsApp message<br/>"Your issue has been resolved ✓"
    else Not Verified ✗
        API->>Mobile: REQUEST re-verification
        Note over Officer: Retry loop (max 3 attempts)
    end
```

### Lifecycle States

| State | Trigger | Next State |
|---|---|---|
| `RECEIVED` | Complaint ingested by n8n | `ANALYZING` |
| `ANALYZING` | Webhook hits FastAPI | `CLUSTERED` or `PRIORITIZED` |
| `CLUSTERED` | Linked to existing master event | `PRIORITIZED` |
| `PRIORITIZED` | Impact score assigned | `DISPATCHED` |
| `DISPATCHED` | Officer assigned via spatial match | `IN_PROGRESS` |
| `IN_PROGRESS` | Officer en route / on site | `PENDING_VERIFICATION` |
| `PENDING_VERIFICATION` | Officer uploads photo | `RESOLVED` or `RETRY_VERIFICATION` |
| `RESOLVED` | Photo verified by Gemini Flash | Terminal |
| `ESCALATED` | SLA breach or verification failure (3×) | Routed to `department_head` |

---

## 3. Swarm State Machine

The agent swarm operates as a finite state machine. Each node is an agent. Edges represent transitions triggered by the previous agent's output. Retry edges handle transient failures. See [AGENT_SWARM.md](./AGENT_SWARM.md) for agent-level detail.

```mermaid
stateDiagram-v2
    [*] --> Ingestion: Webhook received

    Ingestion --> ClusterCheck: Event parsed & validated
    
    ClusterCheck --> ClusterLink: cosine > 0.85<br/>& distance < 2km<br/>& within 12h
    ClusterCheck --> PriorityScoring: No cluster match
    ClusterCheck --> ClusterCheck: Pinecone timeout<br/>(retry ≤3)

    ClusterLink --> PriorityScoring: Master event updated

    PriorityScoring --> SpatialDispatch: Score assigned<br/>{impact_score, severity_color}
    PriorityScoring --> RuleBasedFallback: LLM API failure<br/>(retry ≤3)
    RuleBasedFallback --> SpatialDispatch: Fallback score assigned<br/>(confidence: 0.0)

    SpatialDispatch --> WebSocketBroadcast: Officer matched<br/>& status = DISPATCHED
    SpatialDispatch --> ManualQueue: No officer available<br/>within 10km radius

    WebSocketBroadcast --> AwaitingResolution: Dashboard + Mobile notified

    AwaitingResolution --> Verification: Officer uploads photo
    AwaitingResolution --> SLABreach: Time > SLA threshold

    Verification --> LoopClosure: Photo verified ✓
    Verification --> RetryVerification: Photo rejected ✗
    RetryVerification --> Verification: Retry (≤3 attempts)
    RetryVerification --> Escalation: Max retries exceeded

    SLABreach --> Escalation: Auto-escalate

    LoopClosure --> CitizenNotification: Resolution logged
    CitizenNotification --> [*]: WhatsApp sent ✓

    Escalation --> SpatialDispatch: Reassign to senior officer
    ManualQueue --> SpatialDispatch: Officer becomes available
```

### Agent Registry

| Agent | Type | Model | Timeout | Fallback |
|---|---|---|---|---|
| Ingestion Agent | Rule-based | — | 5s | Reject malformed payload |
| Cluster Agent | Hybrid (Pinecone + rules) | — | 10s | Skip clustering, proceed as new |
| Priority Agent | LLM-driven | Claude Sonnet | 15s | Rule-based scoring matrix |
| Spatial Matchmaker | Rule-based (SQL) | — | 5s | Expand search radius |
| Verification Agent | LLM-driven (vision) | Gemini Flash | 10s | Manual verification queue |
| Resolution Agent | Rule-based | — | 5s | — |

---

## 4. Real-Time Dashboard Architecture

Events flow from agent decisions through Redis pub/sub to the React dashboard in real-time. The architecture supports multiple concurrent dashboard sessions and the mobile app without additional WebSocket connections to the backend per client.

```mermaid
graph TB
    subgraph "Backend (Dev 1)"
        AGENT[Agent Pipeline<br/>LangChain]
        PUB[Redis Publisher]
        AGENT -->|agent decision| PUB
    end

    subgraph "Redis"
        PS[Pub/Sub Channels]
        PUB -->|PUBLISH| PS
    end

    subgraph "WebSocket Layer"
        WSS[WebSocket Server<br/>FastAPI]
        PS -->|SUBSCRIBE| WSS
    end

    subgraph "Command Center (Dev 3)"
        direction TB
        WS_CLIENT[WebSocket Client<br/>useWebSocket hook]
        ZUSTAND[Zustand Store]
        
        subgraph "React Components"
            MAP_COMP[MapView<br/>Leaflet]
            GRAPH_COMP[SwarmGraph<br/>Cytoscape.js]
            FEED_COMP[EventFeed<br/>Live Log]
            STATS_COMP[StatsPanel<br/>KPI Cards]
            AUDIT_COMP[AuditTrail<br/>Decision Log]
        end

        WSS -->|ws://localhost:8000/ws| WS_CLIENT
        WS_CLIENT -->|dispatch action| ZUSTAND
        ZUSTAND --> MAP_COMP
        ZUSTAND --> GRAPH_COMP
        ZUSTAND --> FEED_COMP
        ZUSTAND --> STATS_COMP
        ZUSTAND --> AUDIT_COMP
    end

    subgraph "Mobile App (Dev 4)"
        WS_MOBILE[WebSocket Client]
        DISPATCH_SCREEN[Dispatch Screen]
        WSS -->|ws://localhost:8000/ws| WS_MOBILE
        WS_MOBILE --> DISPATCH_SCREEN
    end
```

### WebSocket Event Schema

All WebSocket messages follow a consistent envelope:

```typescript
interface WebSocketEvent {
  type: 'NEW_EVENT' | 'CLUSTER_DETECTED' | 'PRIORITY_SCORED' | 'NEW_DISPATCH' | 'OFFICER_LOCATION' | 'VERIFICATION_RESULT' | 'RESOLUTION_COMPLETE';
  timestamp: string;       // ISO 8601
  event_id: string;        // EVT-YYYY-NNNNN
  payload: Record<string, unknown>;
  signature: string;       // HMAC-SHA256
}
```

### Zustand Store Slices

| Slice | State | Updated By |
|---|---|---|
| `events` | Map of event_id → EventData | `NEW_EVENT`, `CLUSTER_DETECTED`, `RESOLUTION_COMPLETE` |
| `officers` | Map of officer_id → OfficerData | `NEW_DISPATCH`, `OFFICER_LOCATION` |
| `swarmGraph` | Cytoscape elements (nodes + edges) | All agent decision events |
| `stats` | Aggregated KPIs (counts, averages) | Computed from `events` on each update |
| `auditLog` | Ordered list of audit records | All events (appended) |

---

## 5. Docker Compose Network Topology

All services run on a single Docker bridge network (`civix-net`). Only three ports are exposed to the host machine. Internal services communicate via Docker DNS hostnames.

```mermaid
graph TB
    subgraph "Host Machine (Dell Vostro 15 3000)"
        subgraph "Docker Network: civix-net"
            subgraph "Exposed to Host"
                BACKEND["backend<br/>:8000 → :8000<br/>FastAPI + WebSocket<br/>1.0 GB / 1.0 CPU"]
                DASHBOARD["command-center<br/>:3000 → :3000<br/>Next.js 15<br/>512 MB / 0.5 CPU"]
                N8N_SVC["n8n<br/>:5678 → :5678<br/>Workflow Engine<br/>512 MB / 0.5 CPU"]
            end

            subgraph "Internal Only"
                PG_SVC["postgres<br/>:5432 (internal)<br/>PostgreSQL 16 + PostGIS<br/>1.5 GB / 1.0 CPU"]
                REDIS_SVC["redis<br/>:6379 (internal)<br/>Redis 7-alpine<br/>256 MB / 0.25 CPU"]
            end

            subgraph "Dev Only"
                EXPO["field-worker-app<br/>:8081 (dev)<br/>Expo Dev Server<br/>256 MB / 0.25 CPU"]
            end
        end
    end

    subgraph "External (Cloud)"
        PINECONE_EXT[Pinecone API]
        CLAUDE_EXT[Anthropic API]
        GEMINI_EXT[Google AI API]
        BHASHINI_EXT[Bhashini API]
    end

    BACKEND --> PG_SVC
    BACKEND --> REDIS_SVC
    BACKEND --> PINECONE_EXT
    BACKEND --> CLAUDE_EXT
    N8N_SVC --> BACKEND
    N8N_SVC --> PINECONE_EXT
    N8N_SVC --> BHASHINI_EXT
    DASHBOARD --> BACKEND
    EXPO --> BACKEND
    BACKEND --> GEMINI_EXT

    style BACKEND fill:#1c1c1e,color:#fff
    style DASHBOARD fill:#1c1c1e,color:#fff
    style N8N_SVC fill:#1c1c1e,color:#fff
    style PG_SVC fill:#333,color:#fff
    style REDIS_SVC fill:#333,color:#fff
    style EXPO fill:#555,color:#fff
```

### Port Mapping

| Service | Container Port | Host Port | Protocol | Access |
|---|---|---|---|---|
| `backend` | 8000 | 8000 | HTTP + WebSocket | Public (API + WS) |
| `command-center` | 3000 | 3000 | HTTP | Public (Dashboard) |
| `n8n` | 5678 | 5678 | HTTP | Admin only |
| `postgres` | 5432 | — | TCP | Internal only |
| `redis` | 6379 | — | TCP | Internal only |
| `field-worker-app` | 8081 | 8081 | HTTP | Dev only |

### Docker Compose Service Dependencies

```yaml
# Startup order enforced by depends_on + healthcheck
services:
  postgres:    # starts first — no dependencies
  redis:       # starts first — no dependencies
  backend:     # depends_on: postgres, redis
  n8n:         # depends_on: backend (webhook target must be up)
  command-center:  # depends_on: backend (WebSocket source)
  field-worker-app: # depends_on: backend (API target)
```

---

## 6. Security Boundaries

Defense in depth — three concentric security zones. Untrusted traffic enters through the public zone, is authenticated at the API gateway, and only reaches internal services through the backend.

```mermaid
graph TB
    subgraph "Zone 1 — Public Internet"
        CITIZEN_BROWSER[Citizen Browser]
        OFFICER_PHONE[Officer Mobile Device]
        WHATSAPP_API[WhatsApp Business API]
        GOV_PORTAL[Government Portal]
    end

    subgraph "Zone 2 — DMZ (Exposed Ports)"
        direction TB
        FW[Firewall / Host iptables]

        NEXT[Next.js Dashboard<br/>:3000<br/>Static + SSR]
        FASTAPI[FastAPI Gateway<br/>:8000<br/>JWT Auth Layer]
        N8N_DMZ[n8n Admin UI<br/>:5678<br/>Basic Auth]
    end

    subgraph "Zone 3 — Internal Network (Docker Bridge)"
        direction TB
        PG_INT[(PostgreSQL + PostGIS<br/>:5432)]
        REDIS_INT[(Redis<br/>:6379)]

        subgraph "Sensitive Data"
            AUDIT[Audit Trail<br/>Append-only]
            PII[PII Store<br/>AES-256 Encrypted]
            SPATIAL[Spatial Data<br/>Officer Positions]
        end
    end

    subgraph "Zone 4 — Cloud APIs (Outbound Only)"
        ANTHROPIC[Anthropic API<br/>API Key Auth]
        GOOGLE[Google AI API<br/>API Key Auth]
        PINECONE_SEC[Pinecone API<br/>API Key Auth]
        BHASHINI_SEC[Bhashini API<br/>API Key + App ID]
    end

    CITIZEN_BROWSER -->|HTTPS| NEXT
    CITIZEN_BROWSER -->|HTTPS| FASTAPI
    OFFICER_PHONE -->|HTTPS + JWT| FASTAPI
    WHATSAPP_API -->|HTTPS webhook| N8N_DMZ
    GOV_PORTAL -.->|Browser-Use| FASTAPI

    FW --> NEXT
    FW --> FASTAPI
    FW --> N8N_DMZ

    NEXT -->|HTTP internal| FASTAPI
    N8N_DMZ -->|HTTP internal| FASTAPI

    FASTAPI -->|TCP :5432| PG_INT
    FASTAPI -->|TCP :6379| REDIS_INT
    PG_INT --> AUDIT
    PG_INT --> PII
    PG_INT --> SPATIAL

    FASTAPI -->|HTTPS outbound| ANTHROPIC
    FASTAPI -->|HTTPS outbound| GOOGLE
    FASTAPI -->|HTTPS outbound| PINECONE_SEC
    N8N_DMZ -->|HTTPS outbound| BHASHINI_SEC
    N8N_DMZ -->|HTTPS outbound| PINECONE_SEC
```

### Security Controls by Zone

| Zone | Controls | Details |
|---|---|---|
| **Zone 1 — Public** | TLS termination, rate limiting | All traffic over HTTPS. Rate limit: 100 req/min per IP on API endpoints. |
| **Zone 2 — DMZ** | JWT authentication, RBAC, input validation | Every API request authenticated via JWT bearer token. Role-based endpoint access (see [TRD.md §4.2](./TRD.md#42-role-based-access-control)). Pydantic v2 validates all request bodies. |
| **Zone 3 — Internal** | Network isolation, encryption at rest, append-only audit | PostgreSQL and Redis are not exposed to the host. PII encrypted with AES-256. Audit table has `INSERT`-only grants. No `UPDATE`/`DELETE` on audit records. |
| **Zone 4 — Cloud** | API key rotation, outbound-only | API keys stored as Docker secrets / environment variables. No inbound traffic from cloud APIs. Keys rotated every 90 days. |

### Threat Model Summary

| Threat | Mitigation |
|---|---|
| Unauthorized API access | JWT with 24h expiry + RBAC enforcement on every endpoint |
| SQL injection | Parameterized queries via SQLAlchemy ORM / asyncpg |
| XSS on dashboard | React default output encoding + CSP headers |
| Compromised verification photo | SHA-256 hash at upload, verified before AI analysis |
| Audit trail tampering | Append-only table, no UPDATE/DELETE grants, immutable records |
| PII exposure in logs | Tier 1 PII masked in application logs, never stored in Pinecone |
| Replay attacks on webhook | Idempotency-Key header with 24h Redis dedup window |
| Man-in-the-middle | TLS everywhere (external HTTPS, internal Docker network encryption optional) |

---

*For technology selection rationale, see [TECHSTACK.md](./TECHSTACK.md). For technical constraints and data governance, see [TRD.md](./TRD.md). For agent-level behavior specifications, see [AGENT_SWARM.md](./AGENT_SWARM.md).*
