"""
Civix-Pulse Backend — FastAPI Application (Enhanced)
=====================================================
Central Brain & Dispatch Engine for the agentic grievance resolution swarm.

Endpoints:
  - POST /api/v1/webhook/new-event    → Other dev's n8n calls this when data lands in Pinecone
  - POST /api/v1/trigger-analysis     → Process a single complaint through LangGraph
  - POST /api/v1/trigger-swarm        → Fire N demo complaints through real pipeline
  - GET  /api/v1/pinecone/status      → Pinecone connection info for dashboard
  - GET  /api/v1/watcher/status       → Background watcher stats
  - WS   /ws/dashboard                → Real-time WebSocket feed

Background:
  - PineconeWatcher polls for new vectors every 10s and auto-processes them
"""

import asyncio
import json
import logging
import random
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from backend.swarm.graph import compile_graph, PulseState
    from backend.swarm.pinecone_watcher import PineconeService, PineconeWatcher, extract_metadata
except ImportError:
    from swarm.graph import compile_graph, PulseState
    from swarm.pinecone_watcher import PineconeService, PineconeWatcher, extract_metadata

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("civix-pulse")

# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages active WebSocket connections for real-time dashboard updates."""

    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"Dashboard connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)
        logger.info(f"Dashboard disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        payload = json.dumps(message)
        stale: list[WebSocket] = []
        for conn in self.active_connections:
            try:
                await conn.send_text(payload)
            except Exception:
                stale.append(conn)
        for ws in stale:
            self.active_connections.discard(ws)


manager = ConnectionManager()

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------

swarm_app = None
pinecone_service: PineconeService | None = None
watcher: PineconeWatcher | None = None

# ---------------------------------------------------------------------------
# Core processing function — used by webhook, watcher, and trigger-analysis
# ---------------------------------------------------------------------------

async def process_event_through_pipeline(event_data: dict[str, Any]) -> dict[str, Any]:
    """
    Process a single event through the full LangGraph pipeline and broadcast
    all stages to the dashboard via WebSocket.

    This is the SINGLE processing path used by:
      - Webhook (new-event from n8n)
      - PineconeWatcher (background polling)
      - trigger-analysis (manual trigger)
      - trigger-swarm (batch demo)
    """
    event_id = event_data["event_id"]
    ts = int(time.time() * 1000)
    channel = event_data.get("channel", "portal")

    # ── 1. Broadcast: complaint received ──────────────────────────
    citizen_name = event_data.get("citizen_name", "Anonymous")
    citizen_id = event_data.get("citizen_id", "")
    panic_flag = event_data.get("panic_flag", False)
    sentiment = event_data.get("sentiment_score", 5)
    issue_type = event_data.get("issue_type", "")

    await manager.broadcast({
        "type": "intake_update",
        "data": {
            "id": f"intake-{event_id}",
            "channel": channel,
            "original_text": event_data.get("original_text", event_data["translated_description"]),
            "translated_text": event_data["translated_description"],
            "timestamp": ts,
            "coordinates": event_data["coordinates"],
            "citizen_name": citizen_name,
            "citizen_id": citizen_id,
            "issue_type": issue_type,
            "panic_flag": panic_flag,
            "sentiment_score": sentiment,
        },
    })

    # ── 2. Broadcast: pipeline started ────────────────────────────
    await manager.broadcast({
        "type": "swarm_log",
        "data": {
            "id": f"log-{event_id}-start",
            "type": "system",
            "message": (
                f"Pipeline awakened for {event_data['domain']} event "
                f"{event_id[:12]}… [source: {channel}]"
            ),
            "timestamp": ts,
            "event_id": event_id,
        },
    })

    # ── 3. Run LangGraph pipeline ─────────────────────────────────
    initial_state: PulseState = {
        "event_id": event_id,
        "translated_description": event_data["translated_description"],
        "domain": event_data["domain"],
        "coordinates": event_data["coordinates"],
        "cluster_found": False,
        "cluster_id": "",
        "cluster_size": 0,
        "similar_events": [],
        "impact_score": 0,
        "severity_color": "#FFFF00",
        "reasoning": "",
        "matched_officer": None,
    }

    final_state = await swarm_app.ainvoke(initial_state)
    ts_after = int(time.time() * 1000)

    # ── 4. Broadcast: agent results ───────────────────────────────
    cluster_msg = (
        f"Systemic Auditor: 🔗 CLUSTER DETECTED — "
        f"linked to {final_state.get('cluster_id', 'unknown')}, "
        f"cluster of {final_state.get('cluster_size', 0)} events"
        if final_state["cluster_found"]
        else "Systemic Auditor: No cluster match. Isolated event."
    )
    await manager.broadcast({
        "type": "swarm_log",
        "data": {
            "id": f"log-{event_id}-audit",
            "type": "analysis",
            "message": cluster_msg,
            "timestamp": ts_after,
            "event_id": event_id,
        },
    })

    reasoning = final_state.get("reasoning", "")
    await manager.broadcast({
        "type": "swarm_log",
        "data": {
            "id": f"log-{event_id}-priority",
            "type": "analysis",
            "message": (
                f"Priority Agent: Score {final_state['impact_score']}/100 "
                f"({final_state['severity_color']}). {reasoning}"
            ),
            "timestamp": ts_after + 1,
            "event_id": event_id,
        },
    })

    officer = final_state.get("matched_officer") or {}
    officer_id = officer.get("officer_id", "N/A")
    officer_name = officer.get("name", "Unknown")
    distance = officer.get("distance_km", "?")
    await manager.broadcast({
        "type": "swarm_log",
        "data": {
            "id": f"log-{event_id}-dispatch",
            "type": "dispatch",
            "message": (
                f"Dispatch Agent: Assigned {officer_name} ({officer_id}) "
                f"→ {distance}km away "
                f"({event_data['coordinates']['lat']:.4f}, "
                f"{event_data['coordinates']['lng']:.4f})"
            ),
            "timestamp": ts_after + 2,
            "event_id": event_id,
        },
    })

    # ── 5. Broadcast: NEW_DISPATCH (map update) ───────────────────
    dispatch_payload: dict[str, Any] = {
        "event_type": "NEW_DISPATCH",
        "data": {
            "pulse_event": {
                "event_id": final_state["event_id"],
                "category": final_state["domain"],
                "impact_score": final_state["impact_score"],
                "severity_color": final_state["severity_color"],
                "cluster_found": final_state["cluster_found"],
                "cluster_id": final_state.get("cluster_id", ""),
                "cluster_size": final_state.get("cluster_size", 0),
                "coordinates": final_state["coordinates"],
                "reasoning": reasoning,
                "summary": event_data["translated_description"][:120],
                "citizen_name": citizen_name,
                "citizen_id": citizen_id,
                "issue_type": issue_type,
                "panic_flag": panic_flag,
                "sentiment_score": sentiment,
            },
            "assigned_officer": final_state["matched_officer"],
        },
    }

    await manager.broadcast(dispatch_payload)

    logger.info(
        f"Pipeline complete for {event_id} | "
        f"Score: {final_state['impact_score']} | "
        f"Cluster: {final_state['cluster_found']} | "
        f"Officer: {officer_id} | "
        f"Clients: {len(manager.active_connections)}"
    )

    return dispatch_payload

# ---------------------------------------------------------------------------
# Lifespan — compile graph + start watcher
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global swarm_app, pinecone_service, watcher

    # Compile LangGraph pipeline
    swarm_app = compile_graph()
    logger.info("LangGraph swarm compiled and ready.")

    # Initialize Pinecone service
    pinecone_service = PineconeService.get_instance()

    # Start background watcher
    watcher = PineconeWatcher(
        pinecone_service=pinecone_service,
        process_fn=process_event_through_pipeline,
    )
    await watcher.start()

    yield

    # Shutdown
    if watcher:
        await watcher.stop()
    logger.info("Shutting down Civix-Pulse backend.")

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Civix-Pulse API",
    description="Agentic Governance & Grievance Resolution Swarm — Central Brain",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class Coordinates(BaseModel):
    lat: float = Field(..., description="Latitude of the event")
    lng: float = Field(..., description="Longitude of the event")


class TriggerAnalysisRequest(BaseModel):
    event_id: str = Field(..., description="UUID of the Pulse Event")
    translated_description: str = Field(..., description="English description of the grievance")
    domain: str = Field(..., description="Category: MUNICIPAL, TRAFFIC, WATER, ELECTRICITY, etc.")
    coordinates: Coordinates


class WebhookEventRequest(BaseModel):
    """Payload from n8n webhook when new data lands in Pinecone."""
    event_id: str = Field(..., description="Pinecone vector ID")
    # Optional overrides — if not provided, we'll fetch from Pinecone metadata
    description: str | None = Field(None, description="Complaint text (optional, fetched from Pinecone if missing)")
    domain: str | None = Field(None, description="Category (optional)")
    lat: float | None = Field(None)
    lng: float | None = Field(None)
    channel: str | None = Field(None, description="Source: whatsapp, portal, twitter, etc.")


class DispatchResponse(BaseModel):
    event_type: str = "NEW_DISPATCH"
    data: dict[str, Any]

# ---------------------------------------------------------------------------
# REST Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "civix-pulse-backend", "version": "0.2.0"}


# ── Webhook: receives new event notifications from n8n ────────────

@app.post("/api/v1/webhook/new-event")
async def webhook_new_event(payload: WebhookEventRequest) -> dict[str, Any]:
    """
    Called by the other dev's n8n workflow when a new complaint is ingested
    into Pinecone. Fetches the vector + metadata from Pinecone, then processes
    through the full LangGraph pipeline.

    Minimal payload:  { "event_id": "<pinecone-vector-id>" }
    The rest is fetched from Pinecone metadata automatically.
    """
    logger.info(f"Webhook received for event: {payload.event_id}")

    # Try to fetch metadata from Pinecone
    event_data: dict[str, Any] | None = None

    if pinecone_service and pinecone_service.is_connected:
        vectors = pinecone_service.fetch_vectors([payload.event_id])
        if payload.event_id in vectors:
            vdata = vectors[payload.event_id]
            meta = dict(vdata.metadata) if vdata.metadata else {}
            event_data = extract_metadata(payload.event_id, meta)
            logger.info(f"Webhook: fetched metadata from Pinecone for {payload.event_id}")

    # Fall back to webhook payload fields
    if event_data is None:
        event_data = {
            "event_id": payload.event_id,
            "translated_description": payload.description or "Complaint received via webhook",
            "original_text": payload.description or "",
            "domain": (payload.domain or "MUNICIPAL").upper(),
            "coordinates": {
                "lat": payload.lat or 17.385,
                "lng": payload.lng or 78.4867,
            },
            "channel": payload.channel or "webhook",
        }

    # Mark as processed so the watcher doesn't double-process
    if watcher:
        watcher.mark_processed(payload.event_id)

    # Process through LangGraph
    result = await process_event_through_pipeline(event_data)

    return {
        "status": "ok",
        "event_id": payload.event_id,
        "impact_score": result["data"]["pulse_event"]["impact_score"],
        "officer": result["data"]["assigned_officer"]["officer_id"] if result["data"].get("assigned_officer") else None,
    }


# ── Direct trigger: process a single complaint ───────────────────

@app.post("/api/v1/trigger-analysis", response_model=DispatchResponse)
async def trigger_analysis(payload: TriggerAnalysisRequest) -> DispatchResponse:
    """
    Process a single complaint through the full LangGraph pipeline.
    Used by fire_demo.py and direct API calls.
    """
    event_data = {
        "event_id": payload.event_id,
        "translated_description": payload.translated_description,
        "original_text": payload.translated_description,
        "domain": payload.domain,
        "coordinates": {
            "lat": payload.coordinates.lat,
            "lng": payload.coordinates.lng,
        },
        "channel": "api",
    }

    result = await process_event_through_pipeline(event_data)
    return DispatchResponse(**result)


# ── Batch trigger: fire N complaints through real pipeline ────────

SWARM_COMPLAINTS: list[dict[str, Any]] = [
    {"desc": "Exposed live wire dangling over school playground in Gachibowli", "domain": "ELECTRICITY", "lat": 17.4401, "lng": 78.3489},
    {"desc": "Water main burst flooding MG Road near Secunderabad station", "domain": "WATER", "lat": 17.4399, "lng": 78.5018},
    {"desc": "Large pothole causing traffic jam at Kukatpally junction", "domain": "TRAFFIC", "lat": 17.4947, "lng": 78.3996},
    {"desc": "Garbage overflow near Charminar for 5 days strong smell", "domain": "MUNICIPAL", "lat": 17.3616, "lng": 78.4747},
    {"desc": "Crane operating without safety perimeter near hospital", "domain": "CONSTRUCTION", "lat": 17.4156, "lng": 78.4347},
    {"desc": "Sewage overflow into Malkajgiri residential area", "domain": "WATER", "lat": 17.4534, "lng": 78.5267},
    {"desc": "Gas leak at LPG distribution center Kukatpally", "domain": "EMERGENCY", "lat": 17.4849, "lng": 78.3942},
    {"desc": "Building wall collapse in Old City after rainfall", "domain": "EMERGENCY", "lat": 17.3604, "lng": 78.4736},
    {"desc": "Sparking electricity pole during rain in Kondapur", "domain": "ELECTRICITY", "lat": 17.4632, "lng": 78.3522},
    {"desc": "Chemical spill at Jeedimetla industrial area", "domain": "EMERGENCY", "lat": 17.5085, "lng": 78.4498},
]


@app.post("/api/v1/trigger-swarm")
async def trigger_swarm(count: int = 5) -> dict[str, Any]:
    """Fire N complaints through the REAL LangGraph pipeline."""
    n = min(count, len(SWARM_COMPLAINTS))
    picked = random.sample(SWARM_COMPLAINTS, n)
    results: list[dict[str, Any]] = []

    for s in picked:
        eid = str(uuid.uuid4())
        event_data = {
            "event_id": eid,
            "translated_description": s["desc"],
            "original_text": s["desc"],
            "domain": s["domain"],
            "coordinates": {"lat": s["lat"], "lng": s["lng"]},
            "channel": "demo",
        }
        try:
            result = await process_event_through_pipeline(event_data)
            results.append({
                "event_id": eid,
                "status": "ok",
                "score": result["data"]["pulse_event"]["impact_score"],
            })
        except Exception as e:
            logger.error(f"Swarm event {eid} failed: {e}")
            results.append({"event_id": eid, "status": "error", "error": str(e)})

    ok_count = sum(1 for r in results if r["status"] == "ok")
    logger.info(f"Trigger-swarm: {ok_count}/{n} events via LangGraph.")
    return {"status": "ok", "events_fired": ok_count, "total": n, "results": results}


# ── Pinecone status endpoint ─────────────────────────────────────

@app.get("/api/v1/pinecone/status")
async def pinecone_status() -> dict[str, Any]:
    """Returns Pinecone connection status and index stats."""
    pc_stats = pinecone_service.stats() if pinecone_service else {"connected": False}
    watcher_stats = watcher.status if watcher else {"running": False}
    return {
        "pinecone": pc_stats,
        "watcher": watcher_stats,
    }


# ── Watcher control ──────────────────────────────────────────────

@app.post("/api/v1/watcher/rescan")
async def watcher_rescan() -> dict[str, str]:
    """Force the watcher to rescan Pinecone immediately."""
    if watcher and watcher._running:
        asyncio.create_task(watcher._poll())
        return {"status": "ok", "message": "Rescan triggered"}
    return {"status": "error", "message": "Watcher not running"}


# ---------------------------------------------------------------------------
# WebSocket Endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket) -> None:
    """Real-time event stream for the Command Center dashboard."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(
                json.dumps({"event_type": "PONG", "data": data})
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket)
