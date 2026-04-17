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
# Node 1: Systemic Auditor (Cluster Detection)
# ---------------------------------------------------------------------------

async def systemic_auditor_node(state: PulseState) -> dict:
    """
    Checks if this event is part of a systemic cluster.

    MOCK IMPLEMENTATION: Simulates a Pinecone similarity search.
    In production, this queries Pinecone with the event's embedding vector,
    filtering by geo-radius (2km) and time window (12h).
    If cosine similarity > 0.85, links to an existing Master Event.
    """
    logger.info(f"[Auditor] Checking clusters for event: {state['event_id']}")

    # Mock: random similarity score (replace with real Pinecone query)
    similarity_score = random.uniform(0.0, 1.0)

    if similarity_score > 0.85:
        logger.info(
            f"[Auditor] CLUSTER DETECTED — similarity: {similarity_score:.2f}. "
            f"Linking to existing Master Event."
        )
        return {"cluster_found": True}
    else:
        logger.info(
            f"[Auditor] No cluster found — similarity: {similarity_score:.2f}. "
            f"Proceeding as new event."
        )
        return {"cluster_found": False}

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

PRIORITY_SYSTEM_PROMPT = """You are a senior City Planner and public safety expert working for an Indian municipal corporation.

Your job is to evaluate a citizen grievance and assign an impact score.

EVALUATION CRITERIA:
- Immediate danger to life (live wires, open manholes, gas leaks) → 80-100
- Infrastructure affecting many people (water outage, road collapse, sewage overflow) → 60-79
- Quality-of-life issues (streetlight out, pothole, garbage) → 30-59
- Minor cosmetic or non-urgent issues → 1-29

CONTEXT AMPLIFIERS (increase score by 10-20):
- Near a school, hospital, or place of worship
- Affects elderly, disabled, or low-income communities
- Has been unresolved for more than 7 days
- Multiple similar reports in the area

SEVERITY COLOR MAPPING:
- #FF0000 (Red)    → score 70-100 (Critical / Emergency)
- #FFA500 (Orange) → score 40-69  (High / Needs Attention)
- #FFFF00 (Yellow) → score 1-39   (Low / Routine)

You MUST respond with ONLY a valid JSON object, no extra text. Format:
{"impact_score": <int 1-100>, "severity_color": "<hex>", "reasoning": "<one sentence>"}"""

PRIORITY_USER_TEMPLATE = """GRIEVANCE DETAILS:
- Description: {description}
- Domain: {domain}
- Location: ({lat}, {lng})

Respond with ONLY the JSON object."""


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
