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
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from backend.swarm.graph import compile_graph, PulseState
    from backend.swarm.pinecone_watcher import PineconeService, PineconeWatcher, extract_metadata
    from backend.database.db import (
        init_pool, close_pool, insert_pulse_event, update_event_status,
        insert_dispatch_log, get_officers, get_officer, update_officer_location,
        update_officer_status, find_nearest_officer, list_events, get_event,
        list_officer_tasks, get_pool,
    )
except ImportError:
    from swarm.graph import compile_graph, PulseState
    from swarm.pinecone_watcher import PineconeService, PineconeWatcher, extract_metadata
    from database.db import (
        init_pool, close_pool, insert_pulse_event, update_event_status,
        insert_dispatch_log, get_officers, get_officer, update_officer_location,
        update_officer_status, find_nearest_officer, list_events, get_event,
        list_officer_tasks, get_pool,
    )

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

    # ── 6. Broadcast: enriched intake update (with pipeline results) ──
    await manager.broadcast({
        "type": "intake_update",
        "data": {
            "id": f"intake-{event_id}",
            "channel": channel,
            "original_text": event_data.get("original_text", event_data["translated_description"]),
            "translated_text": event_data["translated_description"],
            "timestamp": ts_after,
            "coordinates": event_data["coordinates"],
            "citizen_name": citizen_name,
            "citizen_id": citizen_id,
            "issue_type": issue_type,
            "panic_flag": panic_flag,
            "sentiment_score": sentiment,
            "impact_score": final_state["impact_score"],
        },
    })

    # ── 7. Persist to PostgreSQL ──────────────────────────────────
    try:
        coords = final_state["coordinates"]
        await insert_pulse_event({
            "event_id": event_id,
            "citizen_id": citizen_id or None,
            "citizen_name": citizen_name or None,
            "translated_description": event_data["translated_description"],
            "domain": final_state["domain"],
            "issue_type": issue_type or None,
            "latitude": coords.get("lat", 0),
            "longitude": coords.get("lng", 0),
            "sentiment_score": sentiment if isinstance(sentiment, int) else 5,
            "panic_flag": bool(panic_flag),
            "source": channel,
            "raw_input": event_data.get("original_text", ""),
            "image_url": event_data.get("image_url"),
            "audio_url": event_data.get("audio_url"),
            "impact_score": final_state["impact_score"],
            "severity_color": final_state["severity_color"],
            "cluster_found": final_state["cluster_found"],
            "master_event_id": None,  # cluster_id is synthetic, not a real FK
            "assigned_officer_id": officer_id if officer_id != "N/A" else None,
            "status": "DISPATCHED" if officer_id != "N/A" else "ANALYZING",
        })

        if officer_id != "N/A":
            await insert_dispatch_log(
                event_id=event_id,
                officer_id=officer_id,
                action="DISPATCHED",
                notes=f"Auto-dispatched by swarm. Distance: {distance}km. Score: {final_state['impact_score']}",
            )
            await update_officer_status(officer_id, "DISPATCHED")

        logger.info(f"Event {event_id} persisted to PostgreSQL")
    except Exception as e:
        logger.warning(f"DB persistence failed (non-fatal): {e}")

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

    # Initialize PostgreSQL connection pool
    try:
        await init_pool()
        logger.info("PostgreSQL connection pool ready.")
    except Exception as e:
        logger.warning(f"PostgreSQL not available: {e} (running without DB persistence)")

    # Compile LangGraph pipeline
    swarm_app = compile_graph()
    logger.info("LangGraph swarm compiled and ready.")

    # Initialize Pinecone service
    pinecone_service = PineconeService.get_instance()

    # Start background watcher — polls Pinecone for new vectors from n8n/Dev 2
    watcher = PineconeWatcher(
        pinecone_service=pinecone_service,
        process_fn=process_event_through_pipeline,
    )
    await watcher.start()
    logger.info("Pinecone watcher started (polling for new vectors).")

    yield

    # Shutdown
    if watcher:
        await watcher.stop()
    await close_pool()
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

# ── Static uploads (verification photos etc.) — reachable at /uploads/* ───
import os as _os
from pathlib import Path as _Path
_uploads_dir = _Path(__file__).parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

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

@app.get("/api/v1/watcher/status")
async def watcher_status() -> dict[str, Any]:
    """Background Pinecone watcher stats."""
    if not watcher:
        return {"status": "error", "running": False, "message": "Watcher not initialized"}
    return {"status": "ok", **watcher.status}


