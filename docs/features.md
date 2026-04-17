# Features

> **Civix-Pulse** — Complete Feature Catalog  
> All features listed here are realistic, buildable within a 48-hour hackathon, and map directly to the [Product Requirements](PRD.md).

---

## Feature Tiers

Features are organized into three tiers based on architectural complexity and demo impact.

| Tier | Focus | Count |
|------|-------|-------|
| [Tier 1 — Core Differentiators](#tier-1--core-differentiators) | What makes Civix-Pulse unique | 5 |
| [Tier 2 — Intelligence Layer](#tier-2--intelligence-layer) | The AI reasoning and analysis backbone | 5 |
| [Tier 3 — Operational Excellence](#tier-3--operational-excellence) | Dashboards, analytics, and governance | 6 |

---

## Tier 1 — Core Differentiators

### 1.1 Autonomous Portal Filing

**Owner:** Dev 1 (Backend)  
**Stack:** Browser-Use + Playwright, Claude Sonnet  
**PRD Ref:** FR-5.1

The system autonomously files grievances on government portals (e.g., CPGRAMS, PGPortal) without human intervention. Browser-Use navigates the portal, fills forms, uploads attachments, solves CAPTCHAs via vision AI, and captures a confirmation screenshot as an audit artifact.

**How it works:**
1. LangChain agent constructs a structured filing payload from the grievance record.
2. Browser-Use launches a headless Playwright session targeting the configured portal.
3. Claude Sonnet interprets dynamic form layouts and maps fields accordingly.
4. On success, the confirmation number and screenshot are stored against the event record.

**Why it matters:** Eliminates the single largest bottleneck in grievance processing — manual data entry into legacy government portals.

---

### 1.2 Live Agent Canvas

**Owner:** Dev 3 (Command Center)  
**Stack:** Next.js 15, WebSocket, shadcn/ui  
**PRD Ref:** FR-5.4

A real-time visualization of the entire multi-agent swarm in action. The canvas renders each agent node (Intake, Priority, Cluster, Spatial, Resolution) as a live state machine, with animated data flow between nodes. Every decision — scoring, clustering, dispatching — is visible as it happens.

**How it works:**
1. Backend broadcasts agent state transitions via WebSocket (`AGENT_STATE_CHANGE` events).
2. The canvas renders a directed graph with nodes representing agents and edges representing data flow.
3. Each node displays its current state: `idle`, `processing`, `waiting`, or `completed`.
4. Clicking a node expands the full reasoning trace (LLM prompt, response, decision rationale).

**Why it matters:** Provides the audit trail and explainability that enterprise AI judges expect. Every autonomous decision is transparent and traceable.

---

### 1.3 Multilingual Voice Intake

**Owner:** Dev 2 (Omnichannel Intake)  
**Stack:** n8n, Bhashini STT, Claude Sonnet  
**PRD Ref:** FR-1.3

Citizens can file complaints by speaking in Hindi (or other Indian languages) via WhatsApp voice notes or phone calls. Bhashini performs speech-to-text, and Claude Sonnet translates and classifies the complaint into a structured event.

**How it works:**
1. n8n receives the audio file via WhatsApp webhook or voice gateway.
2. Audio is sent to Bhashini API for Hindi speech-to-text transcription.
3. The transcript is passed to Claude Sonnet with a classification prompt that extracts: category, location, urgency cues, and a normalized summary in English.
4. The structured event is written to Pinecone with both Hindi and English text for bilingual search.

**Why it matters:** 40% of grievance filers in Tier-2 and Tier-3 Indian cities prefer voice over text. Excluding them creates a systemic bias in grievance data.

---

### 1.4 Knowledge Graph with Root-Cause Collapse

**Owner:** Dev 1 (Backend) + Dev 2 (Omnichannel Intake)  
**Stack:** Pinecone, LangChain, PostGIS  
**PRD Ref:** FR-3.1, FR-3.2

When 50 citizens report low water pressure in the same ward within 12 hours, the system doesn't create 50 tickets. It performs semantic clustering (Pinecone similarity > 0.85) with spatial correlation (PostGIS, 2 km radius) and temporal windowing (last 12 hours) to collapse them into a single root-cause event — e.g., "Pumping Station #7 failure."

**How it works:**
1. Each new event embedding is compared against recent events in Pinecone.
2. Matches above the similarity threshold are grouped into a candidate cluster.
3. PostGIS validates spatial proximity between complaint coordinates.
4. Claude Sonnet analyzes the cluster and generates a root-cause hypothesis.
5. The cluster is surfaced as a single high-priority event with all constituent complaints linked.

**Why it matters:** This is the core insight of Civix-Pulse — moving from ticket-counting to root-cause intelligence. A single root-cause fix resolves dozens of complaints simultaneously.

---

### 1.5 AI-Verified Resolution

**Owner:** Dev 4 (Field Worker App) + Dev 1 (Backend)  
**Stack:** Expo Camera, Gemini Flash Vision, FastAPI  
**PRD Ref:** FR-4.3

When a field officer marks an issue as resolved, the system requires photographic proof. The officer captures a verification photo via the mobile app, which is sent to Gemini Flash Vision for automated assessment. The AI confirms whether the resolution matches the original complaint (e.g., "pothole filled" vs. "pothole still visible").

**How it works:**
1. Officer taps "Mark Resolved" in the Field Worker App and captures a photo.
2. The photo is uploaded to `POST /api/v1/officer/verify-resolution` along with the event context.
3. Gemini Flash Vision receives the image and a prompt describing the expected resolution state.
4. The model returns a confidence score and a pass/fail verdict.
5. If the verdict is `PASS` (confidence ≥ 0.80), the case is closed and the citizen is notified via WhatsApp.
6. If `FAIL`, the case is returned to the officer's queue with AI-generated feedback on what's missing.

**Why it matters:** Eliminates fraudulent closures. Resolution is verified by AI, not self-reported by the resolver.

---

## Tier 2 — Intelligence Layer

### 2.1 Priority Agent with Impact Matrix

**Owner:** Dev 1 (Backend)  
**Stack:** LangChain, Claude Sonnet  
**PRD Ref:** FR-2.1

Every incoming grievance is scored by the Priority Agent using a multi-dimensional Impact Matrix. The agent evaluates: population affected (estimated from location density), urgency (health/safety risk), recurrence (is this a repeat complaint?), and political sensitivity. The output is an `impact_score` (1–100) and a `severity_color` for dashboard triage.

**Scoring dimensions:**

| Dimension | Weight | Signal |
|-----------|--------|--------|
| Population Affected | 30% | PostGIS population density at coordinates |
| Health & Safety Risk | 30% | Category keywords (sewage, electrical, collapse) |
| Recurrence | 20% | Pinecone cluster size for this location |
| Time Sensitivity | 20% | Decay function — score increases with age |

---

### 2.2 Policy RAG Engine

**Owner:** Dev 1 (Backend) + Dev 2 (Omnichannel Intake)  
**Stack:** Pinecone, Claude Sonnet, LangChain  
**PRD Ref:** FR-2.2

A Retrieval-Augmented Generation engine that grounds agent decisions in actual municipal policy documents. When the Priority Agent scores a grievance or the system generates a response, it retrieves relevant policy clauses from a Pinecone index of municipal bylaws, SLA documents, and departmental guidelines.

**How it works:**
1. Municipal policy documents (PDFs) are chunked, embedded, and stored in a dedicated Pinecone namespace.
2. When a grievance is processed, the agent queries the policy index with the complaint context.
3. Retrieved policy chunks are injected into the LLM prompt as grounding context.
4. The agent cites specific policy clauses in its decisions (e.g., "Per Municipal Bylaw 14.3, sewage overflow must be addressed within 4 hours").

---

### 2.3 Auto-Appeal on SLA Breach

**Owner:** Dev 1 (Backend)  
**Stack:** LangChain, Browser-Use, n8n  
**PRD Ref:** FR-5.2

When a grievance exceeds its SLA deadline (derived from the Policy RAG Engine), the system automatically escalates. It generates a formal appeal document citing the specific SLA violation, the elapsed time, and the impact score — then files it on the relevant government portal via Browser-Use and notifies the citizen.

**Trigger logic:**
1. A background scheduler checks all open events against their SLA deadlines every 15 minutes.
2. Events exceeding the SLA trigger the Auto-Appeal chain.
3. LangChain generates the appeal document with policy citations.
4. Browser-Use files the appeal on the government portal.
5. n8n sends a WhatsApp notification to the citizen with the appeal confirmation.

---

### 2.4 Multimodal Parallel Ingestion

**Owner:** Dev 2 (Omnichannel Intake)  
**Stack:** n8n, OCR Engine, Bhashini STT, Claude Sonnet  
**PRD Ref:** FR-1.1, FR-1.2, FR-1.3

The system ingests complaints from four channels simultaneously, each with its own processing pipeline:

| Channel | Processing |
|---------|-----------|
| **WhatsApp Text** | LLM classification → structured event |
| **WhatsApp Voice** | Bhashini STT → LLM classification → structured event |
| **Web Portal** | Form parsing → LLM enrichment → structured event |
| **Handwritten Letter** | OCR → LLM classification → structured event |

All four pipelines converge at Pinecone — every complaint becomes a vector embedding with identical schema regardless of source channel.

---

### 2.5 Semantic Duplicate & Cluster Engine

**Owner:** Dev 1 (Backend) + Dev 2 (Omnichannel Intake)  
**Stack:** Pinecone, PostGIS  
**PRD Ref:** FR-3.1

The engine that powers Root-Cause Collapse (Feature 1.4). Operates in three dimensions:

1. **Semantic similarity** — Pinecone cosine similarity > 0.85 between event embeddings.
2. **Spatial proximity** — PostGIS `ST_DWithin` query, 2 km radius between complaint coordinates.
3. **Temporal window** — Events within the last 12 hours.

Events matching all three dimensions are grouped into a cluster. The cluster's `impact_score` is the sum of its constituent scores, ensuring systemic issues rise to the top of the triage queue.

---

## Tier 3 — Operational Excellence

### 3.1 Hotspot Heatmap

**Owner:** Dev 3 (Command Center)  
**Stack:** Next.js 15, Leaflet/Mapbox, PostGIS  
**PRD Ref:** FR-6.1

An interactive geographic heatmap on the Command Center dashboard that visualizes complaint density in real time. Hotspots are colored by severity (red = critical, amber = moderate, green = low). Clicking a hotspot drills down into the constituent complaints and any active clusters.

---

### 3.2 Executive Reports

**Owner:** Dev 3 (Command Center)  
**Stack:** Next.js 15, shadcn/ui Charts  
**PRD Ref:** FR-6.2

Auto-generated summary reports for department heads and commissioners:

- **Daily Pulse:** New complaints, resolutions, SLA breaches, top clusters.
- **Weekly Trends:** Category distribution over time, resolution velocity, officer performance.
- **On-Demand:** Filterable by ward, department, date range, severity.

All reports are exportable as PDF and rendered in the Command Center's minimalist Apple-style design system.

---

### 3.3 Department Leaderboard

**Owner:** Dev 3 (Command Center)  
**Stack:** Next.js 15, WebSocket, shadcn/ui  
**PRD Ref:** FR-6.3

A real-time ranked leaderboard comparing departments by:

| Metric | Description |
|--------|-------------|
| **Mean Time-to-Resolution** | Average hours from complaint to verified closure |
| **SLA Compliance Rate** | Percentage of complaints resolved within policy SLA |
| **Citizen Satisfaction** | Average feedback rating from post-resolution survey |
| **Cluster Resolution Rate** | Percentage of systemic root causes resolved (not just individual tickets) |

---

### 3.4 Anomaly Detection

**Owner:** Dev 1 (Backend)  
**Stack:** LangChain, Pinecone, PostGIS  
**PRD Ref:** FR-3.3

The system monitors complaint patterns for statistical anomalies — sudden spikes in a specific category or ward that deviate from the rolling 30-day baseline. When an anomaly is detected, it's surfaced as an alert on the Command Center dashboard with a generated hypothesis (e.g., "300% increase in electrical complaints in Ward 14 — possible transformer failure").

---

### 3.5 Citizen Feedback Loop

**Owner:** Dev 2 (Omnichannel Intake) + Dev 1 (Backend)  
**Stack:** n8n, WhatsApp API  
**PRD Ref:** FR-4.4

After a case is closed, the citizen receives a WhatsApp message with:

1. A summary of the resolution.
2. The verification photo (if applicable).
3. A satisfaction survey (1–5 stars + optional comment).

Feedback scores are stored against the event and the assigned officer, feeding into the Department Leaderboard (Feature 3.3) and officer performance metrics.

---

### 3.6 Budget Impact Estimator

**Owner:** Dev 1 (Backend)  
**Stack:** LangChain, Claude Sonnet  
**PRD Ref:** FR-6.4

For each root-cause cluster, the system estimates the budget impact of resolution vs. inaction. Using the Policy RAG Engine (Feature 2.2) and historical data, Claude Sonnet generates a cost-benefit summary:

- **Estimated resolution cost** (e.g., pipeline repair: ₹2.4L).
- **Estimated cost of inaction** (e.g., continued water tanker deployment: ₹12L/month).
- **Citizens affected** (derived from PostGIS population density).

This gives commissioners actionable financial data alongside the operational urgency.

---

## Demo Script — 5 Minutes

> A structured walkthrough for live demo. Each step maps to a Tier 1 feature.

### Setup (before demo)

- All services running via `docker compose up`.
- Command Center open on the projector (`http://localhost:3000`).
- Field Worker App open on a physical phone.
- n8n workflow dashboard visible in a browser tab.

### Minute 0:00–1:00 — The Complaint

**Narrator:** *"A citizen in Hyderabad sends a WhatsApp voice note in Hindi: 'Hamare mohalle mein paani ka pressure bahut kam hai, do din se pareshaan hain.'"*

1. Show the WhatsApp message arriving in n8n.
2. n8n triggers Bhashini STT → Hindi transcript appears.
3. Claude Sonnet classifies it: `MUNICIPAL > Water Supply > Low Pressure`.
4. Event written to Pinecone — show the structured JSON.

**Feature highlighted:** [Multilingual Voice Intake](#13-multilingual-voice-intake), [Multimodal Parallel Ingestion](#24-multimodal-parallel-ingestion)

### Minute 1:00–2:00 — Cluster Detection

**Narrator:** *"This isn't the only complaint. 23 similar reports have come in from the same ward in the last 6 hours."*

1. Switch to the Command Center's Live Agent Canvas.
2. Show the Cluster Analysis node activating — semantic similarity matches lighting up.
3. The 24 complaints collapse into one root-cause event: **"Pumping Station #7 — Pressure Drop"**.
4. Impact score jumps to **92** (red severity).

**Feature highlighted:** [Knowledge Graph with Root-Cause Collapse](#14-knowledge-graph-with-root-cause-collapse), [Semantic Duplicate & Cluster Engine](#25-semantic-duplicate--cluster-engine)

### Minute 2:00–3:00 — Autonomous Dispatch

**Narrator:** *"The system identifies the nearest qualified officer and dispatches them — no human manager involved."*

1. Show the Spatial Matchmaker node on the Live Agent Canvas querying PostGIS.
2. Officer Raj Kumar (OP-441) is selected — 1.2 km away, domain: Municipal/Water.
3. `NEW_DISPATCH` WebSocket event fires.
4. Command Center map shows the officer pin and the event pin with a route line.
5. Switch to the Field Worker App on the phone — the new task appears with details.

**Feature highlighted:** [Live Agent Canvas](#12-live-agent-canvas), [Priority Agent with Impact Matrix](#21-priority-agent-with-impact-matrix)

### Minute 3:00–4:00 — Autonomous Portal Filing

**Narrator:** *"Simultaneously, the system files this grievance on the government portal — no human data entry."*

1. Show Browser-Use launching a headless browser session (screen recording or live Playwright).
2. The browser navigates to the government grievance portal.
3. Form fields are filled automatically from the structured event data.
4. Submission succeeds — confirmation number and screenshot are captured.

**Feature highlighted:** [Autonomous Portal Filing](#11-autonomous-portal-filing)

### Minute 4:00–5:00 — AI-Verified Resolution

**Narrator:** *"The officer arrives, fixes the valve, and takes a photo. But we don't trust self-reported closures."*

1. Switch to the Field Worker App — officer taps "Mark Resolved" and captures a photo of the repaired valve.
2. Photo uploads to the backend.
3. Show Gemini Flash Vision analyzing the image — confidence: 0.94, verdict: `PASS`.
4. Case closes on the Command Center dashboard — the event dot turns green.
5. WhatsApp notification sent to the citizen: *"Your complaint has been resolved. Here is the verification photo."*

**Feature highlighted:** [AI-Verified Resolution](#15-ai-verified-resolution), [Citizen Feedback Loop](#35-citizen-feedback-loop)

### Closing (5:00)

**Narrator:** *"From voice note to verified resolution — autonomously. No clerk, no round-robin, no self-reported closure. This is Zero-Bureaucracy Governance."*

---

> **Full product requirements, personas, and success metrics:** [docs/PRD.md](PRD.md)  
> **Architecture overview and quick start:** [README.md](../README.md)
