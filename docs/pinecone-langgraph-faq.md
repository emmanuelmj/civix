# Civix-Pulse — Pinecone & LangGraph Deep-Dive FAQ

> Prepare these answers cold. Judges who specialize in governed intelligence
> will probe exactly these areas.

---

## PINECONE — Vector Database

### P1: "Why Pinecone? Why not Weaviate, Qdrant, or ChromaDB?"

> "Three reasons. First, **managed infrastructure** — Pinecone is serverless, we don't run any vector DB containers. For a 48-hour hackathon that's critical. Second, **metadata filtering** — we filter by `status='NEW'` to find unprocessed vectors. Pinecone lets us combine metadata filters with vector queries in a single call. Third, **namespace isolation** — we use `__default__` for live data and `civix-events` for historical data. Both are queried in parallel during cluster detection. ChromaDB is local-only and Weaviate would need us to manage a container."

---

### P2: "Explain your Pinecone index schema."

> **Index name:** `civix-raw`
> **Dimension:** 1024 (Cohere embed-english-v3.0)
> **Metric:** Cosine similarity
> **Namespaces:**
> - `""` (__default__) — live incoming grievances from n8n
> - `civix-events` — historical corpus for better cluster detection
>
> **Each vector has 15+ metadata fields:**
> ```
> event_id           → UUID (primary key)
> citizen_id         → phone number (e.g., "919441623236")
> citizen_name       → string
> domain             → MUNICIPAL / TRAFFIC / WATER / etc.
> issue_type         → Pothole / Sewage Overflow / etc.
> translated_description → formal English text
> raw_input          → original citizen text (any language)
> sentiment_score    → 1-10 integer
> panic_flag         → "true" / "false"
> latitude / longitude → float coordinates
> image_url          → attachment URL or empty
> audio_url          → voice recording URL or empty
> timestamp          → ISO 8601
> status             → "NEW" → "PROCESSED"
> source             → "blob" (from n8n)
> ```

---

### P3: "How does the watcher poll mechanism work? Isn't polling inefficient?"

> "Our `PineconeWatcher` runs as a FastAPI background task using `asyncio`. Every 5 seconds it queries Pinecone with a **metadata filter** `status='NEW'` using a zero-vector query — meaning we're not doing similarity search, just metadata-based retrieval. This returns only unprocessed vectors.
>
> Once retrieved, each vector goes through the full LangGraph pipeline. After successful PostgreSQL insertion, we update the vector's status to `PROCESSED` using Pinecone's `update()` API. This gives us **exactly-once semantics** — if the pipeline fails mid-way, the vector stays `NEW` and gets retried on the next poll.
>
> Is polling ideal? No. In production we'd use a Kafka stream or Pinecone's webhook feature. But for this scope, 5-second polling with metadata filters is efficient enough — the zero-vector query costs almost nothing."

---

### P4: "What's a zero-vector query?"

> "When we want to find vectors by metadata alone (not by similarity), we send a query with a vector of all zeros — `[0.0] * 1024`. The similarity scores are meaningless, but the **metadata filter** (`status='NEW'`) still works. It's a standard Pinecone pattern for metadata-only lookups. We use `top_k=100` so we batch-process up to 100 new vectors per poll cycle."

---

### P5: "How does the dual-namespace architecture work?"

> "Live data from n8n goes into the `__default__` namespace. Historic data (pre-loaded corpus) lives in `civix-events`. When the Systemic Auditor runs cluster detection, it queries **both** namespaces:
>
> ```python
> matches_live = pc.query_similar(vector, namespace='')
> matches_historic = pc.query_similar(vector, namespace='civix-events')
> # Merge, deduplicate by ID, sort by score
> ```
>
> This means a new complaint about 'low water pressure in Kukatpally' can match against historic complaints from last month — detecting long-running systemic issues that pure live-data matching would miss."

---

### P6: "What's the embedding model and why Cohere?"

