# Setup Guide

> Local development and Docker deployment instructions for Civix-Pulse.

For the full repository layout see [`REPO_STRUCTURE.md`](./REPO_STRUCTURE.md). For system architecture see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1 — Clone the Repository](#step-1--clone-the-repository)
- [Step 2 — Configure Environment Variables](#step-2--configure-environment-variables)
- [Step 3 — Build and Start Services](#step-3--build-and-start-services)
- [Step 4 — Seed the Database](#step-4--seed-the-database)
- [Step 5 — Verify the Pipeline](#step-5--verify-the-pipeline)
- [Step 6 — Verify Bhashini Integration (Optional)](#step-6--verify-bhashini-integration-optional)
- [Service Endpoints](#service-endpoints)
- [Local Development Without Docker](#local-development-without-docker)
- [Resource Limits](#resource-limits)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Minimum Version | Purpose | Install |
|---|---|---|---|
| **Docker Desktop** | 24.0+ | Container orchestration for all services | [docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.20+ (bundled with Desktop) | Multi-container stack definition | Included with Docker Desktop |
| **Git** | 2.40+ | Version control | [git-scm.com](https://git-scm.com/) |
| **Node.js** | 20 LTS | Command-center build & field-worker-app | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.12+ | Backend local development | [python.org](https://www.python.org/) |
| **Expo CLI** | 50+ | Field-worker mobile app development | `npm install -g expo-cli` |

> **Note:** Node.js, Python, and Expo CLI are only required for local development without Docker. The Docker workflow requires only Docker and Git.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/emmanuelmj/civix.git
cd civix
```

---

## Step 2 — Configure Environment Variables

Copy the template and fill in your credentials:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude Sonnet API key for priority scoring and verification agents | `sk-ant-api03-...` |
| `GOOGLE_AI_API_KEY` | Gemini Flash API key for lightweight classification tasks | `AIza...` |
| `PINECONE_API_KEY` | Pinecone vector database API key | `pcsk_...` |
| `PINECONE_ENVIRONMENT` | Pinecone cloud region | `us-east-1` |
| `PINECONE_INDEX_NAME` | Name of the Pinecone index for grievance embeddings | `civix-grievances` |

### Database & Cache

| Variable | Description | Example |
|---|---|---|
| `POSTGRES_HOST` | PostgreSQL + PostGIS hostname | `postgres` (Docker) / `localhost` (local) |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `civix_pulse` |
| `POSTGRES_USER` | Database user | `civix` |
| `POSTGRES_PASSWORD` | Database password | `<strong-password>` |
| `REDIS_URL` | Redis connection string for pub/sub and caching | `redis://redis:6379/0` |

### Authentication & Security

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Secret key for signing JWT tokens | `<random-256-bit-hex>` |

### Bhashini (Optional — Indic Language Support)

| Variable | Description | Example |
|---|---|---|
| `BHASHINI_USER_ID` | Bhashini platform user ID | `user-...` |
| `BHASHINI_API_KEY` | Bhashini API key for speech-to-text and translation | `bh-...` |
| `BHASHINI_PIPELINE_ID` | Bhashini pipeline identifier | `pipe-...` |

### Service Configuration

| Variable | Description | Example |
|---|---|---|
| `N8N_BASIC_AUTH_USER` | n8n web UI username | `admin` |
| `N8N_BASIC_AUTH_PASSWORD` | n8n web UI password | `<strong-password>` |
| `FASTAPI_PORT` | Backend API port | `8000` |
| `NEXTJS_PORT` | Command-center dashboard port | `3000` |

> **Security:** Never commit `.env` to version control. The `.gitignore` already excludes it.

---

## Step 3 — Build and Start Services

```bash
docker compose up --build
```

| Metric | Duration |
|---|---|
| First build (cold cache) | ~5 minutes |
| Subsequent builds (warm cache) | ~15 seconds |

Docker Compose starts all services in the correct order with health checks. Wait for all services to report `healthy` before proceeding.

Expected console output when ready:

```
✔ Container civix-postgres   Healthy
✔ Container civix-redis      Healthy
✔ Container civix-backend    Started
✔ Container civix-n8n        Started
✔ Container civix-dashboard  Started
```

To run in detached mode:

```bash
docker compose up --build -d
docker compose logs -f          # Follow logs in a separate terminal
```

---

## Step 4 — Seed the Database

Populate the spatial database with 20 dummy field officers (with randomised PostGIS coordinates):

```bash
docker compose exec backend python -m database.seed
```

Expected output:

```
Seeded 20 field officers into the spatial database.
```

This creates officer records with GPS positions, department assignments, and availability status. The spatial agent uses these records to match grievances to the nearest available officer.

---

## Step 5 — Verify the Pipeline

Send a test grievance through the full analysis pipeline:

```bash
curl -X POST http://localhost:8000/api/v1/trigger-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Water supply has been disrupted for 3 days in Sector 14, Gurugram. Multiple households affected.",
    "source": "web_form",
    "location": {
      "lat": 28.4595,
      "lng": 77.0266
    }
  }'
```

A successful response indicates the swarm pipeline executed end-to-end:

```json
{
  "event_id": "evt_...",
  "status": "dispatched",
  "priority_score": 8.5,
  "cluster_id": "cls_...",
  "assigned_officer": {
    "id": "ofc_...",
    "name": "Officer Name",
    "distance_km": 2.3
  },
  "trace": [
    { "agent": "cluster_agent", "duration_ms": 320 },
    { "agent": "priority_agent", "duration_ms": 580 },
    { "agent": "spatial_agent", "duration_ms": 150 }
  ]
}
```

---

## Step 6 — Verify Bhashini Integration (Optional)

If you configured the Bhashini environment variables, test Indic language processing:

```bash
curl -X POST http://localhost:8000/api/v1/trigger-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "text": "पिछले 3 दिनों से सेक्टर 14 में पानी की सप्लाई बंद है।",
    "source": "whatsapp",
    "language": "hi",
    "location": {
      "lat": 28.4595,
      "lng": 77.0266
    }
  }'
```

The pipeline will auto-detect Hindi, translate via Bhashini, then proceed through the standard analysis flow. The response includes the translated text alongside the original.

---

## Service Endpoints

Once all containers are running, the following endpoints are available:

| Service | URL | Description |
|---|---|---|
| **Command Center** | [http://localhost:3000](http://localhost:3000) | Enterprise dashboard — real-time monitoring |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI REST API |
| **API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger UI (auto-generated) |
| **API Redoc** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Alternative API documentation |
| **n8n Workflows** | [http://localhost:5678](http://localhost:5678) | n8n workflow editor (ingestion pipelines) |
| **WebSocket** | `ws://localhost:8000/ws` | Real-time event stream |

---

## Local Development Without Docker

For faster iteration on individual modules, run services directly on your machine.

### Backend (Dev 1)

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> **Prerequisite:** PostgreSQL + PostGIS and Redis must be running locally or via Docker:
> ```bash
> docker compose up postgres redis -d
> ```

### Command Center (Dev 3)

```bash
cd command-center

npm install
npm run dev
```

The dashboard starts at [http://localhost:3000](http://localhost:3000) with hot module replacement enabled.

### Field Worker App (Dev 4)

```bash
cd field-worker-app

npm install
npx expo start
```

Scan the QR code with Expo Go on a physical device, or press `w` to open the web preview. For Android emulator, press `a`; for iOS simulator, press `i`.

### n8n Workflows (Dev 2)

For local n8n development, start the n8n container in isolation:

```bash
docker compose up n8n -d
```

Access the workflow editor at [http://localhost:5678](http://localhost:5678) and import workflows from `omnichannel-intake/n8n-workflows/`.

---

## Resource Limits

The system is optimised to run on constrained hardware (Dell Vostro 15 3000: 8 GB RAM, 4-core CPU, 256 GB SSD). The Docker Compose file enforces the following per-container limits to keep total footprint under **~5 GB RAM**:

| Container | RAM Limit | CPU Limit | Notes |
|---|---|---|---|
| `civix-postgres` | 1024 MB | 1.0 core | PostGIS + spatial indexes |
| `civix-redis` | 256 MB | 0.5 core | Pub/sub + ephemeral cache |
| `civix-backend` | 1536 MB | 1.5 cores | FastAPI + swarm agents (LLM calls are external) |
| `civix-n8n` | 512 MB | 0.5 core | Workflow engine |
| `civix-dashboard` | 512 MB | 0.5 core | Next.js SSR |
| **Total** | **~3.8 GB** | **4.0 cores** | Leaves ~1.2 GB headroom for OS + Docker daemon |

> **Tip:** If you experience out-of-memory errors, stop unused containers with `docker compose stop <service>` and run only the modules you are actively developing.

---

## Troubleshooting

### Port Conflicts

If a port is already in use, identify and stop the conflicting process:

```bash
# Linux / macOS
lsof -i :8000
kill -9 <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

Alternatively, change the port in `.env` (e.g. `FASTAPI_PORT=8001`) and restart:

```bash
docker compose down && docker compose up --build -d
```

### Docker Memory Errors

If containers are killed with `OOMKilled`:

1. Increase Docker Desktop memory allocation: **Settings → Resources → Memory → 6 GB minimum**.
2. Prune unused images and volumes:
   ```bash
   docker system prune -af
   docker volume prune -f
   ```

### Database Connection Refused

If the backend cannot connect to PostgreSQL:

1. Verify the database container is healthy:
   ```bash
   docker compose ps postgres
   ```
2. Ensure `POSTGRES_HOST` in `.env` matches the Docker service name (`postgres` inside Docker, `localhost` outside).
3. Check that the database has been initialised:
   ```bash
   docker compose exec postgres psql -U civix -d civix_pulse -c "\dt"
   ```

### Redis Connection Refused

Verify Redis is running and reachable:

```bash
docker compose exec redis redis-cli ping
# Expected: PONG
```

### Full Reset

To tear down all containers, volumes, and rebuild from scratch:

```bash
docker compose down -v          # Remove containers + volumes (deletes all data)
docker compose up --build       # Fresh build
```

Then re-run [Step 4 — Seed the Database](#step-4--seed-the-database).

### n8n Workflow Import Fails

If n8n cannot import workflow JSON files:

1. Ensure the n8n container has access to the `omnichannel-intake/n8n-workflows/` directory (check volume mounts in `docker-compose.yml`).
2. Manually import via the n8n UI: **Settings → Import from File → select JSON**.

---

## Next Steps

Once the stack is running:

1. Open the [Command Center](http://localhost:3000) to view the dashboard.
2. Send test grievances via the [API Docs](http://localhost:8000/docs) or the `curl` command in Step 5.
3. Open the [n8n Editor](http://localhost:5678) to inspect and modify ingestion workflows.
4. Review the [`API_SPEC.md`](./API_SPEC.md) for the full endpoint contract.
5. Read [`AGENT_SWARM.md`](./AGENT_SWARM.md) for details on the multi-agent pipeline design.
