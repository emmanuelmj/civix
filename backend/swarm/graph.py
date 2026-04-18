"""
Civix-Pulse Swarm — LangGraph Pipeline (Enhanced)
===================================================
Four-node sequential graph with cluster amplification:
  1. Systemic Auditor  → real Pinecone vector similarity cluster detection
  2. Priority Logic    → LLM-based impact scoring (City Planner persona)
  3. Cluster Amplifier → boosts score when cluster pattern detected
  4. Dispatch Agent    → domain-aware officer matching with proximity

All LLM calls go to GitHub Models API (GPT-4.1) with OpenRouter fallback. No local model loading.
LangSmith tracing is configured via environment variables.
"""

import json
import logging
import math
import os
import random
import re
from typing import Any, TypedDict

import httpx

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Environment & Tracing
# ---------------------------------------------------------------------------
load_dotenv()

os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "civix-pulse")

logger = logging.getLogger("civix-pulse.swarm")

OPENROUTER_MODEL = os.environ.get(
    "OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free"
)
GITHUB_MODELS_MODEL = os.environ.get("GITHUB_MODELS_MODEL", "openai/gpt-4.1")

CLUSTER_SIMILARITY_THRESHOLD = float(
    os.environ.get("CLUSTER_THRESHOLD", "0.85")
)
CLUSTER_AMPLIFY_BONUS = 15  # Score bonus when cluster detected

# ---------------------------------------------------------------------------
# State Schema (Enhanced)
# ---------------------------------------------------------------------------

class PulseState(TypedDict):
    """Shared state flowing through the LangGraph pipeline."""
    event_id: str
    translated_description: str
    domain: str
    coordinates: dict                # {"lat": float, "lng": float}
    # Auditor outputs
    cluster_found: bool
    cluster_id: str                  # Master event ID if cluster found
    cluster_size: int                # Number of events in cluster
    similar_events: list[dict]       # [{id, score, metadata}, ...]
    # Priority outputs
    impact_score: int                # 1–100
    severity_color: str              # Hex color
    reasoning: str                   # One-line LLM reasoning
    # Dispatch outputs
    matched_officer: dict | None

# ---------------------------------------------------------------------------
# Priority Agent — structured output schema
# ---------------------------------------------------------------------------

class PriorityOutput(BaseModel):
    """Structured output from the Priority Logic Agent."""
    impact_score: int = Field(
        description="Impact score from 1 to 100 based on urgency and societal impact"
    )
    severity_color: str = Field(
        description="Hex color: #FFFF00 (Low), #FFA500 (Medium), #FF0000 (Critical)"
    )
    reasoning: str = Field(
        description="One-sentence justification for the score"
    )

# ---------------------------------------------------------------------------
# Node 1: Systemic Auditor (Real Pinecone Cluster Detection)
# ---------------------------------------------------------------------------

def _get_pinecone_service():
    """Get the PineconeService singleton. Returns None if not available."""
    try:
        from swarm.pinecone_watcher import PineconeService
        svc = PineconeService.get_instance()
        return svc if svc.is_connected else None
    except Exception:
        return None


async def _generate_embedding(text: str) -> list[float] | None:
    """Generate a 1024-dim embedding using Cohere embed-english-v3.0.
    Must match Dev 1's ingestion model for cosine similarity to work."""
    api_key = os.environ.get("COHERE_API_KEY", "")
    if not api_key:
        logger.warning("[Auditor] No COHERE_API_KEY — skipping embedding")
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.cohere.com/v2/embed",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "embed-english-v3.0",
                    "texts": [text],
                    "input_type": "search_query",
                    "embedding_types": ["float"],
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                embedding = data["embeddings"]["float"][0]
                logger.info(f"[Auditor] Cohere embedding generated ({len(embedding)} dims)")
                return embedding
            else:
                logger.warning(f"[Auditor] Cohere API returned {resp.status_code}: {resp.text[:200]}")
                return None
    except Exception as e:
        logger.warning(f"[Auditor] Cohere embedding failed: {e}")
        return None