> "We use **Cohere embed-english-v3.0** at **1024 dimensions**. Why Cohere over OpenAI's ada-002?
>
> 1. **Higher dimension** — 1024 vs 1536. Paradoxically, Cohere's 1024-dim captures semantic nuance better for our domain because it's trained on more diverse multilingual data.
> 2. **Input type parameter** — Cohere lets us specify `input_type: 'search_query'` vs `'search_document'`, optimizing embeddings for retrieval.
> 3. **Cost** — Cohere's embedding API is cheaper per token.
>
> **Critical constraint:** Both the ingestion side (n8n/Dev 2) and our query side (auditor) MUST use the same model. If embeddings are from different models, cosine similarity is meaningless."

---

### P7: "How do you handle Pinecone rate limits or downtime?"

> "The PineconeService is a **singleton wrapper** with connection state tracking. If Pinecone is unreachable:
>
> 1. `is_connected` returns `False`
> 2. The Systemic Auditor falls back to a **heuristic cluster detector** — keyword-based with domain-weighted probabilities (water/electricity events get 35% cluster probability since they tend to cluster in real life)
> 3. The Priority Agent still works (uses LLM, not Pinecone)
> 4. The Dispatch Agent still works (uses officer pool, not Pinecone)
>
> The system degrades gracefully — you lose cluster intelligence but never stop processing complaints."

---

### P8: "What's the cosine similarity threshold and how did you pick 0.85?"

> "We use **0.85** as the cluster detection threshold. Empirically:
>
> - **0.90+** — near-duplicate reports (same sentence rephrased). Too strict — misses real clusters.
> - **0.85-0.89** — semantically similar complaints about the same issue in the same area. Sweet spot.
> - **0.75-0.84** — related but different issues (e.g., 'pothole' and 'road damage'). Too loose — false clusters.
>
> The threshold is configurable via `CLUSTER_THRESHOLD` environment variable. In production you'd A/B test different thresholds against ground truth."

---

### P9: "How many vectors can your system handle?"

> "Currently we have ~83 vectors. Pinecone's serverless tier handles millions. The bottleneck isn't storage — it's the LLM call per event (1-2 seconds). At 100 events/minute, we'd need to parallelize the pipeline or batch LLM calls. The watcher already processes vectors sequentially, but switching to `asyncio.gather()` for parallel pipeline runs is a 10-line change."

---

### P10: "What happens if the same complaint is submitted twice?"

> "Two safeguards:
> 1. **At ingestion:** n8n assigns a unique `event_id` (UUID) to each submission. Even duplicate text gets a different ID.
> 2. **At cluster detection:** If the auditor finds a vector with >0.95 similarity, it links them as a cluster rather than creating a duplicate. The `master_event_id` in PostgreSQL tracks which event is the 'parent'.
> 3. **At persistence:** PostgreSQL uses `event_id` as primary key — a true duplicate insert would fail with a constraint violation, which we catch and skip."

---

## LANGGRAPH — Agentic Pipeline

### L1: "Why LangGraph over CrewAI, AutoGen, or raw LangChain?"

> "LangGraph is purpose-built for **stateful, cyclic agent workflows**. Here's what we get:
>
> 1. **Typed state** — `PulseState` is a `TypedDict`. Each node reads/writes specific fields. Type safety at compile time.
> 2. **Edge-based flow control** — `add_edge('auditor', 'priority')` makes the DAG explicit. Adding conditional routing (e.g., skip dispatch for duplicates) is one line.
> 3. **Built-in LangSmith tracing** — every `ainvoke()` call logs the full execution graph with per-node latency, inputs, and outputs. Zero config.
> 4. **Async-native** — every node is an `async def`. We await Cohere, GPT-4.1, and Pinecone without blocking.
>
> CrewAI is agent-conversation focused (not our model). AutoGen is multi-agent chat. We needed a **pipeline with shared state** — that's LangGraph's sweet spot."

---

### L2: "Walk me through the PulseState schema."

