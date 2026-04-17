# Civix-Pulse — Feature Roadmap

> Tier-wise breakdown of all features, organized by judge-impact and demo priority.
>
> **Tiering rule**: Tier 1 = the five features that define the pitch and *must* work on stage. Tier 2 = technical depth that proves engineering rigor. Tier 3 = polish and roadmap items.

---

## Tier 1 — "They'll Remember Us" (5 Features, Must Work Live)

These are the hero moments. If any breaks on stage, the pitch loses its spine.

### 1. Autonomous Portal Filing (Computer-Use Agent)

The single most memorable moment of the demo. An agent watches a grievance arrive, opens a headless Chromium, navigates a mock government portal, fills the work-order form, and submits — on its own. A screen recording plays inline in the dashboard.

- Browser-Use (open source) + Playwright underneath.
- Mock portal: a dead-simple Flask app — 4 text fields, 1 dropdown, 1 submit. No auth, no captcha.
- LLM drives via accessibility tree first (cheap, fast), falls back to screenshots for visual-only elements.
- Full session recorded as a Playwright trace — tamper-proof audit log.
- **Why it wins**: zero-API integration for the 80% of government portals that will never expose REST. No other civic-AI team will show this.

### 2. Live Agent Orchestration Canvas

Real-time UI showing LangGraph nodes activating as agents process a grievance: ingestion → triage → clustering → resolution.

- Visualizes the LangGraph state machine in the browser.
- Each node pulses on activation; edges animate data flow; status badges show `idle` / `processing` / `complete` / `error`.
- Built-in reasoning trace: every node logs its chain-of-thought (inputs → logic → output → confidence). Visible as a collapsible panel per complaint.
- **Time budget**: 4–5 hours max. If animations are eating time, fall back to a clean sequential log with status badges.

### 3. Multilingual Voice-First Intake (Bhashini)

Citizen sends a Hindi voice note on WhatsApp → transcribed, translated, classified, routed. One 60-second clip of a citizen complaining in Hindi is worth more than any slide.

- Bhashini hosted STT + translation APIs. Hindi + English only — one language working perfectly beats three with edge-case glitches.
- WhatsApp Business sandbox as the channel (Telegram fallback if WhatsApp provisioning is slow).
- Response translated back to citizen's language.
- **Pre-work**: provision Bhashini API access in advance. Pre-record 3–4 audio clips in Hindi. Have a Whisper fallback if Bhashini is down.
- **India-context win**: judges from Indian institutions look for this explicitly.

### 4. Governance Knowledge Graph with Root-Cause Collapse

Force-directed graph linking complaints → infrastructure → departments → officers. When the Systemic Auditor detects 50 low-pressure complaints tracing to one pump station, the graph **visually collapses** them into a single root-cause node.

- Interactive, zoomable (Cytoscape.js or D3-force).
- Nodes: complaints, infrastructure assets, departments, officers.
- Edges: `assigned_to`, `caused_by`, `resolved_by`, `affects`.
- Root-cause collapse animation is the visual payoff.
- LLM generates a plain-language hypothesis per cluster: *"Fixing Pump Station 7 would likely resolve 47 of these complaints."*
- **Honesty note**: this is clustering (DBSCAN on embeddings) + LLM narrative, not formal causal inference. Call it "root-cause hypothesis" in the pitch.

### 5. AI-Verified Resolution Pipeline

Field officer submits a "verification photo" → vision model confirms the issue is actually fixed before the ticket closes. Not just human-says-done — **AI-confirms-done**.

- Gemini Flash vision compares the verification photo against complaint context.
- Binary verdict (`Resolved` / `Not Resolved`) + confidence score + one-sentence justification.
- Prevents fraudulent "issue closed" claims.
- Implementation: ~2 hours. One prompt, one image, structured output.
- **Why Tier 1**: corruption prevention is the story every judge remembers. This is a trust differentiator.

---

## Tier 2 — "Yes, It's Real" (5 Features, Happy-Path Demo)

Technical depth that proves engineering rigor. Each should work on a happy-path demo.

### 6. Priority Agent with Sentiment, Vulnerability & SLA Awareness

One unified priority scorer that combines everything — not three separate features.

- **Impact Matrix**: severity × blast-radius × vulnerability × sentiment-urgency × time-decay.
- **Sentiment analysis**: desperate vs routine tone (single LLM call with structured output).
- **Vulnerability flags**: elderly, disabled, low-income (keyword + LLM-scored).
- **SLA breach prediction**: category + department workload + time-in-queue → breach probability. Auto-escalates with a generated briefing when threshold exceeded.
- Reasoning trace emitted as structured JSON → displayed in the canvas's collapsible panel.
- This is one prompt with one structured output schema, not four features.

