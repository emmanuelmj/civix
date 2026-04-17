"""
Civix-Pulse Swarm — LangGraph Pipeline
========================================
Three-node sequential graph:
  1. Systemic Auditor  → cluster detection via Pinecone similarity
  2. Priority Logic    → LLM-based impact scoring (City Planner persona)
  3. Dispatch Agent    → geospatial officer matching

All LLM calls go to cloud APIs (OpenRouter). No local model loading.
LangSmith tracing is configured via environment variables.
"""

import json
import logging
import os
import random
import re
from typing import TypedDict

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Environment & Tracing
# ---------------------------------------------------------------------------
load_dotenv()

# LangSmith tracing — reads from .env automatically
os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
os.environ.setdefault("LANGCHAIN_PROJECT", "civix-pulse")

logger = logging.getLogger("civix-pulse.swarm")

# Default free model on OpenRouter (configurable via env)
OPENROUTER_MODEL = os.environ.get(
    "OPENROUTER_MODEL", "nvidia/nemotron-3-super-120b-a12b:free"
)

# Pinecone config
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "civix-pulse-events")
CLUSTER_SIMILARITY_THRESHOLD = 0.85

# ---------------------------------------------------------------------------
# State Schema
# ---------------------------------------------------------------------------

class PulseState(TypedDict):
    """Shared state flowing through the LangGraph pipeline."""
    event_id: str
    translated_description: str
    domain: str
    coordinates: dict             # {"lat": float, "lng": float}
    cluster_found: bool           # True if linked to an existing Master Event
    impact_score: int             # 1–100, set by Priority Logic Agent
    severity_color: str           # Hex: #FFFF00 (Yellow), #FFA500 (Orange), #FF0000 (Red)
    matched_officer: dict | None  # Dispatched officer details

# ---------------------------------------------------------------------------
# Structured Output Schema for Priority Agent
# ---------------------------------------------------------------------------

class PriorityOutput(BaseModel):
    """Structured output from the Priority Logic Agent."""
    impact_score: int = Field(
        description="Impact score from 1 to 100 based on urgency and societal impact"
    )
    severity_color: str = Field(
        description="Hex color code: #FFFF00 (Yellow/Low), #FFA500 (Orange/Medium), or #FF0000 (Red/Critical)"
    )
    reasoning: str = Field(
        description="One-sentence justification for the score"
    )

# ---------------------------------------------------------------------------
# Node 1: Systemic Auditor (Cluster Detection via Pinecone)
# ---------------------------------------------------------------------------