> ```python
> class PulseState(TypedDict):
>     # Input fields (set by watcher)
>     event_id: str
>     translated_description: str
>     domain: str                    # MUNICIPAL, TRAFFIC, etc.
>     coordinates: dict              # {"lat": 17.39, "lng": 78.49}
>
>     # Auditor outputs (Node 1)
>     cluster_found: bool
>     cluster_id: str                # master event ID
>     cluster_size: int              # e.g., 12 similar complaints
>     similar_events: list[dict]     # [{id, score, metadata}]
>
>     # Priority outputs (Node 2)
>     impact_score: int              # 1-100
>     severity_color: str            # #FF0000, #FFA500, #FFFF00
>     reasoning: str                 # LLM's one-line justification
>
>     # Dispatch outputs (Node 4)
>     matched_officer: dict | None   # {officer_id, name, distance_km, ...}
> ```
>
> Each node only writes its own fields. The state flows sequentially — auditor writes cluster data, priority reads cluster data to inform scoring, amplifier conditionally boosts, dispatch reads everything to pick the right officer."

---

### L3: "How does the graph compile and execute?"

> ```python
> graph = StateGraph(PulseState)
>
> graph.add_node("systemic_auditor", systemic_auditor_node)
> graph.add_node("priority_logic", priority_logic_node)
> graph.add_node("cluster_amplifier", cluster_amplifier_node)
> graph.add_node("dispatch_agent", dispatch_agent_node)
>
> graph.set_entry_point("systemic_auditor")
> graph.add_edge("systemic_auditor", "priority_logic")
> graph.add_edge("priority_logic", "cluster_amplifier")
> graph.add_edge("cluster_amplifier", "dispatch_agent")
> graph.add_edge("dispatch_agent", END)
>
> compiled = graph.compile()
> ```
>
> Execution: `result = await compiled.ainvoke(initial_state)`
>
> The compiled graph is created **once** at startup and reused for every event. No re-compilation overhead."

---

### L4: "Why four separate nodes instead of one big function?"

> "**Separation of concerns** and **independent fallbacks.**
>
> 1. The Auditor talks to **Pinecone** (vector DB). If Pinecone is down, it falls back to heuristics. Other nodes unaffected.
> 2. The Priority Agent talks to **GPT-4.1** (LLM). If the LLM API is down, it falls back to keyword scoring. Other nodes unaffected.
> 3. The Amplifier is **pure logic** — no external calls. It just does math.
> 4. The Dispatch Agent queries the **officer pool** — no external API.
>
> If we had one monolithic function, a Pinecone timeout would block scoring. With separate nodes, each failure is isolated. Also — each node shows up as a separate span in LangSmith traces, making debugging trivial."

---

### L5: "Is this truly 'agentic'? It looks like a fixed pipeline."

> "Fair question. It's a **structured agent swarm** with autonomous decision-making at each node:
>
> 1. **Auditor decides** whether a cluster exists based on real vector similarity — this isn't hardcoded.
> 2. **Priority Agent reasons** about impact using an LLM — the score varies based on context, cluster data, location, and domain. It's not a rule engine.
> 3. **Amplifier decides** whether to boost based on auditor output — conditional logic.
> 4. **Dispatch Agent decides** which officer gets the job based on a multi-factor optimization (distance + workload).
>
> The pipeline is fixed-topology but **each node makes autonomous decisions**. In production, you'd add conditional edges — e.g., if `cluster_size > 20`, route to an 'Escalation Agent' that notifies the department head. LangGraph supports that natively with `add_conditional_edges()`."

---

### L6: "How does the LLM scoring work? Show me the prompt."