### 7. Constitutional / Policy RAG Engine

RAG pipeline over government policy documents, RTI acts, municipal bylaws. On each complaint, auto-cites relevant policy, applicable SLA, responsible authority.

- **Scope control**: exactly 5 PDFs. Karnataka Right to Services Act, one RTI act, one municipal bylaw, two departmental SLA docs.
- Chunk, embed, retrieve, cite alongside the grievance in the dashboard.
- Enables **governed AI with verifiable citations** — a scoring criterion judges check for.

### 8. Auto-Appeal & Mock UPI Compensation

On SLA breach, the system drafts a Right-to-Services Commission appeal as a PDF and shows a mock UPI payout toast.

- LLM generates a legally-plausible appeal letter → rendered as downloadable PDF.
- Frontend shows `"₹250 credited to citizen UPI for SLA breach"` notification.
- No real UPI integration needed.
- **Social-impact punchline**: the system costs the government money when it fails. This changes bureaucratic behavior.
- ~2 hours to build. Don't skip it — it's the emotional close of the pitch.

### 9. Multimodal Parallel Ingestion Demo

Three modalities processed simultaneously through the Agent Canvas.

- **Handwritten letter** → OCR → structured JSON.
- **Voice complaint** → Bhashini STT → classified grievance.
- **Text / WhatsApp** → NLP → categorized complaint.
- All three flowing through the canvas at once. Visual proof the swarm is real.

### 10. Semantic Duplicate & Cluster Engine

Embedding-based similarity search auto-merges near-duplicate complaints.

- pgvector + embedding model (OpenAI, Cohere, or open-source).
- Auto-merge with a representative summary per cluster.
- Citizen-facing: *"47 others reported this same issue."*
- Feeds directly into the Knowledge Graph's root-cause collapse (#4).

---

## Tier 3 — "Polish & Roadmap" (If Time Permits)

Time-permitting. Most mockable in 20 minutes.

### 11. Predictive Hotspot Heatmap

Leaflet/Mapbox complaint density map with category filters. A clean density heatmap with drill-down is valuable and honest.

### 12. Auto-Generated Executive Reports

One-click PDF: systemic issues, resolution metrics, department scorecards. LLM-written narrative + charts.

### 13. Department Performance Leaderboard

Gamified scorecards — fastest resolvers, lowest reopen rate, highest satisfaction. Competitive accountability layer.

### 14. Anomaly Spike Detection

Real-time alert on abnormal volume spikes. *"⚠️ 300% increase in water complaints in Zone 4."* Auto-triggers emergency workflow.

### 15. Citizen Feedback Loop

Post-resolution rating via WhatsApp/SMS. Stars + optional text → feeds officer performance metrics. Closes the loop.

### 16. Budget Impact Estimator

*"Fixing pump X costs ₹2L but resolves 50 complaints affecting 2,000 residents."* Ranks systemic issues by ROI.

---

## Demo Script (5 Minutes)

1. **Problem framing** (30s) — 30 lakh grievances/year, 16-day resolution. *"Complaints are treated as tickets to close, not insights to solve."*

2. **Citizen submits** a Hindi WhatsApp voice note live (Tier 1 #3). Arrives on screen.

3. **Ingestion Swarm** processes it alongside a pre-staged handwritten letter + text complaint — three channels in parallel (Tier 2 #9).

4. **Agent Canvas** lights up node-by-node (Tier 1 #2). Priority scores with sentiment and vulnerability reasoning visible (Tier 2 #6).

5. **Systemic Auditor** links to 47 existing complaints. **Knowledge Graph collapses** to one root cause (Tier 1 #4). LLM narrates: *"Pump Station 7 pressure drop — fixing it resolves 47 tickets."*

6. **SLA breach on an older ticket** → auto-appeal PDF generates, mock UPI credit: *"₹250 sent to the citizen. When the system fails, it pays."* (Tier 2 #8).

7. **🔥 Hero moment** — *"And here's how the system resolves it."* Resolution Agent opens a browser, fills the government portal, submits. Narrate while it runs. (Tier 1 #1). 30 seconds.

8. **Verification** — officer uploads a photo, vision AI confirms resolved (Tier 1 #5). Quick, clean.

9. **Close** (45s) — architecture slide, cost curve, roadmap. *"We don't route tickets. We detect, resolve, and penalize."*

---

*This document is the single source of truth for Civix-Pulse feature scope and prioritization.*
