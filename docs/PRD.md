# Product Requirements Document

> **Civix-Pulse** — Zero-Bureaucracy Governance  
> AI4Impact 2025 · PS 6 · Agentic Governance & Grievance Resolution Swarm

---

## 1. Executive Summary

Civix-Pulse is a multi-agent AI system that transforms public grievance resolution from a reactive, ticket-based process into an autonomous, intelligence-driven pipeline. The system ingests citizen complaints from any channel (WhatsApp, voice, handwritten letters, web), identifies systemic root causes through semantic clustering, dispatches field officers using spatial intelligence, and verifies resolution through AI-powered photo analysis — all without human managerial intervention.

The platform is designed for municipal and state governance bodies processing high volumes of citizen grievances, where departmental silos, manual triage, and self-reported closures result in slow resolution, wasted resources, and eroded public trust.

> **See also:** [README.md](../README.md) for architecture diagrams and quick start. [Features](features.md) for the full feature catalog and demo script.

---

## 2. Problem Statement

### 2.1 Scale

India's centralized grievance portals — CPGRAMS, PGPortal, and state-level equivalents — collectively process over **30 lakh (3 million) grievances per year**. Municipal corporations in metropolitan cities handle an additional 5–15 lakh complaints annually through local channels (phone, walk-in, WhatsApp).

### 2.2 Current Performance

| Metric | Current State | Target with Civix-Pulse |
|--------|--------------|------------------------|
| Mean Time-to-Resolution | 16 days (national average); 45+ days in many municipalities | < 48 hours for standard issues |
| First Response Time | 3–5 business days | < 15 minutes (automated acknowledgment + triage) |
| Duplicate Detection Rate | < 5% (manual, ad-hoc) | > 85% (semantic + spatial + temporal) |
| Root-Cause Identification | Rare — each ticket treated independently | Automated for all clustered events |
| Resolution Verification | Self-reported by department | AI-verified via photo analysis |
| Citizen Feedback Collection | < 2% of resolved cases | 100% (automated WhatsApp survey) |

### 2.3 Root Causes of Failure

1. **Departmental Silos:** Complaints are routed to departments by category. A burst water main causes low-pressure complaints (Water Dept), road damage (Roads Dept), and sewage backup (Sanitation Dept) — all handled independently, none linked to the root cause.

2. **Ticket Mentality:** Success is measured by closure rate, not outcome. Departments are incentivized to close tickets, not solve problems. A complaint marked "resolved" may have received no actual intervention.

3. **Manual Triage:** Clerks manually read, categorize, and route complaints. This creates bottlenecks, inconsistent categorization, and delayed response — especially for non-English or voice-based complaints.

4. **No Verification:** Resolution is self-reported by the assigned department or officer. There is no independent verification that the issue was actually fixed.

5. **Zero Feedback Loop:** Citizens are rarely informed of resolution status. There is no mechanism for citizens to confirm or dispute the closure.

---

## 3. User Personas

### 3.1 Citizen — Priya Sharma

| Attribute | Detail |
|-----------|--------|
| **Role** | Resident of Ward 14, Hyderabad |
| **Age** | 34 |
| **Tech Comfort** | Uses WhatsApp daily; uncomfortable with government web portals |
| **Language** | Hindi primary, limited English |
| **Pain Points** | Filed a water complaint 3 weeks ago on PGPortal; received no update; doesn't know if it was even read |
| **Goal** | File a complaint in her language, get acknowledgment, receive a real resolution |

**Civix-Pulse experience:** Priya sends a WhatsApp voice note in Hindi describing the low water pressure. Within 2 minutes, she receives a WhatsApp reply: *"Your complaint has been received. Category: Water Supply. Priority: High. A field officer has been dispatched."* When the issue is resolved, she receives a verification photo and a satisfaction survey.

### 3.2 Ward Officer — Raj Kumar

| Attribute | Detail |
|-----------|--------|
| **Role** | Field Officer, Municipal Water Division |
| **ID** | OP-441 |
| **Age** | 28 |
| **Tech Comfort** | Smartphone user; prefers mobile apps over desktop |
| **Pain Points** | Receives assignments via paper registers or phone calls; no GPS routing; resolution status is reported verbally to supervisor |
| **Goal** | Get clear, prioritized tasks on his phone with location and context |

**Civix-Pulse experience:** Raj receives a push notification on the Field Worker App with the complaint details, location pin, and optimal route. After fixing the issue, he photographs the repair and taps "Mark Resolved." The AI verifies the photo and closes the case — no paperwork, no phone calls.

