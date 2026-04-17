# System Architecture

> **Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm
> **Team:** Vertex

---

## 1. High-Level Architecture

The system follows a **source → ingest → process → act → verify** pipeline, with real-time feedback to the dashboard at every stage.

```mermaid
flowchart TB
    subgraph Sources["Intake Channels"]
        WA["WhatsApp\n(Voice/Text)"]
        WEB["Web Portal\n(Form/Upload)"]
        SAT["Satellite\n(Sentinel-2)"]
        CCTV["CCTV\n(Video Clips)"]
        SCAN["Scanned Letters\n(OCR)"]
    end

    subgraph N8N["n8n Webhook Layer"]
        WH["Webhook Receiver\n& Normalizer"]
    end

    subgraph API["FastAPI Gateway (Port 8000)"]
        REST["REST Endpoints\n(/complaints, /agents, /reports)"]
        WS["WebSocket Server\n(/ws/dashboard)"]
        AUTH["JWT Auth\nMiddleware"]
    end

    subgraph SWARM["LangGraph Agent Swarm (In-Process)"]
        direction TB
        ING["Ingestion\nAgent"]
        PRI["Priority\nAgent"]
        AUD["Systemic\nAuditor"]
        RES["Resolution\nAgent"]
        PRO["Proactive\nSensor"]
        VER["Verification\nAgent"]
    end

    subgraph DATA["Data Layer"]
        PG["PostgreSQL 16\n+ pgvector"]
        REDIS["Redis\n(Cache + PubSub)"]
        MINIO["MinIO\n(Media Storage)"]
    end

    subgraph EXT["External Services"]
        BHASHINI["Bhashini\n(Hindi STT)"]
        CLAUDE["Claude Sonnet\n(Reasoning)"]
        GEMINI["Gemini Flash\n(Vision)"]
        BROWSER["Browser-Use\n(Portal Filing)"]
    end

    subgraph FE["Next.js 15 Dashboard (Port 3000)"]
        CANVAS["Agent\nCanvas"]
        GRAPH["Knowledge\nGraph"]
        MAP["Hotspot\nMap"]
        DETAIL["Complaint\nDetail"]
    end

    Sources --> WH
    WH --> REST
    REST --> ING
    ING --> PRI
    PRI --> AUD
    AUD --> RES
    PRO --> ING
    RES --> VER
    RES --> BROWSER

    ING <--> BHASHINI
    PRI <--> CLAUDE
    AUD <--> CLAUDE
    RES <--> CLAUDE
    VER <--> GEMINI
    PRO <--> GEMINI

    SWARM <--> PG
    SWARM <--> REDIS
    SWARM <--> MINIO

    REDIS -- "PubSub" --> WS
    WS -- "Real-time\nUpdates" --> FE
    REST -- "REST API" --> FE
```

---

## 2. Data Flow — Complaint Lifecycle

A single complaint passes through the following stages from intake to verified resolution:

```mermaid
sequenceDiagram
    participant C as Citizen
    participant N as n8n
    participant A as FastAPI
    participant I as Ingestion Agent
    participant P as Priority Agent
    participant S as Systemic Auditor
    participant R as Resolution Agent
    participant V as Verification Agent
    participant O as Field Officer
    participant D as Dashboard

    C->>N: Submit complaint (voice/text/letter)
    N->>A: POST /api/v1/complaints (normalized payload)
    A->>I: Trigger LangGraph pipeline
    
    I->>I: OCR / STT / NLP processing
    I-->>D: Status: "Ingesting"
    I->>P: Structured complaint object
    
    P->>P: Impact Matrix scoring
    P-->>D: Status: "Triaging" + reasoning trace
    P->>S: Scored complaint
    
    S->>S: Vector similarity search
    S->>S: DBSCAN clustering
    S->>S: Root-cause hypothesis
    S-->>D: Status: "Analyzing" + knowledge graph update
    S->>R: Complaint + cluster context
    
    R->>R: Assign field officer
    R->>R: File on government portal (Browser-Use)
    R-->>D: Status: "Resolving" + browser session replay
    R->>O: Assignment notification
    
    O->>A: Upload verification photo
    A->>V: Trigger verification
    V->>V: Vision model comparison
    V-->>D: Status: "Verified" or "Rejected"
    
    D-->>C: Resolution notification
```

---

## 3. LangGraph State Machine

The agent swarm is implemented as a single LangGraph `StateGraph` with conditional edges:

```mermaid
stateDiagram-v2
    [*] --> Ingestion
    Ingestion --> Priority: complaint_parsed
    Priority --> Auditor: priority_scored
    Auditor --> Resolution: analysis_complete
    Resolution --> Verification: resolution_submitted
    Verification --> [*]: verified
    Verification --> Resolution: rejected (retry)
    
    Resolution --> Resolution: portal_filing_retry
    
    state Ingestion {
        [*] --> DetectModality
        DetectModality --> OCR: image
        DetectModality --> STT: audio
        DetectModality --> NLP: text
        OCR --> Normalize
        STT --> Normalize
        NLP --> Normalize
    }
    
    state Auditor {
        [*] --> EmbeddingSearch
        EmbeddingSearch --> ClusterAnalysis
        ClusterAnalysis --> RootCauseHypothesis
    }
```

**Key design decisions:**

- **Cyclic edges:** Resolution → Verification → Resolution allows retry loops for rejected verifications.
- **Resolution self-loop:** Portal filing retries up to 3 times before falling back to manual assignment.
- **State persistence:** LangGraph checkpoints every node transition to PostgreSQL. Crash at any point → resume from last checkpoint.

---

## 4. Real-Time Dashboard Architecture

The dashboard receives real-time updates via WebSocket, driven by Redis pub/sub:

```mermaid
flowchart LR
    subgraph Backend
        AGENT["LangGraph\nAgent Node"]
        REDIS["Redis\nPub/Sub"]
        WS["FastAPI\nWebSocket"]
    end

    subgraph Frontend
        HOOK["useWebSocket\nHook"]
        STORE["Zustand\nState Store"]
        CANVAS["Agent\nCanvas"]
        GRAPH["Knowledge\nGraph"]
    end

    AGENT -- "publish event" --> REDIS
    REDIS -- "subscribe" --> WS
    WS -- "push JSON" --> HOOK
    HOOK -- "update" --> STORE
    STORE -- "render" --> CANVAS
    STORE -- "render" --> GRAPH
```

**Event schema pushed to dashboard:**

```json
{
  "event": "agent_status_change",
  "data": {
    "complaint_id": "GRV-2026-00142",
    "agent": "systemic_auditor",
    "status": "processing",
    "payload": {
      "cluster_size": 47,
      "root_cause": "Pump Station 7 pressure drop",
      "confidence": 0.89
    }
  }
}
```

---

## 5. Network Topology (Docker Compose)

```mermaid
flowchart TB
    subgraph docker["Docker Network: civix-net"]
        FE["nextjs:3000"]
        API["fastapi:8000"]
        N8N["n8n:5678"]
        PG["postgres:5432"]
        REDIS["redis:6379"]
        MINIO["minio:9000"]
    end

    BROWSER["Host Browser"] --> FE
    BROWSER --> API
    BROWSER --> N8N

    FE --> API
    API --> PG
    API --> REDIS
    API --> MINIO
    N8N --> API

    style docker fill:#f9f9f9,stroke:#1c1c1e,stroke-width:2px
```

**Exposed ports:** Only `3000` (dashboard), `8000` (API), and `5678` (n8n) are mapped to the host. Database, cache, and storage are internal-only.

---

## 6. Proactive Sensing Pipeline

The Proactive Sensor Agent operates on a separate trigger (scheduled or manual) rather than citizen-initiated:

```mermaid
flowchart LR
    SAT["Sentinel-2\nImage Pair"] --> DINO["Grounding DINO\n(Zero-Shot Detection)"]
    CCTV["CCTV Clip\n(30s)"] --> GEM["Gemini Flash\n(Video Analysis)"]
    
    DINO --> DET{"Detection\nFound?"}
    GEM --> DET
    
    DET -- Yes --> AUTO["Auto-File\nGrievance"]
    DET -- No --> SKIP["No Action"]
    
    AUTO --> ING["→ Ingestion Agent\n(Normal Pipeline)"]
```

Detected issues enter the standard pipeline as grievances attributed to `source: proactive_sensor`.

---

## 7. Security Boundaries

```
┌─────────────────────────────────────────────────────────┐
│                    Public Internet                       │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Port 3000│  │ Port 8000│  │ Port 5678│              │
│  │ Next.js  │  │ FastAPI  │  │ n8n      │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │    JWT Auth  │             │                    │
├───────┼──────────────┼─────────────┼────────────────────┤
│       │  Docker Internal Network   │                    │
│       │              │             │                    │
│  ┌────┴──────────────┴─────────────┴────┐               │
│  │  PostgreSQL │  Redis  │  MinIO       │               │
│  │  (No external access)               │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## 8. References

- [Agent Swarm](AGENT_SWARM.md) — Detailed specifications for each LangGraph node.
- [API Spec](API_SPEC.md) — Endpoint contracts and payload schemas.
- [TRD](TRD.md) — Scalability and data governance requirements.
- [Tech Stack](TECHSTACK.md) — Technology selection rationale.
- [Feature Roadmap](features.md) — Feature scope and build order.