@app.post("/api/v1/watcher/rescan")
async def watcher_rescan() -> dict[str, str]:
    """Force the watcher to rescan Pinecone immediately."""
    if watcher and watcher._running:
        asyncio.create_task(watcher._poll())
        return {"status": "ok", "message": "Rescan triggered"}
    return {"status": "error", "message": "Watcher not running"}


@app.post("/api/v1/watcher/bootstrap")
async def watcher_bootstrap() -> dict[str, Any]:
    """
    Force-process ALL existing Pinecone vectors through the LangGraph pipeline.
    Populates PostgreSQL from existing Pinecone data. Idempotent (upserts).
    """
    if not watcher:
        return {"status": "error", "message": "Watcher not initialized"}

    processed = await watcher.bootstrap()
    return {
        "status": "ok",
        "processed": processed,
        "message": f"Bootstrap complete: {processed} events processed into PostgreSQL",
    }


# ---------------------------------------------------------------------------
# Field Worker (Officer) Endpoints
# ---------------------------------------------------------------------------

class LocationUpdate(BaseModel):
    officer_id: str = Field(..., description="Officer identifier, e.g. OP-441")
    lat: float = Field(..., description="Current latitude")
    lng: float = Field(..., description="Current longitude")


class VerifyResolutionRequest(BaseModel):
    officer_id: str = Field(..., description="Officer who resolved the issue")
    event_id: str = Field(..., description="Event/ticket being verified")
    photo_base64: str | None = Field(None, description="Base64-encoded verification photo (optional)")
    notes: str | None = Field(None, description="Resolution notes from the field worker")


@app.post("/api/v1/officer/update-location")
async def officer_update_location(payload: LocationUpdate) -> dict[str, Any]:
    """Field worker app pings this to share live GPS location."""
    logger.info(f"Officer {payload.officer_id} location: ({payload.lat}, {payload.lng})")

    # Persist to PostgreSQL
    try:
        await update_officer_location(payload.officer_id, payload.lat, payload.lng)
    except Exception as e:
        logger.warning(f"DB location update failed: {e}")

    # Broadcast to Command Center dashboard
    await manager.broadcast({
        "event_type": "OFFICER_LOCATION",
        "data": {
            "officer_id": payload.officer_id,
            "lat": payload.lat,
            "lng": payload.lng,
            "timestamp": time.time(),
        },
    })
    return {"status": "ok", "officer_id": payload.officer_id}


