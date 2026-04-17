# Civix-Pulse — Data Schemas

> Complete schema reference for all data stores powering the swarm pipeline.

---

## 1. Pinecone (Vector DB — Cluster Detection)

The **Systemic Auditor Agent** uses Pinecone to detect complaint clusters — e.g., 50 "low water pressure" reports that all point to a single pumping station failure.

### Index Configuration

| Property | Value |
|----------|-------|
| **Index Name** | `civix-pulse-events` |
| **Dimensions** | `1536` (OpenAI `text-embedding-3-small`) |
| **Metric** | `cosine` |
| **Cloud / Region** | AWS `us-east-1` (Starter plan) |

### Vector Schema

Each complaint ingested by Dev 2's n8n pipeline is stored as a Pinecone vector:

```
ID:       <event_id>                    (UUID string)
Values:   [float × 1536]               (embedding of translated_description)
Metadata: {
    "event_id":       "evt-abc123",
    "domain":         "MUNICIPAL",       // MUNICIPAL | TRAFFIC | WATER | ELECTRICITY
    "lat":            17.4482,
    "lng":            78.3914,
    "timestamp":      1713350400,        // Unix epoch seconds
    "status":         "NEW",             // NEW | DISPATCHED | RESOLVED
    "original_lang":  "hi",              // ISO 639-1 language code
    "source_channel": "whatsapp"         // whatsapp | twitter | portal | voice
}
```

### Query Pattern (Cluster Detection)

```python
# 1. Fetch the new event's vector
fetch_result = index.fetch(ids=[event_id])
event_vector = fetch_result.vectors[event_id].values

# 2. Search for similar complaints
results = index.query(
    vector=event_vector,
    top_k=5,
    include_metadata=True,
)

# 3. Check similarity threshold
matches = [m for m in results.matches if m.id != event_id]
if matches and matches[0].score >= 0.85:
    # CLUSTER DETECTED — link to master event
```

### Metadata Filters (Future Enhancement)

```python
# Time window (last 12 hours) + geo-radius
filter = {
    "timestamp": {"$gte": int(time.time()) - 43200},
    "lat":       {"$gte": lat - 0.02, "$lte": lat + 0.02},
    "lng":       {"$gte": lng - 0.02, "$lte": lng + 0.02},
}
```

---

## 2. PostgreSQL + PostGIS (Spatial DB — Officer Dispatch)

The **Dispatch Agent** uses PostGIS to find the nearest available officer matching the event's domain. The full SQL schema lives at [`backend/database/schema.sql`](../backend/database/schema.sql).

### Tables

#### `officers` — Field Officer Registry

| Column | Type | Description |
|--------|------|-------------|
| `officer_id` | `TEXT PK` | Unique ID, e.g. `OP-441` |
| `name` | `TEXT` | Full name |
| `phone` | `TEXT` | Contact number |
| `domain_skills` | `TEXT[]` | Array: `{MUNICIPAL, WATER, TRAFFIC, ELECTRICITY}` |
| `status` | `TEXT` | `AVAILABLE` · `DISPATCHED` · `OFF_DUTY` |
| `location` | `GEOGRAPHY(POINT, 4326)` | Live GPS coordinates (WGS84) |
| `updated_at` | `TIMESTAMPTZ` | Last location update timestamp |

**Indexes:**
- `GIST (location)` — spatial nearest-neighbor queries
- `B-TREE (status)` — fast filter on availability

#### `pulse_events` — Event Ledger

| Column | Type | Description |
|--------|------|-------------|
| `event_id` | `TEXT PK` | UUID from Pinecone |
| `translated_description` | `TEXT` | English description |
| `domain` | `TEXT` | Category |
| `coordinates` | `GEOGRAPHY(POINT, 4326)` | Event location |
| `impact_score` | `INT (0-100)` | From Priority Logic Agent |
| `severity_color` | `TEXT` | Hex color |
| `cluster_found` | `BOOLEAN` | From Systemic Auditor |
| `master_event_id` | `TEXT FK` | Links to cluster parent |
| `assigned_officer_id` | `TEXT FK` | Dispatched officer |
| `status` | `TEXT` | `NEW` → `DISPATCHED` → `RESOLVED` |
| `verification_image` | `TEXT` | Proof photo URL |
| `verification_gps` | `GEOGRAPHY(POINT)` | GPS of verification |
| `resolution_verified` | `BOOLEAN` | Vision AI approval |
| `created_at` | `TIMESTAMPTZ` | Ingestion time |
| `resolved_at` | `TIMESTAMPTZ` | Resolution time |
| `time_to_resolution` | `INTERVAL` | Auto-calculated |

#### `dispatch_log` — Audit Trail

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID PK` | Auto-generated |
| `event_id` | `TEXT FK` | Which event |
| `officer_id` | `TEXT FK` | Which officer |
| `action` | `TEXT` | `DISPATCHED` · `DECLINED` · `ESCALATED` · `RESOLVED` |
| `timestamp` | `TIMESTAMPTZ` | When |
| `notes` | `TEXT` | Optional context |

### Key Queries

**Find nearest available officer:**
```sql
SELECT officer_id, name,
       ST_Distance(location, ST_Point(78.3914, 17.4482)::geography) AS dist_meters
FROM officers
WHERE status = 'AVAILABLE'
  AND 'MUNICIPAL' = ANY(domain_skills)
ORDER BY location <-> ST_Point(78.3914, 17.4482)::geography
LIMIT 1;
```

**Get cluster events:**
```sql
SELECT * FROM pulse_events
WHERE master_event_id = 'master-evt-id'
ORDER BY created_at DESC;
```

**Time-to-resolution report:**
```sql
SELECT domain,
       AVG(time_to_resolution) AS avg_resolution,
       COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved_count
FROM pulse_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY domain;
```

---

## 3. Data Flow Summary

```
Citizen Complaint
       │
       ▼
  ┌─────────────┐    embed + store     ┌──────────────┐
  │  n8n (Dev 2) │ ──────────────────▶  │   Pinecone   │
  └─────┬───────┘                      │  (vectors)   │
        │ webhook                       └──────┬───────┘
        ▼                                      │ similarity query
  ┌─────────────┐                              │
  │  FastAPI     │◀────────────────────────────┘
  │  (Backend)   │
  │              │──── nearest officer ──▶ PostGIS
  │              │◀─── officer match ────
  │              │
  │              │──── broadcast ────────▶ WebSocket → Dashboard
  └─────────────┘
```

---

## 4. Setup Instructions

### Pinecone
Already auto-created by the backend on first request. No manual setup needed.

### PostgreSQL + PostGIS

```bash
# 1. Install PostgreSQL 15+ with PostGIS
# Ubuntu/Debian:
sudo apt install postgresql-15 postgresql-15-postgis-3

# Windows: Download from https://www.postgresql.org/download/windows/
# Check "PostGIS" in Stack Builder during install

# 2. Create database
createdb civix_pulse
psql -d civix_pulse -c "CREATE EXTENSION postgis;"

# 3. Run schema
psql -d civix_pulse -f backend/database/schema.sql

# 4. Seed 20 test officers
cd backend
pip install asyncpg
python database/seed_officers.py

# 5. Add connection string to .env
echo 'POSTGRES_URL=postgresql://civix:civix_dev@localhost:5432/civix_pulse' >> .env
```
