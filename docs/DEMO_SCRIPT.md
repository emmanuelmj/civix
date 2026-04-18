# Civix-Pulse — A-Z Demo Script for Judges

> **Setup**: Two browser windows side-by-side.
> - **Left**: Command Center Dashboard → `http://localhost:3000`
> - **Right**: Field Worker App → `http://localhost:3001`
> - **Backend** running on port 8000 (silent — no need to show)

---

## 🎬 ACT 1: The Problem (30 seconds)

**SAY**: *"Today, public grievances are treated as tickets to close — not insights to solve. Data is siloed across departments. Our system, Civix-Pulse, flips this with an autonomous AI swarm that ingests, prioritizes, clusters, and dispatches — zero human bureaucracy."*

---

## 🎬 ACT 2: Command Center Overview (1 minute)

**SHOW** the Command Center dashboard (left screen).

1. **Map View** — Point out:
   - Colored dots = real citizen complaints across Hyderabad
   - Blue blips = field officers on the ground
   - Heatmap layer showing complaint density hotspots
   - Click a dot → slide-out panel shows AI analysis, impact score, assigned officer

2. **Sidebar Navigation** — Quick clicks:
   - **Intake Feed** → live feed of incoming complaints with urgency bars
   - **Analytics** → domain breakdown, avg impact score, resolution rate
   - **Officers** → 8 officers, their skills, active task count
   - **Swarm Log** → real-time agent trace (what each AI agent decided)

**SAY**: *"This is the real-time command center. Everything you see is powered by live data from PostgreSQL and Pinecone vector DB — not mock data."*

---

## 🎬 ACT 3: Live Ingestion Demo (2 minutes) ⭐ KEY MOMENT

This is the showstopper. You trigger a new complaint and watch the entire pipeline execute in real-time.

### Step 1: Trigger the Swarm

On the dashboard, click the green **🎯 Demo** button (top-right area).

**SAY**: *"A new citizen complaint just came in — let's say someone reports a sewage overflow via WhatsApp. Watch what happens."*

### Step 2: Watch the Pipeline (real-time on dashboard)

Within 3-5 seconds, the following happens automatically:
1. **Swarm Log** lights up with the agent trace:
   - `🔍 Auditor Agent` → Checks if this is part of a larger systemic issue (cluster analysis)
   - `⚡ Priority Agent` → LLM scores the complaint using an Impact Matrix (0-100)
   - `📢 Amplifier Agent` → If cluster found, boosts priority score
   - `🚀 Dispatch Agent` → Matches nearest qualified officer by skills + distance

2. **Map** → A new colored dot appears at the complaint location
3. **Dispatch line** → A line draws from the officer to the complaint (shows assignment)
4. **Intake Feed** → New entry slides in at top with urgency bar

**SAY**: *"Four autonomous agents just processed this complaint in under 5 seconds. The auditor checked for systemic patterns, the priority agent scored it using GPT-4.1, and the dispatch agent found the nearest qualified officer — all without any human intervention."*

### Step 3: Show the AI Analysis

Click the new dot on the map. The slide-out panel shows:
- **Impact Score**: e.g., 85/100
- **Severity Color**: Red/Orange/Green
- **Assigned Officer**: Name + distance
- **AI Reasoning**: Why the LLM scored it that way
- **Agent Trace**: Full pipeline execution log

---

## 🎬 ACT 4: Field Worker Experience (1.5 minutes)

Switch to the **right screen** (Field Worker App at port 3001).

### Step 1: Login + Go On Duty

- The splash screen shows "Initializing secure connection..." (checks backend health)
- Login screen → tap **GO ON DUTY**
- Duty overlay shows officer profile loaded from DB:
  - Officer ID: OP-101
  - Name: Rajesh Kumar
  - Role: Municipal Water

### Step 2: View Assigned Tasks

- Dashboard shows **AWAITING DISPATCHES (15)** — all real data from PostgreSQL
- Each card shows: issue type, description, priority badge, distance, impact score
- Cards are sorted by recency

**SAY**: *"The field worker sees only tasks assigned to them by the AI swarm. These are real dispatches from the same pipeline we just watched."*

### Step 3: Accept & Navigate

- Tap **ACCEPT** on any dispatch card
- Active Task view shows full details
- Tap **🗺 GET DIRECTIONS** → Opens Google Maps with the exact coordinates
- Tap **🤝 REQUEST SUPPORT** → AI swarm dispatches a cross-department worker

### Step 4: Verify Resolution

- Tap **✓ TASK COMPLETED**
- Verification screen → tap **SIMULATE CAPTURE** (web demo mode)
- AI verification spinner runs for 3 seconds
- ✅ "Resolution Verified" — the backend marks the event as RESOLVED

**SAY**: *"The field worker just submitted a verification photo. The AI validates it and closes the ticket. The command center updates in real-time."*

---

## 🎬 ACT 5: Cluster Detection — Systemic Intelligence (1 minute) ⭐ DIFFERENTIATOR

**SAY**: *"But Civix-Pulse doesn't just handle tickets — it finds systemic problems."*

Click the blue **⚡ Trigger Swarm** button to fire 5 complaints at once.

Watch the Swarm Log:
- Some events will show: `🔍 HEURISTIC CLUSTER DETECTED`
- The **Amplifier Agent** boosts the priority score
- Multiple related complaints (e.g., 50 water pressure complaints → pump station failure) get linked

**SAY**: *"The auditor agent just detected that these 5 water complaints all originate from the same area. Instead of creating 5 separate tickets, it identifies a systemic root cause — likely a pumping station failure — and escalates it as a single high-priority cluster."*

---

## 🎬 ACT 6: Architecture Walkthrough (30 seconds)

If judges ask about architecture:

- **4 LangGraph Agents**: Auditor → Priority → Amplifier → Dispatch (cyclic state graph)
- **Pinecone Vector DB**: Stores all complaints as embeddings; watcher polls every 5s with status flags (NEW → PROCESSED)
- **PostgreSQL**: Events, officers, dispatch logs — full audit trail
- **WebSocket**: Real-time push to dashboard (no polling)
- **n8n Integration**: Webhooks for external ingestion (WhatsApp, Twitter, voice, OCR)

---

## 💡 Key Talking Points for Judges

1. **"Zero-Bureaucracy"**: End-to-end autonomous — complaint to resolution with no human routing
2. **"Insights, not Tickets"**: Cluster analysis finds root causes from individual complaints
3. **"Real AI, not chatbot"**: LLM-scored impact matrix with reasoning, not just keyword matching
4. **"Enterprise-grade"**: Full audit trail, officer tracking, verification photos, time-to-resolution
5. **"Production-ready architecture"**: LangGraph state machine, async PostgreSQL, Pinecone vector search, WebSocket real-time

---

## ⚡ Quick-Start Checklist (Before Demo)

```bash
# 1. Backend (terminal 1)
cd backend && .\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Frontend (terminal 2)
cd command-center && npx next dev --turbopack -p 3000

# 3. Field Worker App (terminal 3)
cd field-worker-app && npx expo start --web --port 3001

# 4. Open browsers
# Left:  http://localhost:3000  (Command Center)
# Right: http://localhost:3001  (Field Worker App)
```

**Pre-demo**: Click "🎯 Demo" once to warm up the LLM API. First call takes ~3s, subsequent calls are faster.