### 3.3 Department Head — Dr. Ananya Reddy

| Attribute | Detail |
|-----------|--------|
| **Role** | Head, Municipal Water Supply Department |
| **Age** | 52 |
| **Pain Points** | Relies on monthly PDF reports that are 2 weeks stale; cannot identify systemic failures until they become political crises; no visibility into officer performance |
| **Goal** | Real-time visibility into complaint patterns, officer performance, and systemic risks |

**Civix-Pulse experience:** Dr. Reddy opens the Command Center dashboard and sees a red hotspot in Ward 14 — 24 water complaints clustered around Pumping Station #7. The system has already identified the root cause, dispatched an officer, and filed on the government portal. She clicks the cluster to see the full reasoning trace and budget impact estimate.

### 3.4 Commissioner — Shri Venkat Rao

| Attribute | Detail |
|-----------|--------|
| **Role** | Municipal Commissioner, Greater Hyderabad |
| **Age** | 58 |
| **Pain Points** | Accountable for city-wide grievance resolution metrics; data arrives late and aggregated; cannot drill down or act in real time |
| **Goal** | Enterprise-grade analytics with drill-down capability; departmental accountability; cost-benefit visibility |

**Civix-Pulse experience:** Commissioner Rao reviews the weekly Executive Report showing a 73% reduction in mean resolution time, a department leaderboard ranking Water Supply as the top performer, and a budget impact analysis showing ₹14L saved by proactive cluster resolution vs. reactive individual repairs.

---

## 4. Product Objectives & Success Metrics

### 4.1 Primary Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| O1 | Reduce mean time-to-resolution | < 48 hours (from 16 days baseline) |
| O2 | Eliminate duplicate processing | > 85% duplicate detection rate |
| O3 | Enable root-cause identification | 100% of clustered events have a generated root-cause hypothesis |
| O4 | Eliminate self-reported closures | 100% of resolutions verified by AI photo analysis |
| O5 | Provide omnichannel access | ≥ 4 intake channels operational (WhatsApp text, voice, web, handwritten) |
| O6 | Deliver real-time operational visibility | < 5 second latency from event to dashboard display |

### 4.2 Secondary Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| O7 | Automate government portal filing | > 90% success rate on target portal |
| O8 | Enable multilingual intake | Hindi voice complaints processed end-to-end |
| O9 | Provide budget impact intelligence | Cost-benefit estimate generated for every root-cause cluster |
| O10 | Collect citizen feedback | Satisfaction survey sent for 100% of resolved cases |

---

## 5. Functional Requirements

### FR-1: Multimodal Ingestion

| ID | Requirement | Priority | Owner |
|----|------------|----------|-------|
| FR-1.1 | The system shall ingest text complaints via WhatsApp webhook and web form. | P0 | Dev 2 |
| FR-1.2 | The system shall process handwritten letters via OCR and extract structured text. | P0 | Dev 2 |
| FR-1.3 | The system shall transcribe Hindi voice complaints using Bhashini STT and classify them via LLM. | P0 | Dev 2 |
| FR-1.4 | All ingested complaints shall be converted to a unified schema and stored as vector embeddings in Pinecone. | P0 | Dev 2 |
| FR-1.5 | The ingestion pipeline shall trigger the backend analysis webhook upon successful processing. | P0 | Dev 2 |