def _get_pinecone_index():
    """Initialize Pinecone client and return the index. Returns None if unconfigured."""
    if not PINECONE_API_KEY or PINECONE_API_KEY == "...":
        return None
    try:
        from pinecone import Pinecone, ServerlessSpec

        pc = Pinecone(api_key=PINECONE_API_KEY)

        # Auto-create index if it doesn't exist
        existing = [idx.name for idx in pc.list_indexes()]
        if PINECONE_INDEX_NAME not in existing:
            logger.info(f"[Auditor] Creating Pinecone index '{PINECONE_INDEX_NAME}'...")
            pc.create_index(
                name=PINECONE_INDEX_NAME,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            logger.info(f"[Auditor] Index '{PINECONE_INDEX_NAME}' created.")

        return pc.Index(PINECONE_INDEX_NAME)
    except Exception as e:
        logger.warning(f"[Auditor] Pinecone init failed: {e}")
        return None


async def systemic_auditor_node(state: PulseState) -> dict:
    """
    Checks if this event is part of a systemic cluster.

    Flow:
      1. Fetch the event's vector from Pinecone by event_id
         (Dev 2's n8n workflow stores events with embeddings)
      2. Query Pinecone for similar vectors within recent timeframe
      3. If top similarity > 0.85, link to existing Master Event

    Falls back to mock random score if Pinecone is not configured
    or the event hasn't been indexed yet.
    """
    logger.info(f"[Auditor] Checking clusters for event: {state['event_id']}")

    index = _get_pinecone_index()
    if index is None:
        logger.warning("[Auditor] Pinecone not configured — using mock scorer.")
        return _mock_cluster_check()

    try:
        # Fetch this event's vector from Pinecone (stored by Dev 2's ingestion pipeline)
        fetch_result = index.fetch(ids=[state["event_id"]])

        if state["event_id"] not in fetch_result.vectors:
            logger.warning(
                f"[Auditor] Event {state['event_id']} not found in Pinecone. "
                f"Dev 2 may not have indexed it yet. Using mock."
            )
            return _mock_cluster_check()

        event_vector = fetch_result.vectors[state["event_id"]].values

        # Query for similar events (potential cluster members)
        query_result = index.query(
            vector=event_vector,
            top_k=5,
            include_metadata=True,
        )

        # Filter out self-match and check similarity
        matches = [
            m for m in query_result.matches
            if m.id != state["event_id"]
        ]

        if matches and matches[0].score >= CLUSTER_SIMILARITY_THRESHOLD:
            cluster_size = sum(
                1 for m in matches if m.score >= CLUSTER_SIMILARITY_THRESHOLD
            )
            logger.info(
                f"[Auditor] CLUSTER DETECTED — top similarity: {matches[0].score:.3f}, "
                f"cluster size: {cluster_size}, "
                f"master event: {matches[0].id}"
            )
            return {"cluster_found": True}
        else:
            top_score = matches[0].score if matches else 0.0
            logger.info(
                f"[Auditor] No cluster found — top similarity: {top_score:.3f}. "
                f"Proceeding as new event."
            )
            return {"cluster_found": False}

    except Exception as e:
        logger.error(f"[Auditor] Pinecone query failed: {e}. Using mock.")
        return _mock_cluster_check()


def _mock_cluster_check() -> dict:
    """Mock fallback: random similarity score for testing."""
    similarity_score = random.uniform(0.0, 1.0)
    cluster_found = similarity_score > CLUSTER_SIMILARITY_THRESHOLD
    if cluster_found:
        logger.info(f"[Auditor] MOCK CLUSTER DETECTED — similarity: {similarity_score:.2f}")
    else:
        logger.info(f"[Auditor] Mock: no cluster — similarity: {similarity_score:.2f}")
    return {"cluster_found": cluster_found}

# ---------------------------------------------------------------------------
# Node 2: Priority Logic Agent (Impact Matrix via LLM)
# ---------------------------------------------------------------------------

def _build_priority_llm() -> ChatOpenAI | None:
    """Builds the OpenRouter-backed LLM. Returns None if no API key."""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key or api_key == "sk-or-...":
        return None
    return ChatOpenAI(
        model=OPENROUTER_MODEL,
        temperature=0,
        max_tokens=512,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://github.com/emmanuelmj/civix",
            "X-Title": "Civix-Pulse",
        },
    )

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
- Affects vulnerable populations
- Multiple similar reports

RESPONSE FORMAT (exactly this, nothing else):
{"impact_score": 75, "severity_color": "#FF0000", "reasoning": "Water main burst affecting 50+ households"}"""

PRIORITY_USER_TEMPLATE = """Complaint: {description}
Domain: {domain}
Location: ({lat}, {lng})

