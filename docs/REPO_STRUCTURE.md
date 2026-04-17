# Repository Structure

> Civix-Pulse monorepo layout — a multi-agent AI swarm for civic grievance resolution.

This document describes the complete directory tree, per-developer ownership boundaries, and the rationale behind key architectural decisions. For setup instructions see [`SETUP.md`](./SETUP.md). For the full system architecture see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Table of Contents

- [Directory Tree](#directory-tree)
- [Module Overview](#module-overview)
- [Key Design Decisions](#key-design-decisions)
- [Developer Ownership Boundaries](#developer-ownership-boundaries)
- [Related Documentation](#related-documentation)

---

## Directory Tree

```
civix-pulse/
│
├── README.md                             # Project overview, quickstart, and demo links
├── LICENSE                               # MIT license
├── AGENTS.md                             # AI coding-agent context (role, stack, rules)
├── docker-compose.yml                    # Full-stack orchestration (all 4 services + infra)
├── .env.example                          # Template for all required environment variables
├── .gitignore                            # Standard ignores for Python, Node, Docker, IDE
│
├── docs/                                 # Project documentation
│   ├── features.md                       # User-facing feature catalogue
│   ├── PRD.md                            # Product Requirements Document
│   ├── TRD.md                            # Technical Requirements Document
│   ├── TECHSTACK.md                      # Technology choices with justifications
│   ├── ARCHITECTURE.md                   # System architecture & data-flow diagrams
│   ├── AGENT_SWARM.md                    # Multi-agent pipeline design & prompts
│   ├── API_SPEC.md                       # REST & WebSocket API contract
│   ├── REPO_STRUCTURE.md                 # ← You are here
│   └── SETUP.md                          # Local development & Docker setup guide
│
├── backend/                              # Dev 1 (Lead) — Central Brain & Dispatch Engine
│   ├── Dockerfile                        # Python 3.12-slim, multi-stage build
│   ├── requirements.txt                  # Pinned Python dependencies
│   ├── main.py                           # FastAPI app factory, CORS, lifespan hooks
│   ├── config.py                         # pydantic-settings: typed env var loading
│   │
│   ├── api/                              # HTTP & WebSocket route handlers
│   │   ├── __init__.py
│   │   ├── analysis.py                   # POST /api/v1/trigger-analysis — pipeline entry
│   │   ├── officers.py                   # Officer CRUD, location updates, verification
│   │   ├── events.py                     # GET /api/v1/events, /events/{id}
│   │   ├── clusters.py                   # GET /api/v1/clusters — systemic patterns
│   │   ├── graph.py                      # GET /api/v1/graph — knowledge graph payload
│   │   ├── dashboard.py                  # GET /api/v1/dashboard/stats — KPIs
│   │   └── websocket.py                  # WebSocket connection manager (broadcast)
│   │
│   ├── swarm_logic/                      # Agent intelligence — separated from API layer
│   │   ├── __init__.py
│   │   ├── pipeline.py                   # Sequential orchestrator: ingest → cluster →
│   │   │                                 #   prioritise → dispatch → verify
│   │   ├── cluster_agent.py              # Pinecone similarity search + DBSCAN clustering
│   │   ├── priority_agent.py             # LangChain impact-matrix scoring
│   │   ├── spatial_agent.py              # PostGIS nearest-officer matching
│   │   ├── verification_agent.py         # Vision AI resolution verification
│   │   └── prompts/                      # Externalised LLM system prompts
│   │       ├── priority_prompt.txt       # City Planner persona for priority scoring
│   │       └── verification_prompt.txt   # Vision analyst persona for photo checks
│   │
│   ├── database/                         # Data access layer
│   │   ├── __init__.py
│   │   ├── models.py                     # SQLAlchemy + GeoAlchemy2 ORM models
│   │   ├── session.py                    # Async session factory (asyncpg)
│   │   └── seed.py                       # Seed script: 20 dummy field officers
│   │
│   ├── services/                         # Shared infrastructure clients
│   │   ├── __init__.py
│   │   ├── pinecone_client.py            # Pinecone SDK wrapper (upsert, query)
│   │   ├── redis_client.py               # Redis pub/sub for real-time events
│   │   └── storage.py                    # File storage abstraction (local / S3)
│   │
│   └── tests/                            # Backend test suite
│       ├── conftest.py                   # Fixtures: test DB, async client
│       ├── test_analysis.py              # Integration tests for analysis pipeline
│       ├── test_officers.py              # Officer endpoint tests
│       └── test_swarm/                   # Unit tests for individual agents
│
├── omnichannel-intake/                   # Dev 2 — Multimodal Ingestion Layer
│   ├── n8n-workflows/                    # n8n workflow definitions (importable JSON)
│   │   ├── whatsapp-intake.json          # WhatsApp voice/text → transcribe → embed → Pinecone
│   │   ├── web-intake.json               # Web form submission processing
│   │   └── ocr-intake.json              # Scanned/handwritten letter OCR pipeline
│   └── prompts/                          # LLM prompts used within n8n nodes
│       ├── classification_prompt.txt     # Complaint categorisation (water, road, etc.)
│       └── extraction_prompt.txt         # Named-entity extraction (location, dates)
│
├── command-center/                       # Dev 3 — Operational Dashboard
│   ├── Dockerfile                        # Node 20-alpine, multi-stage build
│   ├── package.json                      # Dependencies & scripts
│   ├── tsconfig.json                     # Strict TypeScript config
│   ├── tailwind.config.ts                # Monochromatic design tokens
│   ├── next.config.ts                    # Next.js 15 configuration
│   ├── public/                           # Static assets (favicon, icons)
│   ├── src/
│   │   ├── app/                          # Next.js App Router pages
│   │   │   ├── layout.tsx                # Root layout: fonts, providers, sidebar
│   │   │   ├── page.tsx                  # Dashboard home — KPI cards, live feed
│   │   │   ├── events/
│   │   │   │   ├── page.tsx              # Grievance event list (filterable table)
│   │   │   │   └── [id]/page.tsx         # Event detail: timeline, agent trace, map
│   │   │   ├── graph/page.tsx            # Knowledge graph — Cytoscape.js canvas
│   │   │   ├── map/page.tsx              # Spatial hotspot map — Leaflet overlay
│   │   │   └── agents/page.tsx           # Agent pipeline canvas — live status
│   │   ├── components/
│   │   │   ├── ui/                       # shadcn/ui primitives (Button, Card, Badge…)
│   │   │   ├── map-layer.tsx             # Leaflet map with officer position dots
│   │   │   ├── ingestion-feed.tsx        # Live complaint feed (WebSocket-driven)
│   │   │   ├── swarm-log.tsx             # Agent reasoning trace viewer
│   │   │   ├── agent-canvas.tsx          # Pipeline stage visualisation
│   │   │   ├── knowledge-graph.tsx       # Cytoscape.js interactive graph
│   │   │   └── dispatch-card.tsx         # Officer dispatch assignment card
│   │   ├── lib/
│   │   │   ├── api.ts                    # Typed fetch wrapper for backend API
│   │   │   ├── websocket.ts              # WebSocket connection & reconnect logic
│   │   │   └── utils.ts                  # cn() helper (clsx + tailwind-merge)
│   │   ├── store/
│   │   │   └── pulse-store.ts            # Zustand global state (events, agents, UI)
│   │   └── types/
│   │       ├── event.ts                  # GrievanceEvent, EventStatus interfaces
│   │       ├── officer.ts                # FieldOfficer, Location interfaces
│   │       └── graph.ts                  # GraphNode, GraphEdge interfaces
│   └── tests/                            # Frontend test suite
│
└── field-worker-app/                     # Dev 4 — Field Officer Mobile App
    ├── Dockerfile                        # Expo web build for containerised preview
    ├── package.json                      # Expo + React Native dependencies
    ├── app.json                          # Expo project configuration
    ├── App.js                            # Expo entry point & navigation setup
    ├── components/
    │   ├── ActiveTaskCard.js             # Current assignment display card
    │   ├── CameraScreen.js               # Photo capture for resolution verification
    │   └── NavigationView.js             # Turn-by-turn route to event location
    ├── services/
    │   ├── geolocation.js                # GPS tracking (5-second interval broadcast)
    │   ├── websocket.js                  # WebSocket sync with backend dispatch
    │   └── api.js                        # REST API client for task management
    └── screens/
        ├── HomeScreen.js                 # Task queue & officer status overview
        ├── TaskDetailScreen.js           # Full task context, map, priority badge
        └── VerificationScreen.js         # Photo upload & resolution confirmation
```

---

## Module Overview

| Module | Owner | Runtime | Purpose |
|---|---|---|---|
| `backend/` | Dev 1 (Lead) | Python 3.12 / FastAPI | Central API, swarm orchestration, spatial dispatch |
| `omnichannel-intake/` | Dev 2 | n8n (Node.js) | Multimodal ingestion — WhatsApp, web forms, scanned letters |
| `command-center/` | Dev 3 | Next.js 15 | Enterprise dashboard — real-time monitoring & analytics |
| `field-worker-app/` | Dev 4 | Expo (React Native) | Mobile app — task management, GPS tracking, photo verification |

Infrastructure services (PostgreSQL + PostGIS, Redis, Pinecone) are defined in `docker-compose.yml` and shared across all modules.

---

## Key Design Decisions

### 1. `swarm_logic/` Is Separated from `api/`

The agent intelligence layer (`swarm_logic/`) is intentionally decoupled from the HTTP route handlers (`api/`). This separation provides three benefits:

- **Testability** — Agent logic can be unit-tested in isolation without spinning up a FastAPI server or database.
- **Reusability** — The same pipeline can be invoked from REST endpoints, WebSocket handlers, background workers, or CLI scripts.
- **Clarity of ownership** — The `api/` layer owns request validation, serialisation, and auth; `swarm_logic/` owns reasoning, scoring, and dispatch decisions. Neither reaches into the other's domain.

This mirrors the clean-architecture principle of separating use cases from delivery mechanisms. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full data-flow diagram.

### 2. Prompts Are Stored as `.txt` Files

LLM system prompts are externalised into plain `.txt` files under `swarm_logic/prompts/` and `omnichannel-intake/prompts/` rather than being inlined as Python/JavaScript string literals.

- **Iteration speed** — Prompt engineers can edit prompts without touching application code or triggering a rebuild.
- **Version control** — Prompt diffs are human-readable in PRs; reviewers can evaluate prompt changes independently of logic changes.
- **Runtime hot-reload** — In development, prompts can be reloaded from disk without restarting the server, enabling rapid experimentation.
- **LLM-agnostic** — The same prompt file can be loaded by any orchestration framework (LangChain, n8n AI nodes, direct SDK calls).

### 3. Command Center Uses Next.js App Router

The `command-center/` dashboard is built on Next.js 15 with the App Router (not Pages Router) for the following reasons:

- **Nested layouts** — The dashboard requires a persistent sidebar and header across all pages; App Router's `layout.tsx` convention eliminates layout prop-drilling.
- **Server Components** — Initial dashboard data (KPIs, event lists) can be server-rendered for faster First Contentful Paint, while interactive panels (live feed, map) remain Client Components.
- **Streaming** — The `loading.tsx` convention enables progressive rendering of data-heavy pages (event detail, knowledge graph) without custom skeleton logic.
- **Colocation** — Route-level `page.tsx`, `layout.tsx`, and `loading.tsx` files keep concerns scoped to their route segment, reducing cross-page coupling.

### 4. Field Worker App Uses Expo (React Native)

The field officer mobile application is built with Expo rather than a PWA or native platform SDK:

- **Cross-platform from day one** — A single JavaScript codebase produces Android, iOS, and web builds, critical for a 48-hour hackathon timeline.
- **Native device APIs** — Expo provides managed access to camera, GPS, and push notifications without native module configuration.
- **Development speed** — Expo Go enables instant preview on physical devices via QR code, eliminating the compile-deploy cycle during rapid iteration.
- **Web fallback** — `expo export:web` produces a static web build that can be containerised (see `field-worker-app/Dockerfile`) for demo purposes when physical devices are unavailable.

---

## Developer Ownership Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│                       docker-compose.yml                     │
│                       .env.example                           │
│                       docs/                                  │
│                          Shared — all developers             │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│   Dev 1 (Lead)  │  │      Dev 2       │  │      Dev 3      │  │      Dev 4       │
│                 │  │                  │  │                 │  │                  │
│   backend/      │  │ omnichannel-     │  │ command-center/ │  │ field-worker-    │
│   ├── api/      │  │  intake/         │  │ ├── src/app/    │  │  app/            │
│   ├── swarm_    │  │ ├── n8n-         │  │ ├── src/        │  │ ├── screens/     │
│   │   logic/    │  │ │   workflows/   │  │ │   components/ │  │ ├── components/  │
│   ├── database/ │  │ └── prompts/     │  │ ├── src/lib/    │  │ └── services/    │
│   ├── services/ │  │                  │  │ ├── src/store/  │  │                  │
│   └── tests/    │  │                  │  │ └── src/types/  │  │                  │
└─────────────────┘  └──────────────────┘  └─────────────────┘  └──────────────────┘
```

**Contracts between modules:**

| Producer | Consumer | Contract |
|---|---|---|
| Dev 2 (`omnichannel-intake`) | Dev 1 (`backend`) | n8n webhook → `POST /api/v1/trigger-analysis` with standardised JSON payload |
| Dev 1 (`backend`) | Dev 3 (`command-center`) | REST API (`/api/v1/*`) + WebSocket events — see [`API_SPEC.md`](./API_SPEC.md) |
| Dev 1 (`backend`) | Dev 4 (`field-worker-app`) | REST API + WebSocket dispatch events |
| Dev 4 (`field-worker-app`) | Dev 1 (`backend`) | GPS location broadcasts + verification photo uploads |

Each developer can build and test their module independently. Cross-module integration is validated via `docker compose up` which starts all services simultaneously.

---

## Related Documentation

| Document | Description |
|---|---|
| [`features.md`](./features.md) | User-facing feature catalogue |
| [`PRD.md`](./PRD.md) | Product Requirements Document |
| [`TRD.md`](./TRD.md) | Technical Requirements Document |
| [`TECHSTACK.md`](./TECHSTACK.md) | Technology choices & justifications |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System architecture & data-flow diagrams |
| [`AGENT_SWARM.md`](./AGENT_SWARM.md) | Multi-agent pipeline design |
| [`API_SPEC.md`](./API_SPEC.md) | REST & WebSocket API contract |
| [`SETUP.md`](./SETUP.md) | Local development & Docker setup guide |
