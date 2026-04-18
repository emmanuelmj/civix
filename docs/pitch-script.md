# Civix-Pulse — Technical Pitch Script

> **Time:** ~5 minutes | **Audience:** Enterprise AI Judges

---

## 1. Opening — The Problem (30 seconds)

> "Today, 80% of citizen grievances across Indian cities are treated as tickets to be closed — not insights to be solved. Data is siloed across departments: the water department doesn't know the electricity department got 50 complaints about the same pumping station. We built **Civix-Pulse** — a zero-bureaucracy agentic system where citizen issues are **autonomously ingested, classified, clustered, scored, and dispatched** — with zero human intervention from complaint to field officer assignment."

---

## 2. Architecture Overview (60 seconds)

> "Let me walk you through the technical architecture."

### End-to-End Data Flow

```
Citizen (WhatsApp/Voice/Form/Letter)
        │
        ▼
   n8n Workflow (Cloud)
   ├── OCR (handwritten letters)
   ├── Speech-to-Text (voice)
   └── Translation → Formal English
        │
        ▼
   Cohere embed-english-v3.0 (1024-dim)
        │
        ▼
   Pinecone Vector DB (index: civix-raw)
   └── status: "NEW" vector written
        │
        ▼
   FastAPI Backend (Pinecone Watcher)
   └── Polls every 5s for status="NEW" vectors
        │
        ▼
   LangGraph Agentic Pipeline (4 nodes)
        │
        ▼
   PostgreSQL (event persisted)
   + WebSocket push to Dashboard
   + Field Worker App receives dispatch
```

**Key talking point:** *"There are two ingestion paths: n8n writes directly to Pinecone, and our backend watcher autonomously picks up new vectors — making the system fully decoupled. No webhook dependency, no single point of failure."*

---

## 3. LangGraph Pipeline — The Brain (90 seconds)

> "The core intelligence is a four-node LangGraph pipeline. Each node is a specialized agent."

### Node 1: Systemic Auditor Agent

**What it does:** Cluster detection via vector similarity search.

**How it works:**
1. Takes the incoming event's embedding (1024-dim Cohere vector)
2. Queries Pinecone across **both** namespaces — live (`__default__`) AND historic (`civix-events`) — for similar vectors
3. If cosine similarity > 0.85 threshold → **cluster detected**
4. Returns `cluster_found: true`, `cluster_size`, `master_event_id`

**Why this matters:**
> "If 50 citizens complain about low water pressure in Kukatpally, we don't create 50 separate tickets. The auditor detects this as a **systemic cluster** — likely a pumping station failure — and links them to one master event. This is the 'Insight, not Ticket' paradigm."

**Technical detail if asked:** Uses Cohere `embed-english-v3.0` for query-time embedding generation when the event's vector isn't in Pinecone yet. Searches both live and historic namespaces and merges results by score.

---

### Node 2: Priority Logic Agent (Impact Matrix)

**What it does:** LLM-based impact scoring using a City Planner persona.

**How it works:**
1. Sends the complaint description, domain, coordinates, and cluster context to **GPT-4.1** (via GitHub Models API)
2. LLM uses structured output to return: `impact_score` (1-100), `severity_color` (hex), `reasoning` (one-line)
3. Scoring rules baked into the system prompt:
   - Danger to life (fire, gas leak, live wire) → 80-100 🔴
   - Infrastructure failure (water outage, sewage) → 60-79 🔴
   - Quality-of-life (pothole, garbage) → 30-59 🟠
   - Minor/cosmetic → 1-29 🟡
4. **Amplifiers:** Near school/hospital +10-20 pts, affects vulnerable populations +10-20 pts

**Fallback:** If LLM API is down, falls back to keyword-based heuristic scorer — system never stops.

---

### Node 3: Cluster Amplifier Agent

**What it does:** Conditional score boost when systemic patterns are detected.

**How it works:**
- If `cluster_found == true` → adds +15 points to impact score
- Escalates severity color to red if boosted score ≥ 70
- Appends cluster context to reasoning string

**Why it exists:**
> "A single pothole scores 40. But if our auditor detected 12 similar reports in the same area — that's a road segment failing. The amplifier boosts it to 55, pushing it above the threshold for urgent response. Systemic issues always outrank isolated ones."

---

### Node 4: Dispatch Agent

**What it does:** Autonomous field officer assignment with proximity + workload balancing.

**How it works:**
1. Filters officers by **domain skill match** (e.g., TRAFFIC complaint → officers with TRAFFIC skill)
2. For each candidate, calculates a composite score:
   ```
   score = haversine_distance_km + (active_task_count × 2.0)
   ```
