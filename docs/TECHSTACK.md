# Technology Selection Rationale

**Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm  
**Version:** 1.0  
**Last Updated:** 2025-07-12

> Related docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [TRD.md](./TRD.md) · [AGENT_SWARM.md](./AGENT_SWARM.md) · [API_SPEC.md](./API_SPEC.md) · [features.md](./features.md)

---

## Table of Contents

1. [Frontend Layer](#1-frontend-layer)
2. [Backend Layer](#2-backend-layer)
3. [Data Layer](#3-data-layer)
4. [AI / ML Layer](#4-ai--ml-layer)
5. [Mobile Layer](#5-mobile-layer)
6. [Integration Layer](#6-integration-layer)
7. [Summary Matrix](#7-summary-matrix)

---

## 1. Frontend Layer

### Next.js 15

| Attribute | Detail |
|---|---|
| **Role** | Dashboard framework for the Command Center (`command-center/`) |
| **Version** | 15.x (App Router) |
| **Why this** | App Router provides server components for initial page load performance, streaming SSR for real-time data, and built-in API routes. React Server Components reduce client-side JavaScript by rendering audit trail tables and map overlays on the server. The `app/` directory convention enforces a file-system routing structure that aligns with our page-per-view dashboard architecture. |
| **Why not alternatives** | **Remix** — Excellent data loading model, but smaller ecosystem for enterprise dashboard components. **Vite + React** — No SSR out of the box; we need server-rendered initial load for the map-heavy dashboard to hit sub-2s LCP on the target Dell Vostro. **Angular** — Heavier framework overhead; team has stronger React expertise. |

### Tailwind CSS

| Attribute | Detail |
|---|---|
| **Role** | Utility-first CSS framework for all UI styling |
| **Version** | 3.x |
| **Why this** | Utility-first approach eliminates CSS naming conflicts in a monorepo where Dev 3 and Dev 4 may share component patterns. Produces minimal CSS bundles via PurgeCSS (< 10 KB gzipped for the dashboard). The monochromatic palette (White / Space Gray `#1c1c1e` / Black `#000000`) maps cleanly to a `tailwind.config.ts` theme extension. |
| **Why not alternatives** | **CSS Modules** — Scoping is good, but no design system consistency without additional tooling. **Styled Components** — Runtime CSS-in-JS adds bundle size and hurts SSR streaming performance in Next.js 15. **Vanilla CSS** — No design tokens or utility shortcuts; slower development velocity in a 48-hour hackathon. |

### shadcn/ui

| Attribute | Detail |
|---|---|
| **Role** | Pre-built accessible component library (copy-paste, not dependency) |
| **Version** | Latest (components copied into `command-center/src/components/ui/`) |
| **Why this** | Components are copied into the project, not installed as a dependency. This means zero runtime cost, full customization control, and no version-lock risk. Built on Radix UI primitives — production-grade accessibility (ARIA attributes, keyboard navigation) without custom implementation. Each component is < 100 lines of readable TypeScript. |
| **Why not alternatives** | **Material UI** — Opinionated design system clashes with our Apple-style minimalist aesthetic. Heavy bundle (~200 KB). **Ant Design** — Enterprise-ready but visually distinctive; would require extensive theme overrides. **Chakra UI** — Good API, but runtime CSS-in-JS conflicts with Next.js Server Components. |

### Cytoscape.js

| Attribute | Detail |
|---|---|
| **Role** | Knowledge graph visualization for the agent swarm network |
| **Version** | 3.x |
| **Why this** | Purpose-built for graph/network visualization with support for directed graphs, clustering layouts, and real-time node updates. The swarm dashboard needs to render agent nodes, event nodes, and decision edges as a live knowledge graph. Cytoscape.js handles 1,000+ nodes with smooth 60fps panning on the target hardware. Canvas-based rendering avoids DOM overhead. |
| **Why not alternatives** | **D3.js** — More general-purpose; requires building graph layout algorithms from scratch. **vis.js** — Less active maintenance, fewer layout options for directed acyclic graphs. **React Flow** — Designed for flowcharts/diagrams, not knowledge graph exploration. |

### Leaflet

| Attribute | Detail |
|---|---|
| **Role** | Interactive map for geospatial complaint visualization and officer tracking |
| **Version** | 1.9.x (via `react-leaflet` 4.x) |
| **Why this** | Lightweight (~40 KB gzipped) open-source map library. Supports custom tile layers, marker clustering, and real-time position updates via WebSocket. Critical for displaying officer GPS traces, complaint heat maps, and spatial dispatch radius overlays. No API key required for OpenStreetMap tiles — zero cost, zero rate limits. |
| **Why not alternatives** | **Mapbox GL JS** — Superior rendering but requires an API key with usage-based pricing; overkill for hackathon scale. **Google Maps** — API key + billing required; vendor lock-in. **deck.gl** — WebGL-based, powerful for large datasets, but adds significant bundle size and complexity for our ~100-event demo scale. |

---

## 2. Backend Layer

### Python 3.12

| Attribute | Detail |
|---|---|
| **Role** | Primary backend language for all server-side logic |
| **Version** | 3.12 |
| **Why this** | First-class LangChain support (LangChain is Python-native). 3.12 brings 5% performance improvement over 3.11 via specializing adaptive interpreter. Type hints with `typing` module enable Pydantic v2 model generation. The entire AI/ML ecosystem (LangChain, sentence-transformers, httpx) is Python-first. |
| **Why not alternatives** | **Node.js/TypeScript** — LangChain.js exists but lags behind the Python library in features (no equivalent of structured output parsers). **Go** — Fast runtime but no LangChain equivalent; building agent orchestration from scratch is impractical in 48 hours. **Java** — Verbose; no mature LLM orchestration framework. |

### FastAPI

| Attribute | Detail |
|---|---|
| **Role** | HTTP framework for REST endpoints + WebSocket server |
| **Version** | 0.115.x |
| **Why this** | Async-native with first-class `async/await` support — critical because every request in our pipeline makes 2–4 external API calls (Pinecone, Claude, PostGIS). Synchronous frameworks would block on I/O, limiting throughput to ~5 concurrent requests on our 4-core hardware. FastAPI handles 50+ concurrent connections with a single Uvicorn worker via `asyncio`. Auto-generates OpenAPI spec from Pydantic models, which Dev 3 and Dev 4 use as the API contract. |
| **Why not alternatives** | **Django** — Synchronous by default; Django Async Views exist but the ORM is still sync-first. Django REST Framework adds overhead for our simple API surface. **Flask** — No native async support; would require Quart or Sanic, fragmenting the ecosystem. **Express.js** — Would require running Python separately for LangChain, adding inter-process communication complexity. |

### LangChain

| Attribute | Detail |
|---|---|
| **Role** | LLM orchestration framework for structured agent prompts and output parsing |
| **Version** | 0.3.x |
| **Why this** | Provides `ChatPromptTemplate` for structured prompt engineering, `PydanticOutputParser` for type-safe LLM responses, and `RunnableSequence` for composable agent pipelines. Our priority agent needs the LLM to respond in strict JSON (`{impact_score, severity_color}`) — LangChain's output parsers handle format validation and retry logic. Integrates natively with the Anthropic SDK for Claude Sonnet. |
| **Why not alternatives** | **LangGraph** — Designed for stateful, cyclic multi-agent workflows with complex state machines. Our pipeline is a linear sequence (cluster → priority → dispatch) with a single retry edge at verification. LangGraph's state graph overhead is unnecessary for this topology; `RunnableSequence` achieves the same result with simpler code. **Raw Anthropic SDK** — No structured output parsing, no prompt templating, no retry logic. We'd reimplement half of LangChain. **CrewAI** — Higher-level abstraction that sacrifices control over individual agent prompts and audit logging. |

### Pydantic v2

| Attribute | Detail |
|---|---|
| **Role** | Data validation, serialization, and schema generation |
| **Version** | 2.x |
| **Why this** | 5–50× faster than Pydantic v1 (Rust core via `pydantic-core`). Powers FastAPI request/response validation, LangChain output parsing, and database model serialization. A single Pydantic model definition generates the OpenAPI schema, the JSON schema for contract tests, and the TypeScript interface (via `datamodel-codegen`). Single source of truth for data shapes across the entire stack. |
| **Why not alternatives** | **dataclasses** — No validation, no serialization, no schema generation. **attrs** — Validation requires additional libraries (cattrs). **marshmallow** — Slower, separate schema definition from data class. |

---

## 3. Data Layer

### PostgreSQL + PostGIS

| Attribute | Detail |
|---|---|
| **Role** | Primary relational database with geospatial query support |
| **Version** | PostgreSQL 16, PostGIS 3.4 |
| **Why this** | PostGIS enables spatial queries that are core to the dispatch pipeline. `ST_Distance` finds the nearest officer within a radius. `ST_DWithin` filters complaints within a 2 km cluster radius. `ST_MakePoint` creates geometry from GPS coordinates. These operations run as indexed SQL queries — no application-level distance calculations. Spatial indexes (GiST) make nearest-neighbor queries O(log n). |
| **Why not alternatives** | **MongoDB** — `$geoNear` exists but lacks the query expressiveness of PostGIS (no spatial joins, no buffer analysis). No ACID transactions for audit trail immutability. **MySQL** — Spatial support exists but is less mature; no equivalent of PostGIS's geography type for accurate distance on a sphere. **SQLite + SpatiaLite** — Single-writer concurrency model doesn't support concurrent GPS pings from multiple officers. |

### Pinecone

| Attribute | Detail |
|---|---|
| **Role** | Managed vector database for semantic similarity search and cluster detection |
| **Version** | Serverless (us-east-1) |
| **Why this** | Fully managed — no infrastructure to maintain during a 48-hour hackathon. Serverless tier provides free 100K vectors with ~50ms p95 query latency. The cluster detection pipeline queries with cosine similarity > 0.85 to find semantically related complaints. Pinecone handles the ANN index (HNSW) without us tuning parameters. Metadata filtering (by timestamp, category, ward) is built-in. |
| **Why not alternatives** | **pgvector** — Runs inside PostgreSQL, which is appealing for simplicity. However, at scale, vector queries compete with transactional queries for the same connection pool and shared_buffers on our 1.5 GB Postgres container. Pinecone offloads this to a dedicated cloud service. **ChromaDB** — In-process, which means it runs on our memory-constrained backend container. No managed hosting option. **Weaviate** — Self-hosted option requires its own container (~1 GB), exceeding our Docker memory budget. |

### Redis

| Attribute | Detail |
|---|---|
| **Role** | In-memory cache, pub/sub message broker for WebSocket fan-out |
| **Version** | 7-alpine |
| **Why this** | Dual role: (1) **Cache** — stores recent Pinecone query results and officer positions to reduce API calls. (2) **Pub/Sub** — broadcasts dispatch events from the FastAPI backend to all connected WebSocket clients (dashboard + mobile). Sub-millisecond latency. Alpine image is ~30 MB — fits within our 256 MB container budget. No persistence configured — cache is ephemeral by design. |
| **Why not alternatives** | **RabbitMQ** — Durable message queuing is unnecessary; our WebSocket broadcasts are fire-and-forget. RabbitMQ's container is ~150 MB heavier. **Kafka** — Extreme overkill for hackathon scale; designed for millions of events/second with durability guarantees we don't need. **In-process pub/sub** — Wouldn't work across multiple Uvicorn workers in production scaling. |

---

## 4. AI / ML Layer

### Claude Sonnet (Anthropic)

| Attribute | Detail |
|---|---|
| **Role** | Primary reasoning LLM for priority scoring and systemic analysis |
| **Version** | claude-sonnet-4-20250514 |
| **Why this** | Best-in-class structured output adherence — when prompted with a JSON schema and the `"You must respond with valid JSON"` instruction, Claude Sonnet follows the schema with > 98% compliance. Critical for our priority agent which expects `{impact_score: int, severity_color: string}`. Strong chain-of-thought reasoning for the `reasoning` field in our audit trail. 200K context window handles long complaint descriptions with ward-level context. |
| **Why not alternatives** | **GPT-4o** — Comparable quality but higher per-token cost for equivalent structured output reliability. **Llama 3** — Open-source, but requires local GPU for inference — impossible on our 8 GB RAM / no-GPU hardware. **Gemini Pro** — Good general reasoning but less consistent structured JSON output in our testing. |

### Gemini Flash (Google AI)

| Attribute | Detail |
|---|---|
| **Role** | Vision model for verification photo analysis |
| **Version** | gemini-2.0-flash |
| **Why this** | Fastest multimodal model available — < 2s latency for image analysis. The verification step needs to confirm that a photo shows a resolved issue (e.g., a repaired road, a flowing tap). Gemini Flash processes the image and returns a structured `{verified: bool, confidence: float, description: string}` response. Cost-effective for high-volume photo verification at $0.075/1M input tokens. |
| **Why not alternatives** | **GPT-4o Vision** — Higher latency (~3–5s) and 3× higher cost per image. **Claude Sonnet Vision** — Not yet optimized for rapid image classification; better suited for detailed image analysis. **Local CLIP model** — Would require loading a 400 MB model into our memory-constrained backend container. |

### Bhashini (MeitY)

| Attribute | Detail |
|---|---|
| **Role** | Hindi speech-to-text for voice complaints |
| **Version** | API v2 |
| **Why this** | Government of India's official NLP platform — judges from an Indian AI hackathon will recognize this as a governance-aligned choice. Supports 22 Indian languages (Hindi priority). Free API access for government/public-interest projects. Purpose-built for Indian accents and dialects, which general-purpose STT models (Whisper, Google STT) handle less reliably for rural Hindi speakers. |
| **Why not alternatives** | **OpenAI Whisper** — Excellent general STT but less accurate on Hindi dialects and requires either local GPU (Whisper large) or API cost (Whisper API). **Google Cloud STT** — Paid API with usage-based billing; no government alignment story. **Azure Speech** — Similar cost/accuracy trade-off as Google. |

### Browser-Use + Playwright

| Attribute | Detail |
|---|---|
| **Role** | Automated filing of grievances on government portals (e.g., CPGRAMS) |
| **Version** | Browser-Use 0.1.x, Playwright latest |
| **Why this** | Many Indian government grievance portals lack APIs — the only integration path is browser automation. Browser-Use provides an LLM-driven wrapper around Playwright that can navigate unpredictable portal UIs, fill forms, and capture confirmation numbers. Runs headlessly within the backend container using Playwright's Chromium binary. |
| **Why not alternatives** | **Selenium** — Slower, less reliable element detection. No LLM-driven navigation for dynamic government portals. **Puppeteer** — Node.js only; we'd need a separate container. **Direct API calls** — Government portals don't expose APIs for grievance filing. |

---

## 5. Mobile Layer

### Expo (React Native)

| Attribute | Detail |
|---|---|
| **Role** | Cross-platform mobile app for field officers (`field-worker-app/`) |
| **Version** | Expo SDK 51+ |
| **Why this** | Single codebase for iOS and Android — critical when one developer (Dev 4) must deliver a working mobile app in 48 hours. Expo provides pre-built modules for camera access (`expo-camera`), GPS tracking (`expo-location`), secure storage (`expo-secure-store`), and push notifications (`expo-notifications`). Expo Go app enables testing on physical devices without native build toolchains. TypeScript support aligns with the frontend stack. |
| **Why not alternatives** | **Flutter** — Dart language adds a third language to the stack (Python + TypeScript + Dart). No team expertise. **Native Swift/Kotlin** — Two separate codebases for one developer is not feasible in 48 hours. **PWA** — No reliable background GPS tracking, limited camera API, no push notification support on iOS. |

---

## 6. Integration Layer

### n8n

| Attribute | Detail |
|---|---|
| **Role** | Workflow automation for omnichannel intake and notification delivery |
| **Version** | Self-hosted (Docker) |
| **Why this** | Visual workflow builder enables Dev 2 to create intake pipelines without writing code — critical for a 48-hour hackathon. Pre-built nodes for WhatsApp Business API, email (IMAP), HTTP webhooks, and custom JavaScript. Self-hosted deployment means no vendor API limits and full control over data flow. Workflow JSON is version-controlled in `omnichannel-intake/n8n-workflows/`. |
| **Why not alternatives** | **Zapier** — Cloud-only, no self-hosting option. Free tier has severe limits (100 tasks/month). Can't run inside our Docker network. **Make (Integromat)** — Same cloud-only limitation. **Custom Python scripts** — Would work but slower to build; n8n's visual editor allows rapid iteration on intake logic. **Apache Airflow** — Designed for batch data pipelines, not real-time webhook processing. |

### Docker Compose

| Attribute | Detail |
|---|---|
| **Role** | Local orchestration of all services |
| **Version** | Compose v3.8 |
| **Why this** | Single `docker-compose.yml` to spin up the entire stack with `docker compose up`. Defines service dependencies, shared networks, resource limits, and health checks. All four developers can run the full system locally by pulling the repo and running one command. No cloud dependency for development. See [TRD.md §3.3](./TRD.md#33-local-hardware-optimization) for per-container resource limits. |
| **Why not alternatives** | **Kubernetes (minikube)** — Minimum 2 GB overhead for the control plane alone; doesn't fit our 8 GB hardware constraint. **Podman Compose** — Less mature; Docker Compose has broader team familiarity. **Manual processes** — Unsustainable with 6+ services and inter-service dependencies. |

---

## 7. Summary Matrix

| Technology | Layer | Role | Key Decision Factor | Container Size |
|---|---|---|---|---|
| Next.js 15 | Frontend | Dashboard framework | Server Components for map SSR | 512 MB |
| Tailwind CSS | Frontend | Styling system | Utility-first, minimal bundle | — |
| shadcn/ui | Frontend | Component library | Copy-paste, zero dependency | — |
| Cytoscape.js | Frontend | Graph visualization | Canvas rendering, 60fps graphs | — |
| Leaflet | Frontend | Map visualization | Free tiles, lightweight | — |
| Python 3.12 | Backend | Language runtime | LangChain ecosystem, typing | — |
| FastAPI | Backend | HTTP + WebSocket server | Async-native, OpenAPI gen | 1.0 GB |
| LangChain | Backend | LLM orchestration | Structured output parsing | — |
| Pydantic v2 | Backend | Validation + serialization | Rust core, schema gen | — |
| PostgreSQL 16 | Data | Relational + spatial DB | PostGIS spatial indexes | 1.5 GB |
| Pinecone | Data | Vector DB (cloud) | Managed, free 100K vectors | — (cloud) |
| Redis 7 | Data | Cache + pub/sub | Sub-ms latency, tiny footprint | 256 MB |
| Claude Sonnet | AI/ML | Reasoning LLM | JSON compliance, audit reasoning | — (cloud API) |
| Gemini Flash | AI/ML | Vision verification | < 2s latency, cost-effective | — (cloud API) |
| Bhashini | AI/ML | Hindi STT | Gov alignment, dialect accuracy | — (cloud API) |
| Browser-Use | AI/ML | Portal automation | LLM-driven form filling | — (in-process) |
| Expo (React Native) | Mobile | Field officer app | Single codebase, camera + GPS | 256 MB |
| n8n | Integration | Workflow automation | Visual builder, self-hosted | 512 MB |
| Docker Compose | Infrastructure | Local orchestration | One-command full stack | — |
| **Total** | | | | **~4.0 GB** |

---

*For deployment topology and service diagrams, see [ARCHITECTURE.md](./ARCHITECTURE.md). For resource limits and security constraints, see [TRD.md](./TRD.md).*
