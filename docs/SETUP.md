# Local Setup Guide

> **Project:** Civix-Pulse — Agentic Governance & Grievance Resolution Swarm
> **Team:** Vertex

---

## Prerequisites

Ensure the following are installed on your machine before proceeding:

| Tool | Minimum Version | Verification Command |
|---|---|---|
| **Docker** | 24.0+ | `docker --version` |
| **Docker Compose** | 2.20+ (V2 plugin) | `docker compose version` |
| **Git** | 2.40+ | `git --version` |
| **Node.js** | 20.x LTS (for local frontend dev) | `node --version` |
| **Python** | 3.12+ (for local backend dev) | `python --version` |

**Hardware profile:** The full stack is optimized to run on a machine with 8GB RAM, 4-core CPU, and 256GB SSD (tested on Dell Vostro 15 3000).

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/emmanuelmj/civix.git
cd civix
```

---

## Step 2 — Configure Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env` with the following values:

```env
# ─── LLM Providers ───────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...             # Required: Claude Sonnet for agent reasoning
GOOGLE_AI_API_KEY=AIza...                # Required: Gemini Flash for vision + video
BHASHINI_API_KEY=...                     # Optional: Hindi STT (fallback: Whisper)
BHASHINI_USER_ID=...                     # Optional: Bhashini user ID

# ─── Database ────────────────────────────────────────────
POSTGRES_USER=civix
POSTGRES_PASSWORD=civix_dev_2026
POSTGRES_DB=civix_pulse
DATABASE_URL=postgresql+asyncpg://civix:civix_dev_2026@postgres:5432/civix_pulse

# ─── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ─── MinIO (Object Storage) ─────────────────────────────
MINIO_ROOT_USER=civix_minio
MINIO_ROOT_PASSWORD=civix_minio_2026
MINIO_ENDPOINT=minio:9000

# ─── JWT Auth ────────────────────────────────────────────
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# ─── n8n ─────────────────────────────────────────────────
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=civix_n8n_2026

# ─── Application ─────────────────────────────────────────
ENVIRONMENT=development
LOG_LEVEL=INFO
FASTAPI_PORT=8000
NEXTJS_PORT=3000
```

---

## Step 3 — Launch the Full Stack

Start all services with a single command:

```bash
docker compose up --build
```

First build will take 3–5 minutes (downloading base images, installing dependencies). Subsequent starts take ~15 seconds.

### Service Endpoints

Once all containers are healthy:

| Service | URL | Purpose |
|---|---|---|
| **Dashboard** | [http://localhost:3000](http://localhost:3000) | Next.js 15 frontend |
| **API Gateway** | [http://localhost:8000](http://localhost:8000) | FastAPI backend |
| **API Docs (Swagger)** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API documentation |
| **API Docs (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Alternative API documentation |
| **n8n Workflows** | [http://localhost:5678](http://localhost:5678) | Webhook ingestion workflows |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Object storage browser |

### Verify All Services Are Running

```bash
docker compose ps
```

Expected output:

```
NAME              STATUS       PORTS
civix-nextjs      Up (healthy) 0.0.0.0:3000->3000/tcp
civix-fastapi     Up (healthy) 0.0.0.0:8000->8000/tcp
civix-postgres    Up (healthy) 0.0.0.0:5432->5432/tcp
civix-redis       Up (healthy) 0.0.0.0:6379->6379/tcp
civix-minio       Up (healthy) 0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
civix-n8n         Up (healthy) 0.0.0.0:5678->5678/tcp
```

---

## Step 4 — Seed the Database

Load the 60 pre-built realistic complaints, officer roster, and ward data:

```bash
docker compose exec fastapi python scripts/seed_db.py
```

This populates:
- 60 complaints with Bangalore ward coordinates, timestamps, and natural clusters.
- 10 field officers across water, roads, electricity, and sanitation departments.
- Ward boundary data for geo-filtering.

### Pre-compute Embeddings

Generate vector embeddings for all seeded complaints (required for clustering and duplicate detection):

```bash
docker compose exec fastapi python scripts/generate_embeddings.py
```

---

## Step 5 — Verify the Agent Pipeline

Test the end-to-end agent pipeline with a sample complaint:

```bash
curl -X POST http://localhost:8000/api/v1/complaints \
  -H "Content-Type: application/json" \
  -d '{
    "source": "web",
    "text": "Water pressure is very low since 3 days in Jayanagar 4th block",
    "location": {"lat": 12.9250, "lng": 77.5938},
    "language": "en"
  }'
```

Expected response:

```json
{
  "complaint_id": "GRV-2026-00061",
  "status": "ingesting",
  "message": "Complaint received. Agent pipeline initiated."
}
```

Check the agent pipeline status:

```bash
curl http://localhost:8000/api/v1/agents/status
```

---

## Step 6 — Verify Bhashini (Optional)

If you have Bhashini API access configured:

```bash
docker compose exec fastapi python scripts/test_bhashini.py
```

This sends a test Hindi audio clip and verifies transcription + translation.

---

## Local Development (Without Docker)

For faster iteration during development, you can run the frontend and backend natively:

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux/Mac
.venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Run FastAPI with hot reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> Note: PostgreSQL, Redis, and MinIO still need to run via Docker:
> ```bash
> docker compose up postgres redis minio -d
> ```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run Next.js dev server
npm run dev
```

Dashboard available at [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting

### Port Conflicts

If a port is already in use:

```bash
# Find the process using the port (example: port 8000)
# Linux/Mac:
lsof -i :8000
# Windows:
netstat -ano | findstr :8000

# Kill the process or change the port in .env
```

### Docker Memory Issues

If containers are killed due to OOM on an 8GB machine:

```bash
# Check container resource usage
docker stats

# Reduce memory limits in docker-compose.yml if needed
# The default configuration targets ~5GB total for all services
```

### Database Connection Errors

```bash
# Verify PostgreSQL is accepting connections
docker compose exec postgres pg_isready -U civix

# Check PostgreSQL logs
docker compose logs postgres --tail 50
```

### Resetting Everything

To wipe all data and start fresh:

```bash
docker compose down -v          # Remove containers + volumes
docker compose up --build       # Rebuild and start
```

---

## Resource Limits (Docker Compose)

These limits ensure the full stack fits within 8GB RAM:

| Service | Memory Limit | CPU Limit |
|---|---|---|
| PostgreSQL + pgvector | 1.5 GB | 1 core |
| Redis | 256 MB | 0.25 core |
| MinIO | 256 MB | 0.25 core |
| FastAPI + LangGraph | 2 GB | 1.5 cores |
| Next.js | 512 MB | 0.5 core |
| n8n | 512 MB | 0.5 core |
| **Total** | **~5 GB** | **4 cores** |

---

## Next Steps

Once the stack is running:

1. Open the **Dashboard** at [http://localhost:3000](http://localhost:3000).
2. Explore the **Agent Canvas** to see the swarm status.
3. Submit a test complaint via the **Web Portal** or the **API**.
4. Open the **Knowledge Graph** to see complaint clustering.
5. Check the **API Docs** at [http://localhost:8000/docs](http://localhost:8000/docs) for all available endpoints.

---

## References

- [Architecture](ARCHITECTURE.md) — Service topology and container network.
- [Repo Structure](REPO_STRUCTURE.md) — Directory layout explanation.
- [API Spec](API_SPEC.md) — Endpoint contracts for testing.
- [TRD](TRD.md) — Hardware optimization details.