> **Feature ref:** [Multimodal Parallel Ingestion](features.md#24-multimodal-parallel-ingestion), [Multilingual Voice Intake](features.md#13-multilingual-voice-intake)

### FR-2: Intelligent Triage

| ID | Requirement | Priority | Owner |
|----|------------|----------|-------|
| FR-2.1 | The Priority Agent shall score every grievance using the Impact Matrix (population affected, health risk, recurrence, time sensitivity) and produce an `impact_score` (1–100) and `severity_color`. | P0 | Dev 1 |
| FR-2.2 | The Priority Agent shall ground its decisions in municipal policy documents retrieved via the Policy RAG Engine. | P1 | Dev 1, Dev 2 |
| FR-2.3 | The system shall assign a category and subcategory to every grievance using LLM classification. | P0 | Dev 2 |

> **Feature ref:** [Priority Agent with Impact Matrix](features.md#21-priority-agent-with-impact-matrix), [Policy RAG Engine](features.md#22-policy-rag-engine)

### FR-3: Systemic Analysis

| ID | Requirement | Priority | Owner |
|----|------------|----------|-------|
| FR-3.1 | The Cluster Engine shall detect semantically similar complaints (cosine similarity > 0.85) within a 2 km radius and 12-hour window and group them into clusters. | P0 | Dev 1 |
| FR-3.2 | For each cluster, the system shall generate a root-cause hypothesis using LLM analysis. | P0 | Dev 1 |
| FR-3.3 | The system shall detect anomalous complaint spikes that deviate from the 30-day rolling baseline and generate alerts. | P1 | Dev 1 |

> **Feature ref:** [Knowledge Graph with Root-Cause Collapse](features.md#14-knowledge-graph-with-root-cause-collapse), [Semantic Duplicate & Cluster Engine](features.md#25-semantic-duplicate--cluster-engine), [Anomaly Detection](features.md#34-anomaly-detection)

### FR-4: Autonomous Resolution

| ID | Requirement | Priority | Owner |
|----|------------|----------|-------|
| FR-4.1 | The Spatial Matchmaker shall query PostGIS for the nearest available officer matching the complaint's domain and dispatch them via WebSocket. | P0 | Dev 1 |
| FR-4.2 | The Field Worker App shall display assigned tasks with complaint details, location pin, and navigation. | P0 | Dev 4 |
| FR-4.3 | The system shall verify resolution via AI photo analysis (Gemini Flash Vision) and require ≥ 0.80 confidence to close a case. | P0 | Dev 1, Dev 4 |
| FR-4.4 | Upon verified closure, the system shall notify the citizen via WhatsApp with resolution summary, verification photo, and satisfaction survey. | P1 | Dev 2 |

> **Feature ref:** [AI-Verified Resolution](features.md#15-ai-verified-resolution), [Citizen Feedback Loop](features.md#35-citizen-feedback-loop)

### FR-5: Accountability & Automation

| ID | Requirement | Priority | Owner |
|----|------------|----------|-------|
| FR-5.1 | The system shall autonomously file grievances on government portals (CPGRAMS/PGPortal) via Browser-Use + Playwright. | P0 | Dev 1 |
| FR-5.2 | The system shall auto-escalate cases that breach SLA deadlines by filing appeals on government portals and notifying citizens. | P1 | Dev 1 |
| FR-5.3 | Every autonomous decision (scoring, clustering, dispatching, filing) shall be logged with a full reasoning trace (LLM prompt, response, rationale). | P0 | Dev 1 |
| FR-5.4 | The Command Center shall provide a Live Agent Canvas showing real-time agent state transitions and reasoning traces. | P0 | Dev 3 |

> **Feature ref:** [Autonomous Portal Filing](features.md#11-autonomous-portal-filing), [Auto-Appeal on SLA Breach](features.md#23-auto-appeal-on-sla-breach), [Live Agent Canvas](features.md#12-live-agent-canvas)

### FR-6: Analytics & Reporting

| ID | Requirement | Priority | Owner |
|----|------------|----------|-------|
| FR-6.1 | The Command Center shall display a real-time geographic heatmap of complaint density, colored by severity. | P0 | Dev 3 |
| FR-6.2 | The system shall generate daily and weekly executive reports with key metrics (new complaints, resolutions, SLA breaches, top clusters). | P1 | Dev 3 |
| FR-6.3 | The Command Center shall display a department leaderboard ranked by mean time-to-resolution, SLA compliance, and citizen satisfaction. | P1 | Dev 3 |
| FR-6.4 | For each root-cause cluster, the system shall generate a budget impact estimate (cost of resolution vs. cost of inaction). | P2 | Dev 1 |

> **Feature ref:** [Hotspot Heatmap](features.md#31-hotspot-heatmap), [Executive Reports](features.md#32-executive-reports), [Department Leaderboard](features.md#33-department-leaderboard), [Budget Impact Estimator](features.md#36-budget-impact-estimator)

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| Ingestion-to-dashboard latency | < 5 seconds end-to-end |
| WebSocket broadcast latency | < 500 ms from event creation to client receipt |
| Cluster analysis execution time | < 3 seconds per event |
| Concurrent WebSocket connections | ≥ 50 (dashboard + mobile clients) |

### 6.2 Scalability

| Requirement | Target |
|-------------|--------|
| Concurrent ingestion pipelines | 4 (WhatsApp text, voice, web, handwritten) |
| Pinecone index capacity | 100,000+ event embeddings |
| PostGIS spatial query performance | < 200 ms for nearest-officer lookup within 10 km |

### 6.3 Security & Privacy

| Requirement | Detail |
|-------------|--------|
| API Authentication | JWT-based auth for all backend endpoints |
| Data Encryption | TLS 1.3 for all API communication; AES-256 for data at rest |
| PII Handling | Citizen phone numbers and names are stored encrypted; not included in LLM prompts |
| Audit Trail | Every agent decision logged with timestamp, input, output, and rationale |

### 6.4 Deployment

| Requirement | Detail |
|-------------|--------|
| Local Development | Full stack runs via `docker compose up` on a consumer laptop (Dell Vostro 15 3000, 8 GB RAM) |
| Container Strategy | Lightweight Alpine-based images; no GPU required for inference (API-based LLMs) |
| Environment Configuration | All secrets via `.env` file; no hardcoded credentials |

### 6.5 Observability

| Requirement | Detail |
|-------------|--------|
| Logging | Structured JSON logs with correlation IDs linking complaint → agent decision → resolution |
| Health Checks | `/health` endpoint on all services for Docker health probes |
| Error Handling | Graceful degradation — if Pinecone is unreachable, events queue locally; if LLM fails, fallback to rule-based scoring |

---

## 7. Out of Scope

The following capabilities are explicitly **not** part of Civix-Pulse and will not be built:

| Capability | Reason |
|------------|--------|
| Satellite imagery analysis | Requires specialized infrastructure and data licensing beyond hackathon scope |
| CCTV / video surveillance integration | Privacy concerns and hardware dependencies |
| Proactive sensing (IoT sensors) | Requires physical hardware deployment |
| Deepfake / fraud detection on media | Not relevant to the core grievance resolution workflow |
| Multi-city / federated deployment | Single-city deployment for hackathon; federation is a post-launch concern |
| Native iOS/Android apps (non-Expo) | Expo provides sufficient cross-platform coverage for the hackathon |
| Offline-first mobile functionality | Requires significant additional architecture; officers are assumed to have connectivity |
| Custom LLM training / fine-tuning | API-based LLMs (Claude, Gemini) are sufficient; no training data or compute budget |

---

## 8. Social Impact Thesis

### 8.1 The Structural Inequity

Public grievance systems are designed for digitally literate, English-speaking citizens who can navigate complex web portals. This structurally excludes:

- **Non-English speakers** — 60%+ of India's urban population prefers to communicate in regional languages.
- **Low-literacy citizens** — Handwritten letters are the only viable channel for citizens who cannot type.
- **Digitally excluded populations** — Citizens without smartphones or internet access rely on voice calls and community intermediaries.

The result is a **grievance gap** — the citizens most in need of government services are the least able to access the grievance system.

### 8.2 How Civix-Pulse Addresses It

| Barrier | Civix-Pulse Solution |
|---------|---------------------|
| Language | Bhashini STT supports Hindi and other Indian languages; LLM translates to English for processing |
| Literacy | OCR engine processes handwritten letters in any script |
| Digital Access | WhatsApp voice notes — the most widely used messaging platform in India — serve as the primary intake channel |
| Transparency | Every citizen receives automated status updates and verification photos via WhatsApp |
| Accountability | AI-verified resolution eliminates fraudulent closures; citizen feedback directly impacts officer performance metrics |

### 8.3 Measurable Outcomes

If deployed at the scale of a single metropolitan municipal corporation (e.g., GHMC, Hyderabad):

| Metric | Projected Impact |
|--------|-----------------|
| Resolution time reduction | 16 days → < 48 hours (70%+ reduction) |
| Duplicate complaint processing eliminated | ~30% of complaints are duplicates; freeing ~90,000 clerk-hours/year |
| Root-cause resolutions | 1 fix resolves an average of 12 individual complaints |
| Citizen reach expansion | 40%+ increase in accessible intake channels (voice, handwritten) |
| Fraudulent closure elimination | 100% AI-verified; estimated 15–20% of current closures are unverified |

### 8.4 The Vision

Civix-Pulse is not a better ticketing system. It is a **paradigm shift** from treating grievances as administrative overhead to treating them as the **most valuable real-time intelligence feed** a government possesses. Every complaint is a data point. Every cluster is an insight. Every resolution is a measurable outcome.

The goal is not zero complaints — it is **zero unresolved root causes**.

---

> **Architecture and quick start:** [README.md](../README.md)  
> **Feature catalog and demo script:** [Features](features.md)
