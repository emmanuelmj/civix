# Repository Structure

> **Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm
> **Team:** Vertex

---

## Overview

The repository follows a **monorepo layout** with clear separation between frontend, backend, agent logic, and infrastructure configuration. Every directory has a single responsibility.

---

## Directory Tree

```
civix/
├── README.md                          # Project overview and quick start
├── LICENSE                            # MIT License
├── AGENTS.md                          # Agent context document
├── docker-compose.yml                 # Full-stack orchestration
├── .env.example                       # Environment variable template
├── .gitignore
│
├── docs/                              # Documentation suite
│   ├── features.md                    # Tier-wise feature roadmap
│   ├── PRD.md                         # Product Requirements Document
│   ├── TRD.md                         # Technical Requirements Document
│   ├── TECHSTACK.md                   # Technology selection rationale
│   ├── ARCHITECTURE.md                # System design + Mermaid diagrams
│   ├── AGENT_SWARM.md                 # LangGraph node specifications
│   ├── API_SPEC.md                    # FastAPI endpoint contracts
│   ├── REPO_STRUCTURE.md              # This file
│   └── SETUP.md                       # Local execution guide
│
├── backend/                           # Python backend (FastAPI + LangGraph)
│   ├── Dockerfile                     # Backend container image
│   ├── pyproject.toml                 # Python dependencies (uv/pip)
│   ├── requirements.txt              # Pinned dependencies
│   │
│   ├── app/                           # FastAPI application
│   │   ├── __init__.py
│   │   ├── main.py                    # App factory, middleware, lifespan
│   │   ├── config.py                  # Settings via pydantic-settings
│   │   │
│   │   ├── api/                       # API route handlers
│   │   │   ├── __init__.py
│   │   │   ├── complaints.py          # /complaints CRUD + pipeline trigger
│   │   │   ├── agents.py             # /agents status + traces
│   │   │   ├── clusters.py           # /clusters endpoints
│   │   │   ├── graph.py              # /graph knowledge graph data
│   │   │   ├── verification.py       # /complaints/{id}/verify
│   │   │   ├── reports.py            # /reports executive summary
│   │   │   ├── auth.py               # /auth login + JWT
│   │   │   └── websocket.py          # /ws/dashboard real-time stream
│   │   │
│   │   ├── models/                    # Pydantic schemas + SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── complaint.py           # Complaint schema (request/response/DB)
│   │   │   ├── agent_trace.py         # Agent trace schema
│   │   │   ├── cluster.py             # Cluster schema
│   │   │   ├── user.py                # User + Officer schema
│   │   │   └── graph.py               # Knowledge graph node/edge schema
│   │   │
│   │   ├── services/                  # Business logic (non-agent)
│   │   │   ├── __init__.py
│   │   │   ├── complaint_service.py   # Complaint CRUD operations
│   │   │   ├── auth_service.py        # JWT generation + validation
│   │   │   ├── storage_service.py     # MinIO file upload/download
│   │   │   └── report_service.py      # Executive report generation
│   │   │
│   │   └── db/                        # Database setup
│   │       ├── __init__.py
│   │       ├── session.py             # SQLAlchemy async session factory
│   │       └── migrations/            # Alembic migrations
│   │
│   ├── agents/                        # LangGraph agent nodes (SEPARATED from API)
│   │   ├── __init__.py
│   │   ├── graph.py                   # StateGraph definition + edge routing
│   │   ├── state.py                   # GrievanceState TypedDict
│   │   ├── ingestion.py               # Ingestion Agent node
│   │   ├── priority.py                # Priority Agent node
│   │   ├── auditor.py                 # Systemic Auditor node
│   │   ├── resolution.py             # Resolution Agent node
│   │   ├── verification.py           # Verification Agent node
│   │   └── utils/                     # Shared agent utilities
│   │       ├── __init__.py
│   │       ├── embeddings.py          # Embedding generation
│   │       ├── clustering.py          # DBSCAN clustering logic
│   │       ├── llm.py                 # LLM client wrappers
│   │       └── trace.py               # Agent trace emission
│   │
│   ├── mock_portal/                   # Mock BWSSB portal (Flask)
│   │   ├── Dockerfile
│   │   ├── app.py                     # Simple form: 4 fields + submit
│   │   └── templates/
│   │       └── index.html             # Government-styled form page
│   │
│   └── tests/                         # Backend test suite
│       ├── conftest.py
│       ├── test_api/
│       ├── test_agents/
│       └── test_services/
│
├── frontend/                          # Next.js 15 dashboard
│   ├── Dockerfile                     # Frontend container image
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts             # Design system tokens
│   ├── next.config.ts
│   │
│   ├── public/                        # Static assets
│   │   └── fonts/
│   │
│   ├── src/
│   │   ├── app/                       # Next.js App Router pages
│   │   │   ├── layout.tsx             # Root layout + providers
│   │   │   ├── page.tsx               # Dashboard home
│   │   │   ├── complaints/
│   │   │   │   ├── page.tsx           # Complaint list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx       # Complaint detail + traces
│   │   │   ├── graph/
│   │   │   │   └── page.tsx           # Knowledge Graph view
│   │   │   ├── map/
│   │   │   │   └── page.tsx           # Hotspot heatmap
│   │   │   ├── agents/
│   │   │   │   └── page.tsx           # Agent Canvas
│   │   │   └── reports/
│   │   │       └── page.tsx           # Executive reports
│   │   │
│   │   ├── components/                # Reusable UI components
│   │   │   ├── ui/                    # shadcn/ui primitives
│   │   │   ├── agent-canvas.tsx       # Real-time agent orchestration view
│   │   │   ├── knowledge-graph.tsx    # Cytoscape.js graph renderer
│   │   │   ├── hotspot-map.tsx        # Leaflet heatmap
│   │   │   ├── complaint-card.tsx     # Complaint summary card
│   │   │   ├── priority-badge.tsx     # Color-coded priority indicator
│   │   │   ├── trace-panel.tsx        # Agent reasoning trace viewer
│   │   │   └── session-replay.tsx     # Playwright session video player
│   │   │
│   │   ├── hooks/                     # Custom React hooks
│   │   │   ├── use-websocket.ts       # WebSocket connection + reconnect
│   │   │   └── use-complaints.ts      # Complaint data fetching
│   │   │
│   │   ├── lib/                       # Utilities
│   │   │   ├── api.ts                 # API client (fetch wrapper)
│   │   │   ├── utils.ts               # shadcn/ui cn() helper
│   │   │   └── constants.ts           # Design tokens, API URLs
│   │   │
│   │   ├── store/                     # State management
│   │   │   └── agent-store.ts         # Zustand store for real-time agent state
│   │   │
│   │   └── types/                     # TypeScript interfaces
│   │       ├── complaint.ts
│   │       ├── agent.ts
│   │       ├── cluster.ts
│   │       └── graph.ts
│   │
│   └── tests/                         # Frontend tests
│       └── components/
│
├── n8n/                               # n8n workflow configurations
│   └── workflows/                     # Exported JSON workflow definitions
│       ├── whatsapp-intake.json
│       └── email-intake.json
│
├── data/                              # Seed data + test fixtures
│   ├── seed_complaints.json           # 60 realistic Bangalore complaints
│   ├── seed_officers.json             # Ward officers with departments
│   ├── policy_docs/                   # PDFs for RAG engine
│   │   ├── karnataka-rts-act.pdf
│   │   ├── rti-act.pdf
│   │   └── bwssb-sla-guidelines.pdf
│   └── audio/                         # Hindi voice complaint samples
│       ├── complaint-hindi-01.wav
│       └── complaint-hindi-02.wav
│
├── scripts/                           # Utility scripts
│   ├── seed_db.py                     # Load seed data into PostgreSQL
│   ├── generate_embeddings.py         # Pre-compute embeddings for seed data
│   └── test_bhashini.py               # Verify Bhashini API connectivity
│
└── infra/                             # Infrastructure configs
    ├── postgres/
    │   └── init.sql                   # Schema + pgvector extension setup
    ├── redis/
    │   └── redis.conf                 # Memory limit configuration
    └── minio/
        └── init.sh                    # Create default buckets
```

---

## Key Design Decisions

### Agents Separated from API

The `backend/agents/` directory is **deliberately separate** from `backend/app/api/`. LangGraph node logic never imports FastAPI constructs. This ensures:

- Agent nodes can be tested in isolation without spinning up an HTTP server.
- The agent graph can be reused in CLI tools, notebooks, or batch jobs.
- Clear ownership boundaries for parallel development.

### Frontend Component Architecture

Components are organized by function, not by page:

- `components/ui/` — shadcn/ui primitives (buttons, cards, badges). Never modified.
- `components/*.tsx` — Domain-specific components (agent-canvas, knowledge-graph). Composed from ui primitives.
- `hooks/` — Data fetching and WebSocket logic extracted from components.
- `store/` — Zustand stores for real-time state shared across components.

### Data Directory

All seed data, test fixtures, and demo assets live in `data/`. This directory is `.gitignore`-excluded for large binary files (audio clips) but JSON seeds are committed.

---

## References

- [Architecture](ARCHITECTURE.md) — How services connect.
- [Tech Stack](TECHSTACK.md) — Why each technology was chosen.
- [Setup](SETUP.md) — How to run the stack locally.