3. Lowest score wins — balances **proximity** with **workload**
4. Falls back to any available officer if no domain match

**Why this is smart:**
> "OP-102 might be 2km away but already has 16 tasks. OP-106 is 5km away with only 3 tasks. The dispatch agent picks OP-106 because 5 + (3×2) = 11 beats 2 + (16×2) = 34. This prevents officer burnout and optimizes resolution time."

---

## 4. FastAPI Backend (60 seconds)

> "The backend is a FastAPI server that orchestrates everything."

### Key Components

| Component | Purpose |
|-----------|---------|
| **Pinecone Watcher** | Background async task polling every 5s for `status="NEW"` vectors |
| **Domain Auto-Classifier** | Keyword-based reclassification when upstream sends "General" |
| **WebSocket Hub** | Real-time push to all connected dashboard clients |
| **PostgreSQL Layer** | Raw asyncpg (no ORM overhead) for event persistence |
| **LangSmith Tracing** | Every pipeline run is traced end-to-end for observability |

### Data Flow on New Event

```python
# Watcher detects NEW vector in Pinecone
metadata = extract_metadata(vector)       # Parse 15+ fields
state = build_pulse_state(metadata)       # Create LangGraph input
result = await pipeline.ainvoke(state)    # Run 4-node graph
await insert_pulse_event(result)          # Persist to PostgreSQL
await broadcast_ws(result)                # Push to all dashboards
mark_processed(vector_id)                 # Update Pinecone status
```

**Key talking point:** *"From the moment a vector enters Pinecone to the field officer seeing it on their phone — that's under 10 seconds. No human touched it."*

---

## 5. Dashboard — Command Center (30 seconds)

> "The command center is a Next.js 15 App Router application with real-time updates."

- **Live Feed:** WebSocket-driven, events appear instantly
- **Analytics:** Department-wise KPIs, timeline charts, SLA tracking
- **Knowledge Graph:** Infrastructure relationship visualization
- **Leaderboard:** Officers ranked by SLA compliance
- **Reports:** Auto-generated executive summaries with department drill-downs

**Tech:** Next.js 15 + Turbopack, TypeScript, Tailwind CSS, shadcn/ui. Monochromatic Apple-style design system. All data flows through a single `PulseProvider` React context.

---

## 6. Field Worker App (30 seconds)

> "Field officers have a dedicated mobile app — built with Expo/React Native."

- Login with Officer ID + PIN → shows only **their** domain tasks
- Real-time dispatch via WebSocket — new tasks appear instantly
- **Verification flow:** Officer takes a geotagged photo → uploaded with lat/lng → marks event as RESOLVED
- Location pings every 15s for real-time tracking

---

## 7. Closing — The Killer Differentiators

1. **True Agentic:** No human in the loop from complaint to dispatch
2. **Cluster Intelligence:** 50 complaints → 1 root cause (the pumping station)
3. **Real Vector Search:** Cohere embeddings + Pinecone, not keyword matching
4. **LLM-Scored Priority:** Not rule-based — GPT-4.1 reasons about impact
5. **Fault-Tolerant:** Every agent has a heuristic fallback if APIs fail
6. **Real-Time E2E:** Pinecone → Pipeline → PostgreSQL → WebSocket → UI in <10s

---

# Anticipated Judge Questions & Answers

### Q1: "Why LangGraph over simple sequential function calls?"

> "LangGraph gives us **typed state management** across nodes. Each node reads and writes to a shared `PulseState` TypedDict — the auditor writes `cluster_found`, the priority agent reads it. If we needed to add conditional routing (e.g., skip dispatch for duplicate clusters), LangGraph's edge system handles that without refactoring. It also gives us **free LangSmith tracing** — every pipeline execution is logged with inputs, outputs, and latency per node."

### Q2: "How does the cluster detection actually work?"

> "We use **cosine similarity on Cohere embeddings**. When a new complaint comes in, we generate its 1024-dim embedding and query Pinecone for the top 10 similar vectors across both the live and historic namespaces. If any match exceeds 0.85 similarity, we flag it as a cluster. The threshold is configurable via environment variable. We merge results from both namespaces and deduplicate by event ID."

### Q3: "What if the LLM API goes down?"

> "Every node has a heuristic fallback. The priority agent falls back to a keyword-based scorer — words like 'fire', 'collapse', 'gas leak' score 80+, while 'pothole', 'garbage' score 40-60. The auditor falls back to domain-based probability (water/electricity complaints have 35% cluster probability). The system **never stops processing** — it degrades gracefully."