async def systemic_auditor_node(state: PulseState) -> dict:
    """
    Checks if this event is part of a systemic cluster using Pinecone
    vector similarity search.

    Flow:
      1. Fetch the event's vector from Pinecone by event_id
      2. Query for similar vectors (cosine similarity)
      3. If top match > threshold → cluster detected
      4. Returns cluster details: cluster_id, cluster_size, similar_events
    """
    logger.info(f"[Auditor] Checking clusters for event: {state['event_id']}")

    pc = _get_pinecone_service()
    if pc is None:
        logger.warning("[Auditor] Pinecone not available — using heuristic.")
        return _mock_cluster_check(state)

    try:
        # Try to fetch this event's vector from Pinecone
        vectors = pc.fetch_vectors([state["event_id"]], namespace="civix-events")

        if state["event_id"] not in vectors:
            # Event not yet in Pinecone — generate embedding on-the-fly
            logger.info(
                f"[Auditor] Event {state['event_id']} not in Pinecone. "
                f"Generating embedding for cluster search..."
            )
            event_vector = await _generate_embedding(state["translated_description"])
            if event_vector is None:
                logger.warning("[Auditor] Embedding generation failed — using heuristic.")
                return _mock_cluster_check(state)
        else:
            event_vector = list(vectors[state["event_id"]].values)

        # Query for similar events
        matches = pc.query_similar(
            vector=event_vector,
            top_k=10,
            exclude_id=state["event_id"],
            namespace="civix-events",
        )

        # Filter by threshold
        cluster_matches = [
            m for m in matches if m["score"] >= CLUSTER_SIMILARITY_THRESHOLD
        ]

        if cluster_matches:
            master_id = cluster_matches[0]["id"]
            cluster_size = len(cluster_matches)
            logger.info(
                f"[Auditor] 🔗 CLUSTER DETECTED — "
                f"top similarity: {cluster_matches[0]['score']:.3f}, "
                f"cluster size: {cluster_size}, "
                f"master event: {master_id}"
            )
            return {
                "cluster_found": True,
                "cluster_id": master_id,
                "cluster_size": cluster_size,
                "similar_events": cluster_matches[:5],
            }
        else:
            top_score = matches[0]["score"] if matches else 0.0
            logger.info(
                f"[Auditor] No cluster — "
                f"top similarity: {top_score:.3f}. Isolated event."
            )
            return {
                "cluster_found": False,
                "cluster_id": "",
                "cluster_size": 0,
                "similar_events": matches[:3],
            }

    except Exception as e:
        logger.error(f"[Auditor] Pinecone query failed: {e}. Using heuristic.")
        return _mock_cluster_check(state)


def _mock_cluster_check(state: PulseState) -> dict:
    """Heuristic fallback: keyword-based cluster detection."""
    desc = state["translated_description"].lower()
    domain = state["domain"].upper()

    # Domain-based heuristic: water/electricity complaints tend to cluster
    cluster_probability = 0.15
    if domain in ("WATER", "ELECTRICITY"):
        cluster_probability = 0.35
    if any(kw in desc for kw in ["burst", "overflow", "outage", "supply", "leak"]):
        cluster_probability = 0.5

    cluster_found = random.random() < cluster_probability
    if cluster_found:
        logger.info(f"[Auditor] HEURISTIC CLUSTER DETECTED for {domain} event")
    else:
        logger.info(f"[Auditor] Heuristic: no cluster for {domain} event")

    return {
        "cluster_found": cluster_found,
        "cluster_id": f"cluster-{domain.lower()}-{random.randint(100,999)}" if cluster_found else "",
        "cluster_size": random.randint(3, 12) if cluster_found else 0,
        "similar_events": [],
    }

# ---------------------------------------------------------------------------
# Node 2: Priority Logic Agent (Impact Matrix via LLM)
# ---------------------------------------------------------------------------

