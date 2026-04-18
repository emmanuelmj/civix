"""
Seed historical Civix-Pulse pulse_events for analytics/dashboard demos.

Idempotent: if >30 events already exist, it skips.

Run:
    cd backend && python -m database.seed_historical
"""

from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

try:
    from backend.database.db import init_pool, close_pool, get_pool
except ImportError:
    from database.db import init_pool, close_pool, get_pool


DOMAINS = ["MUNICIPAL", "TRAFFIC", "WATER", "ELECTRICITY", "EMERGENCY", "CONSTRUCTION"]
STATUSES_OPEN = ["NEW", "ANALYZING", "DISPATCHED", "IN_PROGRESS"]
SOURCES = ["whatsapp", "portal", "twitter", "voice", "blob"]
SEVERITY_COLORS = ["#FFFF00", "#FFA500", "#FF0000"]

OFFICER_IDS = [f"OP-10{i}" for i in range(1, 9)]

SAMPLE_TEXTS = {
    "MUNICIPAL": [
        "Garbage overflow near market area for days",
        "Broken streetlight on main road",
        "Stray dog menace in residential colony",
        "Park maintenance needed, overgrown grass",
    ],
    "TRAFFIC": [
        "Traffic signal broken causing jams",
        "Large pothole causing accidents",
        "Illegal parking blocking road",
        "Roadwork barricades left unattended",
    ],
    "WATER": [
        "Water main burst flooding street",
        "No water supply for 48 hours",
        "Sewage overflow into drinking water line",
        "Contaminated water from tap",
    ],
    "ELECTRICITY": [
        "Transformer sparking during rain",
        "Power outage for 6 hours",
        "Live wire dangling dangerously",
        "Electrical pole tilted near school",
    ],
    "EMERGENCY": [
        "Gas leak reported near residential zone",
        "Building wall collapsed after rainfall",
        "Chemical smell from nearby industry",
        "Fire hazard at fuel station",
    ],
    "CONSTRUCTION": [
        "Crane operating without safety barrier",
        "Construction debris blocking footpath",
        "Unauthorized building work at night",
        "Demolition causing dust pollution",
    ],
}


async def seed() -> int:
    await init_pool()
    pool = get_pool()

    count_row = await pool.fetchrow("SELECT COUNT(*)::int AS n FROM pulse_events")
    existing = count_row["n"] if count_row else 0
    if existing > 30:
        print(f"[seed_historical] Already have {existing} events — skipping.")
        await close_pool()
        return 0

    now = datetime.now(timezone.utc)
    rng = random.Random(42)

    inserted = 0
    for _ in range(60):
        domain = rng.choice(DOMAINS)
        created_offset_hours = rng.uniform(0, 7 * 24)
        created_at = now - timedelta(hours=created_offset_hours)

        is_resolved = rng.random() < 0.5
        if is_resolved:
            resolve_minutes = rng.uniform(15, 240)
            resolved_at = created_at + timedelta(minutes=resolve_minutes)
            status = "RESOLVED"
        else:
            resolved_at = None
            status = rng.choice(STATUSES_OPEN)

        cluster_found = rng.random() < 0.25
        impact_score = rng.randint(20, 95)
        if impact_score >= 80:
            severity_color = "#FF0000"
        elif impact_score >= 55:
            severity_color = "#FFA500"
        else:
            severity_color = "#FFFF00"

        lat = rng.uniform(17.35, 17.48)
        lng = rng.uniform(78.30, 78.55)
        text = rng.choice(SAMPLE_TEXTS[domain])
        source = rng.choice(SOURCES)
        sentiment = rng.randint(2, 9)
        panic = rng.random() < 0.1
        officer_id = rng.choice(OFFICER_IDS) if rng.random() < 0.7 else None

        event_id = f"seed-{uuid.uuid4()}"

        try:
            await pool.execute(
                """
                INSERT INTO pulse_events (
                    event_id, translated_description, domain, latitude, longitude,
                    sentiment_score, panic_flag, source, raw_input,
                    impact_score, severity_color, cluster_found,
                    assigned_officer_id, status, created_at, resolved_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (event_id) DO NOTHING
                """,
                event_id, text, domain, lat, lng,
                sentiment, panic, source, text,
                impact_score, severity_color, cluster_found,
                officer_id, status, created_at, resolved_at,
            )
            inserted += 1
        except Exception as e:
            print(f"[seed_historical] insert failed: {e}")

    print(f"[seed_historical] Inserted {inserted} historical events (existing before: {existing}).")
    await close_pool()
    return inserted


if __name__ == "__main__":
    asyncio.run(seed())
