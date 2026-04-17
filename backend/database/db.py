"""
Civix-Pulse — Async PostgreSQL Database Layer
=============================================
Uses raw asyncpg (no ORM) for maximum performance.
Connection pool is created on startup, closed on shutdown.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import asyncpg
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("civix-pulse.db")

# ---------------------------------------------------------------------------
# Module-level pool reference
# ---------------------------------------------------------------------------
_pool: asyncpg.Pool | None = None


def _dsn() -> str:
    """Return a plain asyncpg-compatible DSN from the env var."""
    url = os.getenv("POSTGRES_URL", "")
    if not url:
        raise RuntimeError("POSTGRES_URL environment variable is not set")
    # Strip the SQLAlchemy dialect suffix so asyncpg can connect
    return url.replace("postgresql+asyncpg://", "postgresql://")


# ── Pool Management ───────────────────────────────────────────────────────


async def init_pool() -> asyncpg.Pool:
    """Create the asyncpg connection pool and store it module-wide."""
    global _pool
    if _pool is not None:
        return _pool
    dsn = _dsn()
    log.info("Creating asyncpg pool  → %s", dsn.split("@")[-1])
    _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
    log.info("Pool ready (min=2, max=10)")
    return _pool


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        log.info("Connection pool closed")
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the live pool or raise if it has not been initialised."""
    if _pool is None:
        raise RuntimeError(
            "Database pool is not initialised. Call init_pool() first."
        )
    return _pool


# ── Helpers ───────────────────────────────────────────────────────────────


def _row_to_dict(row: asyncpg.Record | None) -> dict[str, Any] | None:
    """Convert an asyncpg Record to a plain dict (returns None for None)."""
    return dict(row) if row is not None else None