> System prompt (City Planner persona):
> ```
> You are a municipal grievance scoring API.
> SCORING:
> - Danger to life (live wires, gas leaks, fire) → 80-100, #FF0000
> - Infrastructure failure (water outage, sewage) → 60-79, #FF0000
> - Quality-of-life (pothole, garbage) → 30-59, #FFA500
> - Minor/cosmetic → 1-29, #FFFF00
>
> AMPLIFIERS: Near school/hospital +10-20. Vulnerable populations +10-20.
> Respond with ONLY JSON: {"impact_score": 75, "severity_color": "#FF0000", "reasoning": "..."}
> ```
>
> User prompt includes: complaint text, domain, coordinates, cluster context.
>
> We parse the response with regex (`re.search(r'\{[^}]+\}')`) and validate that `impact_score` is 1-100 and `severity_color` starts with `#`. If parsing fails → keyword fallback."

---

### L7: "What LLM are you using and why?"

> "**Primary:** GPT-4.1 via GitHub Models API. Fast, structured-output capable, and we get free credits through GitHub.
>
> **Fallback:** Nvidia Nemotron-3 120B via OpenRouter (free tier).
>
> **Why not a local model?** We're running on a Dell Vostro 15 laptop — can't run a 7B model locally with acceptable latency. Cloud LLM at 1-2 second response time is the right trade-off for a hackathon.
>
> **Why structured output?** We use `ChatOpenAI` with a system prompt that enforces JSON-only responses. We parse with regex rather than Pydantic structured output because the GitHub Models endpoint doesn't support function calling. The regex parser + validation is robust enough."

---

### L8: "How does cluster amplification work mathematically?"

> ```python
> CLUSTER_AMPLIFY_BONUS = 15
>
> if state['cluster_found']:
>     boosted = min(100, original_score + 15)
>     # If boosted ≥ 70, escalate to RED
>     new_color = "#FF0000" if boosted >= 70 else current_color
> ```
>
> **Example:** A pothole complaint scores 45 (ORANGE). But the auditor found 12 similar reports in the same area → cluster detected. Amplifier boosts 45 → 60 (still ORANGE). But if it scored 58, the boost takes it to 73 → RED, triggering urgent response.
>
> **Why +15?** Empirically, 15 points is enough to push borderline cases across severity thresholds without inflating minor issues into false emergencies."

---

### L9: "How does the dispatch algorithm balance proximity vs workload?"

> ```python
> score = haversine_distance_km + (active_tasks × 2.0)
> # Lowest score wins
> ```
>
> **The 2.0 penalty means:** Each active task is equivalent to being 2km farther away.
>
> | Officer | Distance | Tasks | Score | Selected? |
> |---------|----------|-------|-------|-----------|
> | OP-102  | 2 km     | 16    | 34.0  | ❌ |
> | OP-106  | 5 km     | 3     | 11.0  | ✅ |
> | OP-101  | 8 km     | 0     | 8.0   | ✅ (if lower) |
>
> This prevents **single-officer overload** — a common real-world problem where the nearest officer gets buried in tasks while others sit idle."

---

### L10: "Can the graph handle cyclic flows or conditional routing?"

> "Currently it's a linear DAG: `auditor → priority → amplifier → dispatch → END`. But LangGraph supports:
>
> ```python
> # Conditional edge example (not yet implemented but ready)
> graph.add_conditional_edges(
>     'cluster_amplifier',
>     lambda state: 'escalate' if state['cluster_size'] > 20 else 'dispatch',
>     {'escalate': 'escalation_agent', 'dispatch': 'dispatch_agent'}
> )
> ```
>
> We could also add a **feedback loop** — if dispatch fails (no available officers), route back to a 'queue agent' that holds the event until an officer frees up. LangGraph handles cycles natively — that's why we chose it over LangChain's `SequentialChain`."

---

### L11: "What does LangSmith tracing show you?"

> "Every `pipeline.ainvoke()` creates a trace with:
>
> - **Run tree:** Visual graph showing auditor → priority → amplifier → dispatch
> - **Per-node details:** Input state, output state, latency, tokens used
> - **LLM calls:** Full prompt, raw response, parsed output
> - **Errors:** If a node falls back to heuristics, the exception is logged
>
> We set `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_PROJECT=civix-pulse`. All traces go to our LangSmith dashboard. This is critical for debugging — if a complaint scores unexpectedly low, we can see exactly what the LLM was given and what it returned."