def _build_priority_llm() -> ChatOpenAI | None:
    """Builds the LLM client. Tries GitHub Models first, falls back to OpenRouter."""
    # Primary: GitHub Models API (OpenAI-compatible)
    gh_key = os.environ.get("GITHUB_MODELS_API_KEY", "")
    gh_base = os.environ.get(
        "GITHUB_MODELS_BASE_URL",
        "https://models.github.ai/orgs/imperialorg/inference",
    )
    if gh_key and not gh_key.startswith("ghp_placeholder"):
        logger.info("[LLM] Using GitHub Models API (GPT-4.1)")
        return ChatOpenAI(
            model=GITHUB_MODELS_MODEL,
            temperature=0,
            max_tokens=512,
            openai_api_key=gh_key,
            openai_api_base=gh_base,
        )

    # Fallback: OpenRouter
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    if or_key and or_key != "sk-or-...":
        logger.info("[LLM] Using OpenRouter fallback")
        return ChatOpenAI(
            model=OPENROUTER_MODEL,
            temperature=0,
            max_tokens=512,
            openai_api_key=or_key,
            openai_api_base="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://github.com/emmanuelmj/civix",
                "X-Title": "Civix-Pulse",
            },
        )

    return None

PRIORITY_SYSTEM_PROMPT = """You are a municipal grievance scoring API. You receive a citizen complaint and return a JSON score.

RULES:
1. You MUST respond with ONLY a JSON object. No other text, no explanations, no markdown.
2. If the description is empty or unclear, score it as 20 with color #FFFF00.

SCORING:
- Danger to life (live wires, gas leaks, open manholes, fire) → 80-100, #FF0000
- Infrastructure failure (water outage, road collapse, sewage overflow) → 60-79, #FF0000
- Quality-of-life (streetlight out, pothole, garbage) → 30-59, #FFA500
- Minor or cosmetic issues → 1-29, #FFFF00

AMPLIFIERS (add 10-20 points):
- Near school, hospital, or worship place
- Affects vulnerable populations (elderly, children)
- Part of a systemic cluster (multiple similar reports)

RESPONSE FORMAT (exactly this, nothing else):
{"impact_score": 75, "severity_color": "#FF0000", "reasoning": "Water main burst affecting 50+ households"}"""

PRIORITY_USER_TEMPLATE = """Complaint: {description}
Domain: {domain}
Location: ({lat}, {lng})
Cluster detected: {cluster_found} (cluster size: {cluster_size})

Return ONLY the JSON object."""


def _parse_priority_json(text: str) -> dict | None:
    """Extract impact_score, severity_color, and reasoning from LLM response."""
    json_match = re.search(r"\{[^}]+\}", text, re.DOTALL)
    if not json_match:
        return None
    try:
        data = json.loads(json_match.group())
        score = int(data.get("impact_score", 0))
        color = data.get("severity_color", "")
        reasoning = data.get("reasoning", "")
        if 1 <= score <= 100 and color.startswith("#"):
            return {
                "impact_score": score,
                "severity_color": color,
                "reasoning": reasoning,
            }
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return None