def _rows_to_dicts(rows: list[asyncpg.Record]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


# ── Pulse Events ──────────────────────────────────────────────────────────

# Columns that can be supplied when inserting a pulse event.
_PULSE_COLS: list[str] = [
    "event_id",
    "citizen_id",
    "citizen_name",
    "translated_description",
    "domain",
    "issue_type",
    "latitude",
    "longitude",
    "sentiment_score",
    "panic_flag",
    "source",
    "raw_input",
    "image_url",
    "audio_url",
    "impact_score",
    "severity_color",
    "cluster_found",
    "master_event_id",
    "assigned_officer_id",
    "status",
    "verification_image",
    "verification_lat",
    "verification_lng",
    "resolution_verified",
    "created_at",
    "resolved_at",
]


async def insert_pulse_event(event: dict[str, Any]) -> str:
    """
    Upsert a pulse event (INSERT … ON CONFLICT DO UPDATE).

    *event* keys must match column names in **pulse_events**.
    Returns the ``event_id``.
    """
    pool = get_pool()

    # Only keep keys that actually belong to the table
    cols = [c for c in _PULSE_COLS if c in event]
    placeholders = ", ".join(f"${i}" for i in range(1, len(cols) + 1))
    col_names = ", ".join(cols)

    # Build the SET clause for ON CONFLICT — update every column except PK
    update_cols = [c for c in cols if c != "event_id"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = (
        f"INSERT INTO pulse_events ({col_names}) "
        f"VALUES ({placeholders}) "
        f"ON CONFLICT (event_id) DO UPDATE SET {update_set} "
        f"RETURNING event_id"
    )

    values = [event[c] for c in cols]
    try:
        row = await pool.fetchrow(sql, *values)
        log.debug("Upserted pulse_event %s", row["event_id"])
        return row["event_id"]
    except Exception:
        log.exception("insert_pulse_event failed for %s", event.get("event_id"))
        raise


# Columns that update_event_status may touch (besides status itself).
_STATUS_EXTRA_FIELDS: set[str] = {
    "assigned_officer_id",
    "impact_score",
    "severity_color",
    "cluster_found",
    "master_event_id",
    "resolved_at",
    "verification_image",
    "verification_lat",
    "verification_lng",
    "resolution_verified",
}


async def update_event_status(
    event_id: str,
    status: str,
    **kwargs: Any,
) -> None:
    """Update event status and any additional whitelisted fields."""
    pool = get_pool()

    sets: list[str] = ["status = $1"]
    values: list[Any] = [status]
    idx = 2

    for key, val in kwargs.items():
        if key not in _STATUS_EXTRA_FIELDS:
            log.warning("update_event_status: ignoring unknown field '%s'", key)
            continue
        sets.append(f"{key} = ${idx}")
        values.append(val)
        idx += 1

    values.append(event_id)
    sql = (
        f"UPDATE pulse_events SET {', '.join(sets)} "
        f"WHERE event_id = ${idx}"
    )

    try:
        await pool.execute(sql, *values)
        log.debug("Updated event %s → status=%s", event_id, status)
    except Exception:
        log.exception("update_event_status failed for %s", event_id)
        raise


async def get_event(event_id: str) -> dict[str, Any] | None:
    """Fetch a single pulse event by its ID."""
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            "SELECT * FROM pulse_events WHERE event_id = $1", event_id
        )
        return _row_to_dict(row)
    except Exception:
        log.exception("get_event failed for %s", event_id)
        raise


async def list_events(
    limit: int = 50,
    status: str | None = None,
    domain: str | None = None,
) -> list[dict[str, Any]]:
    """
    Return recent pulse events ordered by ``created_at DESC``.

    Optionally filter by *status* and/or *domain*.
    """
    pool = get_pool()
    clauses: list[str] = []
    values: list[Any] = []
    idx = 1

    if status is not None:
        clauses.append(f"status = ${idx}")
        values.append(status)
        idx += 1

    if domain is not None:
        clauses.append(f"domain = ${idx}")
        values.append(domain)
        idx += 1

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    values.append(limit)

    sql = (
        f"SELECT * FROM pulse_events {where} "
        f"ORDER BY created_at DESC LIMIT ${idx}"
    )

    try:
        rows = await pool.fetch(sql, *values)
        return _rows_to_dicts(rows)
    except Exception:
        log.exception("list_events failed")
        raise


# ── Officers ──────────────────────────────────────────────────────────────


async def get_officers(
    status: str | None = None,
) -> list[dict[str, Any]]:
    """List all officers, optionally filtered by status."""
    pool = get_pool()

    if status is not None:
        sql = "SELECT * FROM officers WHERE status = $1 ORDER BY officer_id"
        rows = await pool.fetch(sql, status)
    else:
        sql = "SELECT * FROM officers ORDER BY officer_id"
        rows = await pool.fetch(sql)

    return _rows_to_dicts(rows)


async def update_officer_location(
    officer_id: str,
    lat: float,
    lng: float,
) -> None:
    """Update an officer's GPS position and refresh ``updated_at``."""
    pool = get_pool()
    try:
        await pool.execute(
            "UPDATE officers "
            "SET latitude = $1, longitude = $2, updated_at = $3 "
            "WHERE officer_id = $4",
            lat,
            lng,
            datetime.now(timezone.utc),
            officer_id,
        )
        log.debug("Officer %s location → (%s, %s)", officer_id, lat, lng)
    except Exception:
        log.exception("update_officer_location failed for %s", officer_id)
        raise


async def update_officer_status(officer_id: str, status: str) -> None:
    """Change an officer's availability status."""
    pool = get_pool()
    try:
        await pool.execute(
            "UPDATE officers SET status = $1, updated_at = $2 "
            "WHERE officer_id = $3",
            status,
            datetime.now(timezone.utc),
            officer_id,
        )
        log.debug("Officer %s → %s", officer_id, status)
    except Exception:
        log.exception("update_officer_status failed for %s", officer_id)
        raise


async def find_nearest_officer(
    lat: float,
    lng: float,
    domain: str,
    limit: int = 1,
) -> list[dict[str, Any]]:
    """
    Find the nearest AVAILABLE officers whose ``domain_skills`` contain
    *domain*, ranked by Haversine distance (metres).

    Returns up to *limit* results, each including a ``dist_meters`` field.
    """
    pool = get_pool()

    sql = """
        SELECT officer_id, name, phone, domain_skills,
               status, latitude, longitude, updated_at,
               (6371000 * acos(
                   LEAST(1.0, GREATEST(-1.0,
                       cos(radians($1)) * cos(radians(latitude))
                       * cos(radians(longitude) - radians($2))
                       + sin(radians($1)) * sin(radians(latitude))
                   ))
               )) AS dist_meters
        FROM officers
        WHERE status = 'AVAILABLE'
          AND $3 = ANY(domain_skills)
        ORDER BY dist_meters ASC
        LIMIT $4
    """

    try:
        rows = await pool.fetch(sql, lat, lng, domain, limit)
        return _rows_to_dicts(rows)
    except Exception:
        log.exception("find_nearest_officer failed")
        raise


# ── Dispatch Log ──────────────────────────────────────────────────────────


async def insert_dispatch_log(
    event_id: str,
    officer_id: str,
    action: str,
    notes: str | None = None,
) -> str:
    """Insert a dispatch-log entry and return its UUID as a string."""
    pool = get_pool()
    log_id = str(uuid.uuid4())

    try:
        await pool.execute(
            "INSERT INTO dispatch_log (id, event_id, officer_id, action, notes) "
            "VALUES ($1::uuid, $2, $3, $4, $5)",
            log_id,
            event_id,
            officer_id,
            action,
            notes,
        )
        log.debug("Dispatch log %s → %s / %s / %s", log_id, event_id, officer_id, action)
        return log_id
    except Exception:
        log.exception("insert_dispatch_log failed")
        raise
