# Tech Stack

> **Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm
> **Team:** Vertex

---

## Overview

Every technology in this stack was selected against a single filter: **does it solve a specific Civix-Pulse problem better than the alternatives, while running on constrained hardware?** This document explains the "why" behind each choice.

---

## Frontend

### Next.js 15 (App Router)

| Attribute | Detail |
|---|---|
| **Role** | Dashboard, Agent Canvas, Knowledge Graph, Hotspot Map |
| **Why this** | App Router enables React Server Components — heavy data fetching (complaint lists, graph data) happens server-side, keeping the client bundle lean. Built-in API routes serve as a lightweight BFF (Backend-for-Frontend) for WebSocket proxying. |
| **Why not alternatives** | Remix lacks the RSC model. Vite + React requires manual SSR setup. Angular is overweight for a 48-hour build. |
| **Version** | 15.x (stable App Router, Turbopack for fast dev builds) |

### Tailwind CSS

| Attribute | Detail |
|---|---|
| **Role** | Utility-first styling across all UI components |
| **Why this** | Zero runtime CSS. Purged output is < 10KB in production. Enforces the monochromatic design system (Space Gray `#1c1c1e`, Black `#000000`, White `#ffffff`) via `tailwind.config.ts` theme tokens. |
| **Why not alternatives** | CSS Modules add file overhead. styled-components has runtime cost. Plain CSS lacks design token enforcement. |

### shadcn/ui

| Attribute | Detail |
|---|---|
| **Role** | Pre-built, accessible UI primitives (tables, dialogs, badges, cards, command palette) |
| **Why this** | Components are copied into the codebase, not installed as a dependency — full control, no version lock-in. Built on Radix UI primitives with accessibility baked in. Styled with Tailwind, so they inherit the design system automatically. |
| **Why not alternatives** | Material UI is opinionated and heavy. Ant Design conflicts with minimalist aesthetics. Chakra requires a runtime provider. |

### Cytoscape.js

| Attribute | Detail |
|---|---|
| **Role** | Knowledge Graph visualization (force-directed layout, root-cause collapse) |
| **Why this** | Purpose-built for graph rendering with physics-based layouts. Supports compound nodes (for cluster collapse), edge animations, and interactive zoom/pan. Smaller bundle than D3 for graph-specific use cases. |
| **Why not alternatives** | D3 is lower-level — requires building graph layout from scratch. vis.js is less maintained. React Flow is designed for flowcharts, not knowledge graphs. |

### Leaflet

| Attribute | Detail |
|---|---|
| **Role** | Hotspot heatmap with complaint density overlay |
| **Why this** | Lightweight (42KB gzipped), no API key required for tile layers, mature plugin ecosystem for heatmaps. |
| **Why not alternatives** | Mapbox requires an API key and has usage limits. Google Maps has licensing costs. Deck.gl is overkill for 2D heatmaps. |

---

## Backend

### Python 3.12

| Attribute | Detail |
|---|---|
| **Role** | Primary backend language for API layer and agent logic |
| **Why this** | LangGraph, LangChain, and the entire LLM tooling ecosystem is Python-first. 3.12 brings improved error messages, f-string improvements, and 5% interpreter speedup over 3.11. |
| **Why not alternatives** | TypeScript backend would require maintaining two LangGraph client libraries. Go lacks mature LLM orchestration frameworks. |

### FastAPI

| Attribute | Detail |
|---|---|
| **Role** | API gateway — complaint CRUD, agent triggers, WebSocket streaming |
| **Why this** | Async-native (critical for I/O-bound LLM calls). Pydantic v2 integration provides compile-time-like type safety for request/response validation. Auto-generates OpenAPI docs at `/docs`. |
| **Why not alternatives** | Flask is synchronous. Django is too heavy for an API-only service. Express would split the backend across two languages. |

### LangGraph

| Attribute | Detail |
|---|---|
| **Role** | Multi-agent state machine orchestration — the core intelligence layer |
| **Why this** | LangGraph supports **cyclic graphs** — agents can loop, retry, and conditionally branch. This is essential for the Systemic Auditor (which may re-query after finding new evidence) and the Resolution Agent (which retries portal filing on failure). Built-in state persistence to PostgreSQL enables crash recovery. |
| **Why not alternatives** | LangChain agents are linear (no cycles). CrewAI abstracts away too much control. AutoGen is conversation-oriented, not workflow-oriented. Custom state machines require reimplementing persistence, checkpointing, and error recovery. |

### Pydantic v2

| Attribute | Detail |
|---|---|
| **Role** | Data validation for API contracts, agent inputs/outputs, and LLM structured output |
| **Why this** | Single validation layer used everywhere: FastAPI request models, LangGraph state schemas, and LLM response parsing (via `instructor` or native structured output). Rust-core runtime is 5-50x faster than v1. |

---

## Data Layer

### PostgreSQL 16 + pgvector

| Attribute | Detail |
|---|---|
| **Role** | Primary datastore for complaints, users, agent traces, and vector embeddings |
| **Why this** | pgvector enables vector similarity search **inside the same database** as relational data — no separate vector DB to manage. Supports HNSW indexing for sub-200ms top-50 queries. PostgreSQL also serves as LangGraph's state persistence backend. |
| **Why not alternatives** | Pinecone/Weaviate add a separate service (more RAM, more complexity). SQLite lacks vector support. MongoDB lacks transactional guarantees needed for audit trails. |