Return ONLY the JSON object."""


def _parse_priority_json(text: str) -> dict | None:
    """Extract impact_score and severity_color from LLM text response."""
    # Try to find JSON in the response
    json_match = re.search(r"\{[^}]+\}", text, re.DOTALL)
    if not json_match:
        return None
    try:
        data = json.loads(json_match.group())
        score = int(data.get("impact_score", 0))
        color = data.get("severity_color", "")
        if 1 <= score <= 100 and color.startswith("#"):
            return {"impact_score": score, "severity_color": color}
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return None


async def priority_logic_node(state: PulseState) -> dict:
    """
    Uses an LLM (via OpenRouter) as a City Planner to evaluate the grievance
    and assign an impact_score (1-100) and severity_color (hex).

    Falls back to a heuristic mock if no API key is configured.
    """
    logger.info(f"[Priority] Scoring event: {state['event_id']}")

    llm = _build_priority_llm()
    if llm is None:
        logger.warning("[Priority] No valid OPENROUTER_API_KEY — using mock scorer.")
        return _mock_priority_score(state)

    user_message = PRIORITY_USER_TEMPLATE.format(
        description=state["translated_description"],
        domain=state["domain"],
        lat=state["coordinates"]["lat"],
        lng=state["coordinates"]["lng"],
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
                f"[Priority] Score: {parsed['impact_score']} | "
                f"Color: {parsed['severity_color']}"
            )
            return parsed
        else:
            logger.warning(f"[Priority] Could not parse LLM response: {response.content[:200]}")
            return _mock_priority_score(state)

    except Exception as e:
        logger.error(f"[Priority] LLM call failed: {e}. Using mock scorer.")
        return _mock_priority_score(state)


def _mock_priority_score(state: PulseState) -> dict:
    """Heuristic fallback when no LLM API key is available."""
    desc = state["translated_description"].lower()
    # Simple keyword-based scoring for testing
    critical_keywords = ["fire", "collapse", "flood", "electrocution", "live wire", "gas leak"]
    high_keywords = ["pothole", "water", "sewage", "accident", "broken", "overflow"]

    score = 35  # default medium-low
    if any(kw in desc for kw in critical_keywords):
        score = random.randint(80, 95)
    elif any(kw in desc for kw in high_keywords):
        score = random.randint(50, 75)
    else:
        score = random.randint(20, 45)

    if score >= 70:
        color = "#FF0000"
    elif score >= 40:
        color = "#FFA500"
    else:
        color = "#FFFF00"

    logger.info(f"[Priority] Mock score: {score} | Color: {color}")
    return {"impact_score": score, "severity_color": color}

# ---------------------------------------------------------------------------
# Node 3: Dispatch Agent (Spatial Matching)
# ---------------------------------------------------------------------------

def _find_nearest_officer(domain: str, lat: float, lng: float) -> dict:
    """
    MOCK IMPLEMENTATION: Returns a hardcoded officer near the event.

    In production, this queries PostGIS/MongoDB:
      SELECT * FROM officers
      WHERE status = 'AVAILABLE' AND domain_skills @> '{domain}'
      ORDER BY ST_Distance(location, ST_Point(lng, lat))
      LIMIT 1;
    """
    return {
        "officer_id": "OP-441",
        "name": "Raj Kumar",
        "domain": domain,
        "current_lat": round(lat + 0.001, 6),
        "current_lng": round(lng - 0.001, 6),
        "status": "DISPATCHED",
    }


async def dispatch_agent_node(state: PulseState) -> dict:
    """
    Finds the nearest available field officer matching the event's domain
    and dispatches them.
    """
    logger.info(f"[Dispatch] Matching officer for event: {state['event_id']}")

    officer = _find_nearest_officer(
        domain=state["domain"],
        lat=state["coordinates"]["lat"],
        lng=state["coordinates"]["lng"],
    )

    logger.info(
        f"[Dispatch] Matched: {officer['name']} ({officer['officer_id']}) | "
        f"Location: ({officer['current_lat']}, {officer['current_lng']})"
    )

    return {"matched_officer": officer}

# ---------------------------------------------------------------------------
# Graph Compilation
# ---------------------------------------------------------------------------

def compile_graph() -> StateGraph:
    """
    Builds and compiles the three-node LangGraph pipeline.

    Flow:  systemic_auditor → priority_logic → dispatch_agent → END
    """
    graph = StateGraph(PulseState)

    # Add nodes
    graph.add_node("systemic_auditor", systemic_auditor_node)
    graph.add_node("priority_logic", priority_logic_node)
    graph.add_node("dispatch_agent", dispatch_agent_node)

    # Linear flow
    graph.set_entry_point("systemic_auditor")
    graph.add_edge("systemic_auditor", "priority_logic")
    graph.add_edge("priority_logic", "dispatch_agent")
    graph.add_edge("dispatch_agent", END)

    compiled = graph.compile()
    logger.info("LangGraph pipeline compiled: auditor → priority → dispatch")
    return compiled