async def _llm_verify_resolution(
    description: str,
    domain: str,
    officer_notes: str | None,
    has_photo: bool,
) -> dict[str, Any]:
    """Use LLM to evaluate whether a resolution is credible."""
    try:
        try:
            from backend.swarm.graph import _build_priority_llm
        except ImportError:
            from swarm.graph import _build_priority_llm

        llm = _build_priority_llm()
        if llm is None:
            return {"confidence": 0.94 if has_photo else 0.72, "reasoning": "LLM unavailable — default confidence", "method": "fallback"}

        system_prompt = """You are a municipal resolution verification API. You evaluate whether a field resolution of a citizen complaint is credible.

RULES:
1. Respond with ONLY a JSON object. No other text.
2. Evaluate based on: complaint type, officer notes, and whether photo evidence was provided.

SCORING:
- Photo evidence + detailed notes → 0.90-0.98
- Photo evidence, minimal notes → 0.80-0.89
- No photo, detailed notes → 0.65-0.79
- No photo, no notes → 0.40-0.60

RESPONSE FORMAT:
{"confidence": 0.92, "reasoning": "Photo evidence provided for sewage cleanup, consistent with complaint type"}"""

        user_msg = f"""Original complaint: {description}
Domain: {domain}
Officer notes: {officer_notes or 'No notes provided'}
Photo evidence: {'Yes' if has_photo else 'No'}

Return ONLY the JSON object."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ]

        response = await llm.ainvoke(messages)
        import re
        json_match = re.search(r"\{[^}]+\}", response.content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            confidence = float(data.get("confidence", 0.85))
            reasoning = data.get("reasoning", "AI verification analysis")
            return {"confidence": round(confidence, 2), "reasoning": reasoning, "method": "llm_analysis"}

        return {"confidence": 0.85, "reasoning": "LLM response parsing failed — moderate confidence", "method": "fallback"}
    except Exception as e:
        logger.warning(f"[Verify] LLM verification failed: {e}")
        return {"confidence": 0.94 if has_photo else 0.72, "reasoning": f"LLM error: {str(e)[:50]}", "method": "fallback"}


@app.post("/api/v1/officer/verify-resolution")
async def officer_verify_resolution(payload: VerifyResolutionRequest) -> dict[str, Any]:
    """
    Field worker submits verification photo after resolving an issue.
    The AI swarm validates and closes the ticket.
    """
    logger.info(f"Verification from {payload.officer_id} for event {payload.event_id}")
    has_photo = payload.photo_base64 is not None and len(payload.photo_base64) > 0

    # ── Persist photo to disk so it can be served to n8n / dashboard ──
    import base64
    import os
    from pathlib import Path
    photo_path_rel: str | None = None
    photo_url: str | None = None
    if has_photo:
        try:
            uploads_dir = Path(__file__).parent / "uploads" / "verification"
            uploads_dir.mkdir(parents=True, exist_ok=True)
            raw = payload.photo_base64
            if raw.startswith("data:"):
                # strip "data:image/jpeg;base64,"
                raw = raw.split(",", 1)[-1]
            img_bytes = base64.b64decode(raw)
            fname = f"{payload.event_id}_{int(time.time())}.jpg"
            fpath = uploads_dir / fname
            fpath.write_bytes(img_bytes)
            photo_path_rel = f"verification/{fname}"
            photo_url = f"/uploads/{photo_path_rel}"
            logger.info(f"[Verify] Saved photo ({len(img_bytes)}B) → {photo_path_rel}")
        except Exception as e:
            logger.warning(f"[Verify] Could not persist photo: {e}")

    # Fetch original event description for LLM verification context
    event_description = ""
    event_domain = ""
    try:
        event_data = await get_event(payload.event_id)
        if event_data:
            event_description = event_data.get("translated_description", "")
            event_domain = event_data.get("domain", "")
    except Exception:
        pass

    # LLM-powered verification analysis
    llm_result = await _llm_verify_resolution(
        description=event_description,
        domain=event_domain,
        officer_notes=payload.notes,
        has_photo=has_photo,
    )

    verification_result = {
        "event_id": payload.event_id,
        "officer_id": payload.officer_id,
        "verified": llm_result["confidence"] >= 0.5,
        "confidence": llm_result["confidence"],
        "method": llm_result["method"],
        "reasoning": llm_result["reasoning"],
        "timestamp": time.time(),
    }
    logger.info(
        f"[Verify] LLM result: confidence={llm_result['confidence']}, "
        f"method={llm_result['method']}, reasoning={llm_result['reasoning'][:60]}"
    )

    # Persist to PostgreSQL
    try:
        from datetime import datetime, timezone
        await update_event_status(
            payload.event_id,
            "RESOLVED",
            resolution_verified=True,
            resolved_at=datetime.now(timezone.utc),
            verification_image=photo_url,
        )
        await insert_dispatch_log(
            event_id=payload.event_id,
            officer_id=payload.officer_id,
            action="RESOLVED",
            notes=payload.notes or "Verified via field worker app",
        )
        await update_officer_status(payload.officer_id, "AVAILABLE")
    except Exception as e:
        logger.warning(f"DB resolution update failed: {e}")

    # Broadcast resolution to Command Center
    await manager.broadcast({
        "event_type": "RESOLUTION_VERIFIED",
        "data": {**verification_result, "photo_url": photo_url},
    })

    return {
        "status": "ok",
        "verified": verification_result["verified"],
        "confidence": verification_result["confidence"],
        "reasoning": verification_result.get("reasoning", ""),
        "photo_url": photo_url,
        "photo_path": photo_path_rel,
        "message": f"Event {payload.event_id} verified and closed.",
    }


# ── Officer Query Endpoints (for field worker app) ──────────────

@app.get("/api/v1/officer/{officer_id}")
async def api_get_officer(officer_id: str) -> dict[str, Any]:
    """Get officer profile by ID."""
    try:
        officer = await get_officer(officer_id)
        if officer is None:
            return {"status": "not_found", "officer_id": officer_id}
        for k, v in officer.items():
            if hasattr(v, "isoformat"):
                officer[k] = v.isoformat()
        return {"status": "ok", "officer": officer}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/api/v1/officer/{officer_id}/tasks")
async def api_officer_tasks(officer_id: str, limit: int = 20) -> dict[str, Any]:
    """List events assigned to a specific officer — used by the field worker app."""
    try:
        events = await list_officer_tasks(officer_id, limit=limit)
        for e in events:
            for k, v in e.items():
                if hasattr(v, "isoformat"):
                    e[k] = v.isoformat()
        return {"status": "ok", "officer_id": officer_id, "count": len(events), "tasks": events}
    except Exception as e:
        logger.error(f"Failed to fetch tasks for {officer_id}: {e}")
        return {"status": "error", "error": str(e), "tasks": []}


# ── Data Query Endpoints (for dashboard) ────────────────────────

@app.get("/api/v1/events")
async def api_list_events(
    limit: int = 50,
    status: str | None = None,
    domain: str | None = None,
) -> dict[str, Any]:
    """List recent pulse events from PostgreSQL."""
    try:
        events = await list_events(limit=limit, status=status, domain=domain)
        # Convert datetime objects for JSON serialization
        for e in events:
            for k, v in e.items():
                if hasattr(v, "isoformat"):
                    e[k] = v.isoformat()
        return {"status": "ok", "count": len(events), "events": events}
    except Exception as e:
        logger.error(f"Failed to list events: {e}")
        return {"status": "error", "error": str(e), "events": []}


@app.get("/api/v1/events/{event_id}")
async def api_get_event(event_id: str) -> dict[str, Any]:
    """Get a single event by ID."""
    try:
        event = await get_event(event_id)
        if event is None:
            return {"status": "not_found"}
        for k, v in event.items():
            if hasattr(v, "isoformat"):
                event[k] = v.isoformat()
        return {"status": "ok", "event": event}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/api/v1/officers")
async def api_list_officers(status: str | None = None) -> dict[str, Any]:
    """List officers from PostgreSQL."""
    try:
        officers = await get_officers(status=status)
        for o in officers:
            for k, v in o.items():
                if hasattr(v, "isoformat"):
                    o[k] = v.isoformat()
        return {"status": "ok", "count": len(officers), "officers": officers}
    except Exception as e:
        logger.error(f"Failed to list officers: {e}")
        return {"status": "error", "error": str(e), "officers": []}


# ---------------------------------------------------------------------------
# Analytics Endpoints (dashboard-backing)
# ---------------------------------------------------------------------------

@app.get("/api/v1/analytics/departments")
async def analytics_departments() -> dict[str, Any]:
    """Per-domain department analytics derived from pulse_events."""
    sql = """
        WITH agg AS (
            SELECT
                UPPER(domain) AS domain,
                COUNT(*) AS total_events,
                COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
                COUNT(*) FILTER (
                    WHERE status = 'RESOLVED'
                      AND time_to_resolution IS NOT NULL
                      AND time_to_resolution <= INTERVAL '60 minutes'
                ) AS resolved_within_sla,
                AVG(EXTRACT(EPOCH FROM time_to_resolution)/60.0)
                    FILTER (WHERE status = 'RESOLVED' AND time_to_resolution IS NOT NULL) AS avg_resolution_minutes,
                AVG(impact_score) AS avg_impact_score,
                COUNT(*) FILTER (WHERE cluster_found = TRUE) AS cluster_count
            FROM pulse_events
            GROUP BY UPPER(domain)
        )
        SELECT
            domain,
            total_events,
            resolved,
            CASE WHEN total_events = 0 THEN NULL
                 ELSE ROUND(100.0 * resolved_within_sla / total_events)::int
            END AS sla_compliance_pct,
            CASE WHEN avg_resolution_minutes IS NULL THEN NULL
                 ELSE ROUND(avg_resolution_minutes)::int
            END AS avg_resolution_minutes,
            ROUND(COALESCE(avg_impact_score, 0)::numeric, 1) AS avg_impact_score,
            CASE WHEN total_events = 0 THEN 0
                 ELSE ROUND(100.0 * cluster_count / total_events)::int
            END AS cluster_resolution_pct,
            LEAST(5.0, GREATEST(1.0,
                COALESCE(ROUND(100.0 * resolved_within_sla / NULLIF(total_events,0))::numeric, 0) / 25.0 + 1.0
            ))::numeric(3,1) AS satisfaction
        FROM agg
        ORDER BY sla_compliance_pct DESC NULLS LAST
    """
    try:
        pool = get_pool()
        rows = await pool.fetch(sql)
        data = [dict(r) for r in rows]
        for d in data:
            for k, v in d.items():
                if hasattr(v, "__float__") and type(v).__name__ == "Decimal":
                    d[k] = float(v)
        return {"status": "ok", "data": data}
    except Exception as e:
        logger.exception("analytics_departments failed")
        return {"status": "error", "error": str(e), "data": []}


@app.get("/api/v1/analytics/kpis")
async def analytics_kpis() -> dict[str, Any]:
    """Overall KPI totals across all events."""
    sql = """
        SELECT
            COUNT(*)::int AS total_events,
            COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved,
            COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'DISPATCHED')::int AS dispatched,
            COUNT(*) FILTER (WHERE status = 'NEW')::int AS new,
            CASE WHEN COUNT(*) FILTER (WHERE status = 'RESOLVED' AND time_to_resolution IS NOT NULL) = 0
                 THEN NULL
                 ELSE ROUND(AVG(EXTRACT(EPOCH FROM time_to_resolution)/60.0)
                        FILTER (WHERE status = 'RESOLVED' AND time_to_resolution IS NOT NULL))::int
            END AS avg_resolution_minutes,
            ROUND(COALESCE(AVG(impact_score), 0)::numeric, 1) AS avg_impact_score,
            COUNT(DISTINCT master_event_id) FILTER (WHERE cluster_found = TRUE)::int AS clusters_found,
            COUNT(DISTINCT assigned_officer_id) FILTER (
                WHERE status IN ('DISPATCHED','IN_PROGRESS')
            )::int AS unique_officers_active
        FROM pulse_events
    """
    try:
        pool = get_pool()
        row = await pool.fetchrow(sql)
        data = dict(row) if row else {}
        for k, v in data.items():
            if type(v).__name__ == "Decimal":
                data[k] = float(v)
        return {"status": "ok", "data": data}
    except Exception as e:
        logger.exception("analytics_kpis failed")
        return {"status": "error", "error": str(e), "data": {}}


@app.get("/api/v1/analytics/timeline")
async def analytics_timeline(days: int = 7) -> dict[str, Any]:
    """Daily event/resolution counts over the last N days, zero-filled."""
    days = max(1, min(days, 90))
    sql = """
        WITH series AS (
            SELECT generate_series(
                CURRENT_DATE - ($1::int - 1),
                CURRENT_DATE,
                INTERVAL '1 day'
            )::date AS day
        ),
        agg AS (
            SELECT
                date_trunc('day', created_at)::date AS day,
                COUNT(*)::int AS events,
                COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved
            FROM pulse_events
            WHERE created_at >= CURRENT_DATE - ($1::int - 1)
            GROUP BY 1
        )
        SELECT
            to_char(series.day, 'YYYY-MM-DD') AS day,
            COALESCE(agg.events, 0) AS events,
            COALESCE(agg.resolved, 0) AS resolved
        FROM series
        LEFT JOIN agg USING (day)
        ORDER BY series.day ASC
    """
    try:
        pool = get_pool()
        rows = await pool.fetch(sql, days)
        return {"status": "ok", "data": [dict(r) for r in rows]}
    except Exception as e:
        logger.exception("analytics_timeline failed")
        return {"status": "error", "error": str(e), "data": []}


@app.get("/api/v1/analytics/channels")
async def analytics_channels() -> dict[str, Any]:
    """Event counts grouped by source channel."""
    sql = """
        SELECT COALESCE(source, 'blob') AS source, COUNT(*)::int AS count
        FROM pulse_events
        GROUP BY COALESCE(source, 'blob')
        ORDER BY count DESC
    """
    try:
        pool = get_pool()
        rows = await pool.fetch(sql)
        return {"status": "ok", "data": [dict(r) for r in rows]}
    except Exception as e:
        logger.exception("analytics_channels failed")
        return {"status": "error", "error": str(e), "data": []}


@app.get("/api/v1/graph/infrastructure")
async def graph_infrastructure() -> dict[str, Any]:
    """Top geographic hotspots derived from event lat/lng clustering."""
    sql = """
        SELECT
            ROUND(latitude::numeric, 2)::float AS lat,
            ROUND(longitude::numeric, 2)::float AS lng,
            UPPER(domain) AS domain,
            COUNT(*)::int AS event_count
        FROM pulse_events
        GROUP BY 1, 2, 3
        ORDER BY event_count DESC
        LIMIT 6
    """
    try:
        pool = get_pool()
        rows = await pool.fetch(sql)
        data = []
        for r in rows:
            lat = r["lat"]
            lng = r["lng"]
            dom = r["domain"]
            data.append({
                "id": f"infra-{dom.lower()}-{lat}-{lng}",
                "label": f"Hotspot {dom} @ {lat},{lng}",
                "domain": dom,
                "lat": lat,
                "lng": lng,
                "event_count": r["event_count"],
            })
        return {"status": "ok", "data": data}
    except Exception as e:
        logger.exception("graph_infrastructure failed")
        return {"status": "error", "error": str(e), "data": []}


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
