"""
Pinecone Service & Watcher — Auto-detects new grievances in Pinecone
=====================================================================
Polls Pinecone index for new vectors inserted by the ingestion pipeline.
When new vectors are detected, extracts metadata, builds PulseState, and
processes through the LangGraph swarm pipeline.

Primary ingestion: Webhook (n8n calls POST /api/v1/webhook/new-event)
Secondary ingestion: Background polling every POLL_INTERVAL seconds
"""

import asyncio
import logging
import os
import time
from typing import Any, Awaitable, Callable

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("civix-pulse.watcher")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "civix-pulse")
PINECONE_NAMESPACE = os.environ.get("PINECONE_NAMESPACE", "civix-events")
POLL_INTERVAL = int(os.environ.get("PINECONE_POLL_INTERVAL", "5"))


# ---------------------------------------------------------------------------
# Pinecone Service — singleton wrapper
# ---------------------------------------------------------------------------

class PineconeService:
    """Thread-safe singleton wrapper around Pinecone client."""

    _instance: "PineconeService | None" = None

    def __init__(self) -> None:
        self._pc: Any = None
        self._index: Any = None
        self._dimension: int = 0
        self._init()

    @classmethod
    def get_instance(cls) -> "PineconeService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init(self) -> None:
        if not PINECONE_API_KEY or PINECONE_API_KEY == "...":
            logger.warning("[Pinecone] No API key configured.")
            return
        try:
            from pinecone import Pinecone

            self._pc = Pinecone(api_key=PINECONE_API_KEY)
            self._index = self._pc.Index(PINECONE_INDEX_NAME)
            stats = self._index.describe_index_stats()
            self._dimension = stats.dimension or 0
            logger.info(
                f"[Pinecone] Connected to '{PINECONE_INDEX_NAME}' | "
                f"Vectors: {stats.total_vector_count} | "
                f"Dimension: {self._dimension}"
            )
        except Exception as e:
            logger.error(f"[Pinecone] Init failed: {e}")

    @property
    def index(self) -> Any:
        return self._index

    @property
    def is_connected(self) -> bool:
        return self._index is not None

    @property
    def dimension(self) -> int:
        return self._dimension

    def stats(self) -> dict[str, Any]:
        """Return index statistics for the dashboard."""
        if not self.is_connected:
            return {"connected": False}
        try:
            s = self._index.describe_index_stats()
            return {
                "connected": True,
                "index_name": PINECONE_INDEX_NAME,
                "total_vectors": s.total_vector_count,
                "dimension": s.dimension,
                "namespaces": (
                    {k: v.vector_count for k, v in s.namespaces.items()}
                    if s.namespaces
                    else {}
                ),
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}

    def list_all_ids(self, namespace: str = "") -> set[str]:
        """List all vector IDs in the index."""
        if not self.is_connected:
            return set()
        try:
            all_ids: set[str] = set()
            for id_list in self._index.list(namespace=namespace):
                if isinstance(id_list, (list, tuple)):
                    all_ids.update(id_list)
                else:
                    all_ids.add(str(id_list))
            return all_ids
        except Exception as e:
            logger.error(f"[Pinecone] list_all_ids failed: {e}")
            return set()

    def fetch_vectors(
        self, ids: list[str], namespace: str = ""
    ) -> dict[str, Any]:
        """Fetch vectors with metadata by IDs."""
        if not self.is_connected or not ids:
            return {}
        try:
            result = self._index.fetch(ids=ids, namespace=namespace)
            return result.vectors
        except Exception as e:
            logger.error(f"[Pinecone] fetch failed: {e}")
            return {}

    def query_similar(
        self,
        vector: list[float],
        top_k: int = 10,
        exclude_id: str | None = None,
        namespace: str = "",
        filter_dict: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Query for similar vectors. Returns list of {id, score, metadata}."""
        if not self.is_connected:
            return []
        try:
            result = self._index.query(
                vector=vector,
                top_k=top_k + (1 if exclude_id else 0),
                include_metadata=True,
                namespace=namespace,
                filter=filter_dict,
            )
            matches: list[dict[str, Any]] = []
            for m in result.matches:
                if exclude_id and m.id == exclude_id:
                    continue
                matches.append({
                    "id": m.id,
                    "score": round(m.score, 4),
                    "metadata": dict(m.metadata) if m.metadata else {},
                })
            return matches[:top_k]
        except Exception as e:
            logger.error(f"[Pinecone] query failed: {e}")
            return []

    def update_metadata(
        self, vector_id: str, metadata_update: dict[str, Any], namespace: str = ""
    ) -> bool:
        """Update metadata on an existing vector (e.g. status → PROCESSED)."""
        if not self.is_connected:
            return False
        try:
            self._index.update(
                id=vector_id,
                set_metadata=metadata_update,
                namespace=namespace,
            )
            return True
        except Exception as e:
            logger.error(f"[Pinecone] update_metadata failed for {vector_id}: {e}")
            return False

    def query_by_metadata(
        self,
        filter_dict: dict[str, Any],
        top_k: int = 100,
        namespace: str = "",
    ) -> list[dict[str, Any]]:
        """Query vectors by metadata filter (no vector needed — uses zero-vector)."""
        if not self.is_connected:
            return []
        try:
            # Use a zero vector to query by metadata only
            zero_vec = [0.0] * self._dimension
            result = self._index.query(
                vector=zero_vec,
                top_k=top_k,
                include_metadata=True,
                namespace=namespace,
                filter=filter_dict,
            )
            return [
                {"id": m.id, "score": m.score, "metadata": dict(m.metadata) if m.metadata else {}}
                for m in result.matches
            ]
        except Exception as e:
            logger.error(f"[Pinecone] query_by_metadata failed: {e}")
            return []


# ---------------------------------------------------------------------------
# Metadata Extraction — flexible schema for interop with other dev
# ---------------------------------------------------------------------------

# Tries multiple possible field names for each piece of data
_FIELD_ALIASES: dict[str, list[str]] = {
    "description": [
        "translated_description", "text", "provided_text", "raw_input",
        "description", "complaint", "message", "content", "body",
    ],
    "original_text": [
        "raw_input", "provided_text", "text", "description",
    ],
    "domain": ["domain", "category", "department", "type", "service"],
    "issue_type": ["issue_type", "issue", "complaint_type", "sub_category"],
    "lat": ["latitude", "lat", "location_lat", "y"],
    "lng": ["longitude", "lng", "location_lng", "lon", "x"],
    "channel": ["source", "channel", "intake_source", "platform", "medium"],
    "language": ["language", "lang", "original_language", "locale"],
    "timestamp": ["timestamp", "created_at", "time", "date", "ingested_at"],
    "citizen_id": ["citizen_id", "user_id", "phone", "mobile"],
    "citizen_name": ["citizen_name", "name", "user_name", "reporter"],
    "sentiment_score": ["sentiment_score", "sentiment", "emotion_score"],
    "panic_flag": ["panic_flag", "panic", "emergency", "urgent"],
    "event_id": ["event_id", "id", "complaint_id", "ticket_id"],
    "image_url": ["image_url", "image", "photo_url", "attachment"],
    "audio_url": ["audio_url", "audio", "voice_url", "recording"],
}

# Normalize raw domain strings → canonical domain
_DOMAIN_MAP: dict[str, str] = {
    "WATER": "WATER", "WATER_SUPPLY": "WATER", "SEWAGE": "WATER",
    "ELECTRICITY": "ELECTRICITY", "POWER": "ELECTRICITY", "ELECTRICAL": "ELECTRICITY",
    "TRAFFIC": "TRAFFIC", "ROAD": "TRAFFIC", "TRANSPORT": "TRAFFIC", "ROADS": "TRAFFIC",
    "MUNICIPAL": "MUNICIPAL", "SANITATION": "MUNICIPAL", "GARBAGE": "MUNICIPAL",
    "CONSTRUCTION": "CONSTRUCTION", "BUILDING": "CONSTRUCTION",
    "EMERGENCY": "EMERGENCY", "FIRE": "EMERGENCY", "SAFETY": "EMERGENCY",
}


def _get_field(meta: dict, field: str, default: Any = "") -> Any:
    """Try multiple aliases for a field name."""
    for alias in _FIELD_ALIASES.get(field, [field]):
        if alias in meta and meta[alias] is not None:
            return meta[alias]
    return default


def extract_metadata(event_id: str, metadata: dict) -> dict[str, Any]:
    """
    Extract PulseState fields from Pinecone vector metadata.
    Matches the actual schema:
      citizen_id, citizen_name, domain, issue_type, latitude, longitude,
      provided_text, raw_input, text, translated_description,
      sentiment_score, panic_flag, source, timestamp, image_url, audio_url
    """
    # Description: prefer translated_description > text > provided_text > raw_input
    description = _get_field(metadata, "description")
    original_text = _get_field(metadata, "original_text") or description

    raw_domain = str(_get_field(metadata, "domain", "MUNICIPAL")).upper()
    domain = _DOMAIN_MAP.get(raw_domain, raw_domain or "MUNICIPAL")

    # Coordinates: default to central Hyderabad if 0 or missing
    lat = float(_get_field(metadata, "lat", 0))
    lng = float(_get_field(metadata, "lng", 0))
    if lat == 0 or lng == 0:
        # Default to Charminar area with slight jitter for demo visibility
        import random
        lat = 17.3616 + random.uniform(-0.02, 0.02)
        lng = 78.4747 + random.uniform(-0.02, 0.02)

    channel = _get_field(metadata, "channel", "portal")
    language = _get_field(metadata, "language", "en")
    ts = _get_field(metadata, "timestamp", "")
    issue_type = _get_field(metadata, "issue_type", "")

    # Citizen info
    citizen_id = str(_get_field(metadata, "citizen_id", ""))
    citizen_name = str(_get_field(metadata, "citizen_name", "Anonymous"))

    # Urgency signals
    sentiment = _get_field(metadata, "sentiment_score", 5)
    panic_raw = str(_get_field(metadata, "panic_flag", "false")).lower()
    panic = panic_raw in ("true", "1", "yes")

    # Media
    image_url = str(_get_field(metadata, "image_url", ""))
    audio_url = str(_get_field(metadata, "audio_url", ""))

    # Use event_id from metadata if available (more reliable), else use vector ID
    real_event_id = str(_get_field(metadata, "event_id", "")) or event_id

    # Parse timestamp — handle ISO 8601 strings
    ts_epoch: int
    if isinstance(ts, (int, float)) and ts > 0:
        ts_epoch = int(ts)
    elif isinstance(ts, str) and ts:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            ts_epoch = int(dt.timestamp())
        except (ValueError, TypeError):
            ts_epoch = int(time.time())
    else:
        ts_epoch = int(time.time())

    return {
        "event_id": real_event_id,
        "translated_description": str(description),
        "original_text": str(original_text),
        "domain": domain,
        "issue_type": str(issue_type),
        "coordinates": {"lat": lat, "lng": lng},
        "channel": str(channel),
        "language": str(language),
        "timestamp": ts_epoch,
        "citizen_id": citizen_id,
        "citizen_name": citizen_name,
        "sentiment_score": int(float(sentiment)) if sentiment else 5,
        "panic_flag": panic,
        "image_url": image_url,
        "audio_url": audio_url,
    }


# ---------------------------------------------------------------------------
# Pinecone Watcher — background polling loop
# ---------------------------------------------------------------------------

class PineconeWatcher:
    """
    Background service that polls Pinecone for new vectors and processes them
    through the LangGraph swarm pipeline.

    On startup:  seeds processed_ids with existing vectors (no re-processing)
    While running: every poll_interval seconds, checks for new vector IDs
    """

    def __init__(
        self,
        pinecone_service: PineconeService,
        process_fn: Callable[[dict[str, Any]], Awaitable[None]],
        poll_interval: int = POLL_INTERVAL,
        namespace: str = PINECONE_NAMESPACE,
    ) -> None:
        self.pc = pinecone_service
        self.process_fn = process_fn
        self.poll_interval = poll_interval
        self.namespace = namespace
        self.processed_ids: set[str] = set()
        self._running = False
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        """Start the watcher. Seeds processed_ids with existing vectors."""
        if not self.pc.is_connected:
            logger.warning("[Watcher] Pinecone not connected. Watcher disabled.")
            return

        # Seed with existing IDs so we don't reprocess old events on first run
        self.processed_ids = self.pc.list_all_ids(namespace=self.namespace)
        logger.info(
            f"[Watcher] Seeded with {len(self.processed_ids)} existing vectors "
            f"(namespace='{self.namespace}'). "
            f"Polling every {self.poll_interval}s — filtering by status='NEW'…"
        )

        self._running = True
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[Watcher] Stopped.")

    async def _poll_loop(self) -> None:
        while self._running:
            try:
                await self._poll()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Watcher] Poll error: {e}")
            await asyncio.sleep(self.poll_interval)

    async def _poll(self) -> None:
        """
        Check for new vectors using two strategies:
        1. Metadata filter: query for vectors with status == "NEW"
        2. ID-based fallback: detect new IDs not in processed_ids set
        After processing, marks vectors as status="PROCESSED" in Pinecone.
        """
        new_vectors: dict[str, Any] = {}

        # Strategy 1: Query by metadata status == "NEW"
        new_by_status = self.pc.query_by_metadata(
            filter_dict={"status": {"$eq": "NEW"}},
            top_k=50,
            namespace=self.namespace,
        )
        if new_by_status:
            ids_from_status = [m["id"] for m in new_by_status if m["id"] not in self.processed_ids]
            if ids_from_status:
                fetched = self.pc.fetch_vectors(ids_from_status, namespace=self.namespace)
                new_vectors.update(fetched)

        # Strategy 2: ID-based fallback for vectors without status metadata
        current_ids = self.pc.list_all_ids(namespace=self.namespace)
        new_ids = current_ids - self.processed_ids
        if new_ids:
            # Only fetch IDs we haven't already fetched via strategy 1
            unfetched = [vid for vid in new_ids if vid not in new_vectors]
            if unfetched:
                fetched = self.pc.fetch_vectors(unfetched[:50], namespace=self.namespace)
                new_vectors.update(fetched)

        if not new_vectors:
            return

        logger.info(f"[Watcher] 🔔 Detected {len(new_vectors)} new vector(s)")

        for vid, vdata in new_vectors.items():
            try:
                meta = dict(vdata.metadata) if vdata.metadata else {}
                event_data = extract_metadata(vid, meta)
                event_data["_vector"] = (
                    list(vdata.values) if vdata.values else None
                )

                await self.process_fn(event_data)
                self.processed_ids.add(vid)

                # Mark as PROCESSED in Pinecone so it's never picked up again
                self.pc.update_metadata(
                    vid, {"status": "PROCESSED"}, namespace=self.namespace
                )
                logger.info(f"[Watcher] ✓ Processed & marked: {vid[:30]}…")
            except Exception as e:
                logger.error(f"[Watcher] ✗ Failed to process {vid}: {e}")
                self.processed_ids.add(vid)  # Don't retry indefinitely

    def mark_processed(self, event_id: str) -> None:
        """Manually mark an event as processed (used by webhook/trigger-analysis)."""
        self.processed_ids.add(event_id)
        self.pc.update_metadata(
            event_id, {"status": "PROCESSED"}, namespace=self.namespace
        )

    async def bootstrap(self) -> int:
        """
        Force-process ALL existing vectors in Pinecone, ignoring processed_ids.
        Used to backfill PostgreSQL from existing Pinecone data.
        Returns the number of events processed.
        """
        all_ids = self.pc.list_all_ids(namespace=self.namespace)
        if not all_ids:
            logger.info("[Watcher] Bootstrap: no vectors found.")
            return 0

        logger.info(f"[Watcher] 🚀 Bootstrap: processing {len(all_ids)} vectors…")
        processed = 0

        # Process in batches of 50
        id_list = list(all_ids)
        for i in range(0, len(id_list), 50):
            batch = id_list[i : i + 50]
            vectors = self.pc.fetch_vectors(batch, namespace=self.namespace)

            for vid, vdata in vectors.items():
                try:
                    meta = dict(vdata.metadata) if vdata.metadata else {}
                    event_data = extract_metadata(vid, meta)
                    event_data["_vector"] = (
                        list(vdata.values) if vdata.values else None
                    )
                    await self.process_fn(event_data)
                    self.processed_ids.add(vid)
                    self.pc.update_metadata(
                        vid, {"status": "PROCESSED"}, namespace=self.namespace
                    )
                    processed += 1
                    logger.info(f"[Watcher] ✓ Bootstrap processed: {vid[:20]}…")
                except Exception as e:
                    logger.error(f"[Watcher] ✗ Bootstrap failed for {vid}: {e}")
                    self.processed_ids.add(vid)

        logger.info(f"[Watcher] 🚀 Bootstrap complete: {processed}/{len(all_ids)} events.")
        return processed

    @property
    def status(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "processed_count": len(self.processed_ids),
            "poll_interval_seconds": self.poll_interval,
            "namespace": self.namespace,
        }
