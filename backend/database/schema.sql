-- =============================================================
-- Civix-Pulse — PostgreSQL Schema (No PostGIS Required)
-- =============================================================
-- Spatial database for field officer tracking and event dispatch.
-- Uses plain lat/lng columns; distance calculated in application.
-- Requires: PostgreSQL 15+
--
-- Usage:
--   psql -U civix -d civix_pulse -f schema.sql
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Officers ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS officers (
    officer_id    TEXT PRIMARY KEY,                        -- e.g. "OP-441"
    name          TEXT NOT NULL,
    phone         TEXT,
    domain_skills TEXT[] NOT NULL DEFAULT '{}',            -- e.g. {"MUNICIPAL","WATER"}
    status        TEXT NOT NULL DEFAULT 'AVAILABLE'        -- AVAILABLE | DISPATCHED | OFF_DUTY
                  CHECK (status IN ('AVAILABLE', 'DISPATCHED', 'OFF_DUTY')),
    latitude      DOUBLE PRECISION,                       -- WGS84 latitude
    longitude     DOUBLE PRECISION,                       -- WGS84 longitude
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_officers_status
    ON officers (status);

CREATE INDEX IF NOT EXISTS idx_officers_coords
    ON officers (latitude, longitude);

-- ─── Pulse Events (local ledger) ─────────────────────────────

CREATE TABLE IF NOT EXISTS pulse_events (
    event_id              TEXT PRIMARY KEY,                -- UUID from Pinecone
    citizen_id            TEXT,                            -- phone or ID of the citizen
    citizen_name          TEXT,
    translated_description TEXT NOT NULL,
    domain                TEXT NOT NULL,                   -- MUNICIPAL, TRAFFIC, WATER, ELECTRICITY
    issue_type            TEXT,                            -- e.g. "Road Blockage", "Pipe Burst"
    latitude              DOUBLE PRECISION NOT NULL,
    longitude             DOUBLE PRECISION NOT NULL,
    sentiment_score       INT DEFAULT 5                    -- 1-10 scale
                          CHECK (sentiment_score BETWEEN 1 AND 10),
    panic_flag            BOOLEAN NOT NULL DEFAULT FALSE,
    source                TEXT DEFAULT 'blob',             -- blob, voice, ocr, webhook
    raw_input             TEXT,                            -- original citizen text
    image_url             TEXT,
    audio_url             TEXT,
    impact_score          INT NOT NULL DEFAULT 0
                          CHECK (impact_score BETWEEN 0 AND 100),
    severity_color        TEXT NOT NULL DEFAULT '#FFFF00',
    cluster_found         BOOLEAN NOT NULL DEFAULT FALSE,
    master_event_id       TEXT REFERENCES pulse_events(event_id),
    assigned_officer_id   TEXT REFERENCES officers(officer_id),
    status                TEXT NOT NULL DEFAULT 'NEW'
                          CHECK (status IN ('NEW','ANALYZING','DISPATCHED','IN_PROGRESS','RESOLVED','ESCALATED')),
    verification_image    TEXT,                            -- uploaded proof photo URL
    verification_lat      DOUBLE PRECISION,
    verification_lng      DOUBLE PRECISION,
    resolution_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at           TIMESTAMPTZ,
    time_to_resolution    INTERVAL GENERATED ALWAYS AS (resolved_at - created_at) STORED
);

CREATE INDEX IF NOT EXISTS idx_events_coords
    ON pulse_events (latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_events_created
    ON pulse_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_domain
    ON pulse_events (domain);

CREATE INDEX IF NOT EXISTS idx_events_status
    ON pulse_events (status);

-- ─── Dispatch Log (audit trail) ──────────────────────────────

CREATE TABLE IF NOT EXISTS dispatch_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        TEXT NOT NULL REFERENCES pulse_events(event_id),
    officer_id      TEXT NOT NULL REFERENCES officers(officer_id),
    action          TEXT NOT NULL
                    CHECK (action IN ('DISPATCHED','DECLINED','ESCALATED','RESOLVED')),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes           TEXT
);

-- ─── Seed Data: Officers ─────────────────────────────────────

INSERT INTO officers (officer_id, name, phone, domain_skills, status, latitude, longitude) VALUES
    ('OP-101', 'Rajesh Kumar',     '9876543210', '{MUNICIPAL,WATER}',       'AVAILABLE',  17.3850, 78.4867),
    ('OP-102', 'Priya Sharma',     '9876543211', '{TRAFFIC}',              'AVAILABLE',  17.3616, 78.4747),
    ('OP-103', 'Arjun Reddy',      '9876543212', '{ELECTRICITY}',          'DISPATCHED', 17.4400, 78.3489),
    ('OP-104', 'Sneha Patel',      '9876543213', '{MUNICIPAL,ELECTRICITY}','AVAILABLE',  17.4156, 78.4347),
    ('OP-105', 'Vikram Singh',     '9876543214', '{WATER}',                'AVAILABLE',  17.3950, 78.5100),
    ('OP-106', 'Ananya Desai',     '9876543215', '{TRAFFIC,MUNICIPAL}',    'AVAILABLE',  17.3750, 78.4500),
    ('OP-107', 'Mohammed Hussain', '9876543216', '{WATER,ELECTRICITY}',    'OFF_DUTY',   17.4050, 78.4700),
    ('OP-108', 'Kavitha Nair',     '9876543217', '{MUNICIPAL}',            'AVAILABLE',  17.4260, 78.4200)
ON CONFLICT (officer_id) DO NOTHING;

-- ─── Nearest Officer Query (Haversine in SQL) ────────────────
-- Usage: replace $lat, $lng, $domain with actual values
--
-- SELECT officer_id, name, latitude, longitude,
--   (6371000 * acos(
--     cos(radians($lat)) * cos(radians(latitude))
--     * cos(radians(longitude) - radians($lng))
--     + sin(radians($lat)) * sin(radians(latitude))
--   )) AS dist_meters
-- FROM officers
-- WHERE status = 'AVAILABLE'
--   AND $domain = ANY(domain_skills)
-- ORDER BY dist_meters ASC
-- LIMIT 1;