async def priority_logic_node(state: PulseState) -> dict:
    """
    Uses LLM (GitHub Models GPT-4.1 or OpenRouter) as a City Planner to evaluate the grievance.
    Now includes cluster context in the prompt for better scoring.
    """
    logger.info(f"[Priority] Scoring event: {state['event_id']}")

    llm = _build_priority_llm()
    if llm is None:
        logger.warning("[Priority] No LLM API key configured — using keyword scorer.")
        return _mock_priority_score(state)

    user_message = PRIORITY_USER_TEMPLATE.format(
        description=state["translated_description"],
        domain=state["domain"],
        lat=state["coordinates"]["lat"],
        lng=state["coordinates"]["lng"],
        cluster_found=state.get("cluster_found", False),
        cluster_size=state.get("cluster_size", 0),
    )

    messages = [
        {"role": "system", "content": PRIORITY_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    try:
        response = await llm.ainvoke(messages)
        parsed = _parse_priority_json(response.content)

        if parsed:
            logger.info(
                f"[Priority] LLM Score: {parsed['impact_score']} | "
                f"Color: {parsed['severity_color']} | "
                f"Reasoning: {parsed['reasoning'][:60]}"
            )
            return parsed
        else:
            logger.warning(
                f"[Priority] Could not parse LLM response: "
                f"{response.content[:200]}"
            )
            return _mock_priority_score(state)

    except Exception as e:
        logger.error(f"[Priority] LLM call failed: {e}. Using keyword scorer.")
        return _mock_priority_score(state)


def _mock_priority_score(state: PulseState) -> dict:
    """Keyword-based heuristic fallback for scoring."""
    desc = state["translated_description"].lower()

    critical_keywords = [
        "fire", "collapse", "flood", "electrocution", "live wire",
        "gas leak", "voltage", "sparking", "explosion", "drowning",
        "earthquake", "rupture", "evacuation", "chemical", "spill",
    ]
    high_keywords = [
        "pothole", "water", "sewage", "accident", "broken", "overflow",
        "burst", "leaking", "damaged", "blocked", "malfunction", "outage",
    ]

    score = 35
    if any(kw in desc for kw in critical_keywords):
        score = random.randint(78, 95)
    elif any(kw in desc for kw in high_keywords):
        score = random.randint(48, 72)
    else:
        score = random.randint(20, 45)

    if score >= 70:
        color = "#FF0000"
    elif score >= 40:
        color = "#FFA500"
    else:
        color = "#FFFF00"

    reasoning = f"Keyword analysis: {state['domain']} domain issue"
    logger.info(f"[Priority] Keyword score: {score} | {color}")
    return {"impact_score": score, "severity_color": color, "reasoning": reasoning}


# ---------------------------------------------------------------------------
# Node 3: Cluster Amplifier (conditional score boost)
# ---------------------------------------------------------------------------

async def cluster_amplifier_node(state: PulseState) -> dict:
    """
    If a cluster was detected, amplifies the impact score and escalates.
    Systemic issues are always more critical than isolated complaints.
    """
    if not state.get("cluster_found"):
        return {}

    original_score = state["impact_score"]
    boosted = min(100, original_score + CLUSTER_AMPLIFY_BONUS)
    new_color = "#FF0000" if boosted >= 70 else state["severity_color"]
    cluster_note = (
        f"CLUSTER AMPLIFIED: +{CLUSTER_AMPLIFY_BONUS} pts "
        f"(cluster of {state.get('cluster_size', 0)} events). "
        f"{state.get('reasoning', '')}"
    )

    logger.info(
        f"[Amplifier] Score {original_score} → {boosted} "
        f"(cluster of {state.get('cluster_size', 0)})"
    )

    return {
        "impact_score": boosted,
        "severity_color": new_color,
        "reasoning": cluster_note,
    }


# ---------------------------------------------------------------------------
# Node 4: Dispatch Agent (Domain-aware Officer Matching)
# ---------------------------------------------------------------------------

# Officer pool matching the PostgreSQL seed data
OFFICER_POOL: list[dict[str, Any]] = [
    {"officer_id": "OP-101", "name": "Rajesh Kumar",     "skills": ["MUNICIPAL", "WATER"],       "lat": 17.3850, "lng": 78.4867},
    {"officer_id": "OP-102", "name": "Priya Sharma",     "skills": ["TRAFFIC"],                  "lat": 17.3616, "lng": 78.4747},
    {"officer_id": "OP-104", "name": "Sneha Patel",      "skills": ["MUNICIPAL", "ELECTRICITY"], "lat": 17.4156, "lng": 78.4347},
    {"officer_id": "OP-105", "name": "Vikram Singh",     "skills": ["WATER"],                    "lat": 17.3950, "lng": 78.5100},
    {"officer_id": "OP-106", "name": "Ananya Desai",     "skills": ["TRAFFIC", "MUNICIPAL"],     "lat": 17.3750, "lng": 78.4500},
    {"officer_id": "OP-108", "name": "Kavitha Nair",     "skills": ["MUNICIPAL"],                "lat": 17.4260, "lng": 78.4200},
]

# Track which officers are currently assigned
_officer_assignments: dict[str, int] = {}  # officer_id → active task count


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in kilometers between two lat/lng points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def _find_nearest_officer(domain: str, lat: float, lng: float) -> dict:
    """
    Finds the nearest available officer with matching domain skills.
    Scoring: distance (lower is better) + workload (fewer tasks is better).
    Falls back to any officer if no domain match found.
    """
    # Filter by domain skill
    domain_officers = [
        o for o in OFFICER_POOL if domain in o["skills"]
    ]
    candidates = domain_officers if domain_officers else OFFICER_POOL

    best_officer = None
    best_score = float("inf")

    for officer in candidates:
        dist = _haversine_km(lat, lng, officer["lat"], officer["lng"])
        workload = _officer_assignments.get(officer["officer_id"], 0)
        # Combined score: distance + 2km penalty per active task
        score = dist + workload * 2.0

        if score < best_score:
            best_score = score
            best_officer = officer

    if best_officer is None:
        best_officer = random.choice(OFFICER_POOL)

    # Record assignment
    oid = best_officer["officer_id"]
    _officer_assignments[oid] = _officer_assignments.get(oid, 0) + 1

    dist_km = _haversine_km(lat, lng, best_officer["lat"], best_officer["lng"])

    return {
        "officer_id": oid,
        "name": best_officer["name"],
        "domain": domain,
        "skills": best_officer["skills"],
        "current_lat": best_officer["lat"],
        "current_lng": best_officer["lng"],
        "distance_km": round(dist_km, 2),
        "active_tasks": _officer_assignments[oid],
        "status": "DISPATCHED",
    }



async def dispatch_agent_node(state: PulseState) -> dict:
    """
    Finds the nearest available field officer matching the event's domain
    and dispatches them. Uses Haversine distance + workload balancing.
    """
    logger.info(f"[Dispatch] Matching officer for event: {state['event_id']}")

    officer = _find_nearest_officer(
        domain=state["domain"],
        lat=state["coordinates"]["lat"],
        lng=state["coordinates"]["lng"],
    )

    logger.info(
        f"[Dispatch] Matched: {officer['name']} ({officer['officer_id']}) | "
        f"Distance: {officer['distance_km']}km | "
        f"Skills: {officer['skills']} | "
        f"Active tasks: {officer['active_tasks']}"
    )

    return {"matched_officer": officer}


# ---------------------------------------------------------------------------
# Graph Compilation
# ---------------------------------------------------------------------------

def compile_graph() -> StateGraph:
    """
    Builds and compiles the four-node LangGraph pipeline.

    Flow:
      systemic_auditor → priority_logic → cluster_amplifier → dispatch_agent → END
    """
    graph = StateGraph(PulseState)

    graph.add_node("systemic_auditor", systemic_auditor_node)
    graph.add_node("priority_logic", priority_logic_node)
    graph.add_node("cluster_amplifier", cluster_amplifier_node)
    graph.add_node("dispatch_agent", dispatch_agent_node)

    graph.set_entry_point("systemic_auditor")
    graph.add_edge("systemic_auditor", "priority_logic")
    graph.add_edge("priority_logic", "cluster_amplifier")
    graph.add_edge("cluster_amplifier", "dispatch_agent")
    graph.add_edge("dispatch_agent", END)

    compiled = graph.compile()
    logger.info(
        "LangGraph pipeline compiled: "
        "auditor → priority → amplifier → dispatch"
    )
    return compiled