### Redis

| Attribute | Detail |
|---|---|
| **Role** | Agent state caching, pub/sub for real-time WebSocket events, rate limiting |
| **Why this** | Sub-millisecond reads for hot data (active complaint states, agent status). Pub/sub channels push real-time updates to the Agent Canvas via WebSocket. |
| **Why not alternatives** | In-memory caching within FastAPI doesn't survive restarts. RabbitMQ/Kafka are overkill for pub/sub at this scale. |

### MinIO

| Attribute | Detail |
|---|---|
| **Role** | S3-compatible object storage for media files (photos, audio, verification images, Playwright traces) |
| **Why this** | Self-hosted, S3-compatible API, runs in a 128MB container. Media files stay out of PostgreSQL. Pre-signed URLs provide secure, time-limited access. |
| **Why not alternatives** | AWS S3 requires cloud credentials and internet access during demo. Local filesystem lacks access control and pre-signed URLs. |

---

## AI & ML

### Claude Sonnet (Anthropic)

| Attribute | Detail |
|---|---|
| **Role** | Primary LLM for agent reasoning, structured output, priority scoring, root-cause hypothesis generation |
| **Why this** | Best-in-class structured output with tool use. Strong reasoning for multi-step agent decisions. Reliable JSON output via native structured output mode. |

### Gemini Flash (Google)

| Attribute | Detail |
|---|---|
| **Role** | Vision verification (before/after photo comparison), cost-efficient bulk processing |
| **Why this** | Multimodal (image + video) at a fraction of Claude's cost. Free tier available for hackathon. Flash variant optimized for speed over depth — ideal for binary yes/no verification tasks. |

### Bhashini (Government of India)

| Attribute | Detail |
|---|---|
| **Role** | Hindi Speech-to-Text and translation |
| **Why this** | Government-backed, free, optimized for Indian languages and accents. Demonstrates alignment with India's Digital India initiative. |
| **Fallback** | Whisper (local) or Google Cloud STT if Bhashini is unavailable during demo. |

### Browser-Use + Playwright

| Attribute | Detail |
|---|---|
| **Role** | Computer-use agent for autonomous government portal filing |
| **Why this** | Browser-Use drives Chromium via accessibility tree (fast, reliable) with screenshot fallback. Playwright provides session recording for audit trails. This combination solves the "no API" problem for 80% of government portals. |
| **Why not alternatives** | Selenium lacks native trace recording. Puppeteer is Node-only. Direct API integration doesn't exist for most government portals. |

---

## Integration & Orchestration

### n8n

| Attribute | Detail |
|---|---|
| **Role** | Webhook ingestion layer — receives complaints from WhatsApp, email, and external systems, normalizes, and forwards to FastAPI |
| **Why this** | Visual workflow builder for non-code integrations. Self-hosted (no vendor lock-in). Pre-built connectors for WhatsApp Business, email, and HTTP webhooks. Runs in a 256MB container. |
| **Why not alternatives** | Zapier is cloud-only and paid. Custom webhook handlers require writing and maintaining connector code for each source. |

### Docker Compose

| Attribute | Detail |
|---|---|
| **Role** | Local orchestration of all services (6 containers) |
| **Why this** | Single `docker compose up` brings the entire stack online. Resource limits per container ensure the system fits within 8GB RAM. No Kubernetes complexity for local development. |
| **Why not alternatives** | Kubernetes is overkill for local dev. Running services natively creates "works on my machine" problems. |

---

## Summary Matrix

| Layer | Technology | Key Justification |
|---|---|---|
| Frontend | Next.js 15 | Server components for lean client bundles |
| Styling | Tailwind CSS + shadcn/ui | Zero-runtime, design-system-enforced, accessible |
| Graph Viz | Cytoscape.js | Purpose-built for knowledge graph rendering |
| Maps | Leaflet | Lightweight, no API key, heatmap plugins |
| Backend | FastAPI + Python 3.12 | Async-native, Pydantic validation, OpenAPI docs |
| Orchestration | LangGraph | Cyclic state machines with persistence |
| Database | PostgreSQL 16 + pgvector | Relational + vector search in one service |
| Cache / PubSub | Redis | Real-time agent status streaming |
| Object Storage | MinIO | Self-hosted S3 for media files |
| Primary LLM | Claude Sonnet | Structured output, strong reasoning |
| Vision / Video | Gemini Flash | Multimodal at low cost |
| Indian STT | Bhashini | Government-backed Hindi speech-to-text |
| Browser Agent | Browser-Use + Playwright | Zero-API portal integration with audit trail |
| Webhooks | n8n | Visual workflow automation, self-hosted |
| Infrastructure | Docker Compose | Single-command local deployment |

---

## References

- [Architecture](ARCHITECTURE.md) — How these technologies connect.
- [TRD](TRD.md) — Scalability and data governance requirements.
- [Feature Roadmap](features.md) — Features each technology enables.