---

### L12: "How do you test the pipeline?"

> "Three levels:
>
> 1. **Unit:** Each node function can be called independently with a mock `PulseState` dict. No graph needed.
> 2. **Integration:** `POST /api/v1/trigger-analysis` accepts a complaint string and runs it through the full pipeline, returning the enriched result.
> 3. **End-to-end:** Submit via n8n form → vector appears in Pinecone → watcher picks it up → pipeline runs → event appears in dashboard + field worker app. The entire flow is observable via backend logs and LangSmith."

---

## COMBINED — Architecture Questions

### C1: "What's the data flow from citizen to field officer?"

> ```
> Citizen complaint (any language, any modality)
>   → n8n: OCR / STT / translation → formal English
>   → n8n: Cohere embedding (1024-dim)
>   → Pinecone: vector + metadata (status: NEW)
>   → Watcher: polls every 5s, finds NEW vectors
>   → LangGraph: auditor → priority → amplifier → dispatch
>   → PostgreSQL: event persisted with score, officer, cluster data
>   → WebSocket: push to all dashboard clients
>   → Field Worker App: officer sees dispatch in real-time
> ```
> **Total latency: 5-8 seconds.**

---

### C2: "What's your single point of failure?"

> "The FastAPI backend. If it goes down, no polling, no processing, no WebSocket. But:
> - Pinecone retains all `NEW` vectors — nothing is lost
> - On restart, the watcher picks up where it left off
> - PostgreSQL data is persistent
>
> In production: run multiple FastAPI replicas behind a load balancer, partition Pinecone polling by namespace or vector ID range."

---

### C3: "How do you ensure exactly-once processing?"

> "The `status` field in Pinecone metadata:
> 1. Watcher queries `status='NEW'` vectors
> 2. Processes through pipeline
> 3. Persists to PostgreSQL
> 4. **Only then** updates Pinecone status to `PROCESSED`
>
> If step 3 fails → status stays `NEW` → retried next cycle.
> If step 4 fails → PostgreSQL has the data, Pinecone shows `NEW`, next cycle detects it but PostgreSQL's primary key constraint prevents duplicate insertion."

---

### C4: "How would you scale this to a real city with 10,000 complaints/day?"

> 1. **Pinecone:** Already serverless, scales automatically
> 2. **Watcher:** Run multiple instances partitioned by domain or geographic region
> 3. **LLM calls:** Batch scoring — send 10 complaints in one prompt, parse 10 JSON responses
> 4. **PostgreSQL:** Add read replicas for dashboard queries, primary for writes
> 5. **WebSocket:** Use Redis pub/sub for cross-instance broadcasting
> 6. **Replace polling:** Switch to Kafka/Redis Streams for event-driven ingestion

---

## Quick-Fire Answers (One-Liners)

| Question | Answer |
|----------|--------|
| Embedding model? | Cohere embed-english-v3.0, 1024 dimensions |
| Similarity metric? | Cosine similarity |
| Cluster threshold? | 0.85 (configurable via env var) |
| LLM model? | GPT-4.1 via GitHub Models API |
| LLM fallback? | Keyword-based heuristic scorer |
| Graph framework? | LangGraph (StateGraph with TypedDict state) |
| Graph topology? | Linear: auditor → priority → amplifier → dispatch |
| Tracing? | LangSmith (LANGCHAIN_TRACING_V2=true) |
| Dispatch formula? | `score = distance_km + (tasks × 2.0)` — lowest wins |
| Poll interval? | 5 seconds |
| Namespaces? | `""` (live) + `civix-events` (historic) |
| Vector count? | ~83 in live, growing |
| DB ORM? | None — raw asyncpg for speed |
| Status lifecycle? | NEW → PROCESSED (in Pinecone metadata) |
| Score range? | 1-100, with severity colors #FFFF00 / #FFA500 / #FF0000 |