### Q4: "How do you handle multimodal input (voice, handwritten letters)?"

> "That's handled by n8n — our teammate's workflow. n8n uses OCR for handwritten letters and Speech-to-Text for voice complaints. It translates everything to formal English, generates a Cohere embedding, and writes the vector to Pinecone with standardized metadata. Our backend is modality-agnostic — we only see the processed text and metadata."

### Q5: "Why Pinecone as the bridge instead of a message queue like Kafka?"

> "Three reasons: (1) Pinecone is our vector store anyway for cluster detection — using it as ingestion avoids a second system. (2) The `status` metadata field gives us exactly-once processing — watcher picks up `NEW`, marks `PROCESSED`. (3) For a hackathon scope, it's simpler than managing Kafka. In production, you'd add Kafka for guaranteed ordering and replay."

### Q6: "How does the officer dispatch avoid assigning the same officer too many tasks?"

> "The dispatch agent uses a composite score: `haversine_distance + (active_tasks × 2.0)`. Each active task adds a 2km penalty to the officer's score. So an officer 2km away with 16 tasks scores 34, while an officer 5km away with 3 tasks scores 11 — the farther but less busy officer gets picked. This naturally load-balances across the team."

### Q7: "What's the end-to-end latency?"

> "Typically 5-8 seconds. Breakdown: Pinecone poll interval (5s max) + Cohere embedding (1-2s) + Pinecone similarity query (0.5s) + GPT-4.1 scoring (1-2s) + PostgreSQL insert (<100ms) + WebSocket push (<50ms). The bottleneck is the LLM call."

### Q8: "How do you ensure data consistency between Pinecone and PostgreSQL?"

> "Pinecone is our ingestion buffer — it holds the raw vector with `status` tracking. PostgreSQL is our system of record — it holds the enriched event after pipeline processing. The watcher only marks a vector as `PROCESSED` after successful PostgreSQL insertion. If the insert fails, the vector stays `NEW` and gets retried on the next poll cycle."

### Q9: "What about scalability? Can this handle thousands of complaints?"

> "The current architecture scales horizontally: (1) Pinecone is managed — scales automatically. (2) The FastAPI watcher can run multiple instances with partition-based polling. (3) PostgreSQL handles the structured data. (4) WebSocket connections are per-dashboard, not per-complaint. The bottleneck would be LLM API rate limits — which we address with the heuristic fallbacks."

### Q10: "What's the tech stack summary?"

> **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
> **Mobile:** Expo / React Native (web + mobile)
> **Backend:** Python 3.12, FastAPI, LangGraph, asyncpg
> **AI/ML:** Cohere embeddings (1024-dim), GPT-4.1 (GitHub Models), LangSmith tracing
> **Data:** PostgreSQL 16, Pinecone vector DB
> **Orchestration:** n8n (multimodal ingestion), Docker Compose

### Q11: "Can you show us the LangSmith traces?"

> "Yes — every pipeline run is traced. You can see the four nodes, their inputs/outputs, and latency. The auditor shows the Pinecone query results, the priority agent shows the LLM prompt and response, and the dispatch agent shows the officer matching calculation."

### Q12: "How does the auto-classification work when domain is 'General'?"

> "We have a keyword-based domain classifier in the Pinecone watcher. When the upstream sends `domain: 'General'`, we scan the description text for domain-specific keywords — 'fire' or 'collapse' maps to EMERGENCY, 'pothole' or 'traffic' maps to TRAFFIC, 'water' or 'pipe' maps to WATER. Each domain has 10-15 keywords. The domain with the most keyword hits wins. Falls back to MUNICIPAL as the catch-all department."

---

## Quick Reference — Numbers That Impress

| Metric | Value |
|--------|-------|
| Pipeline nodes | 4 (Auditor → Priority → Amplifier → Dispatch) |
| Embedding dimensions | 1024 (Cohere embed-english-v3.0) |
| Cluster similarity threshold | 0.85 cosine |
| Pinecone poll interval | 5 seconds |
| LLM model | GPT-4.1 (GitHub Models API) |
| Heuristic fallbacks | 3 (auditor, priority, domain classifier) |
| Officers in pool | 8 (6 domains) |
| PostgreSQL events | 125+ processed |
| End-to-end latency | 5-8 seconds |
| WebSocket push | <50ms |
| Uptime fallback | 100% — heuristics if any API fails |
