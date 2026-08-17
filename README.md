# 🌱 SmartMurima

An AI-driven **precision agriculture platform** for smallholder farmers and cooperatives in
Bugesera District, Rwanda. It unites real-time IoT sensing, machine-learning recommendations,
CNN crop-disease detection, and a locally served (Ollama) RAG assistant grounded in RAB/MINAGRI
agronomic documents — in a single, accessible, offline-resilient web platform.

Based on the dissertation *"SmartMurima: Design and Implementation of an AI-Driven Precision
Agriculture Platform"* by Tumusime Frank (University of Kigali, 2026).

## Architecture
| Layer | Tech |
|---|---|
| Frontend | Next.js 14 · TypeScript · Tailwind · shadcn/ui |
| Backend | Django 4.2 · Django REST Framework · JWT + OTP |
| Database | PostgreSQL (latest) + pgvector · pgAdmin |
| AI Assistant | Ollama (Llama 3.1 8B) + RAG over pgvector |
| ML | scikit-learn / XGBoost (irrigation, fertilizer, yield) · MobileNetV2 CNN (disease) |
| IoT | ESP32 → MQTT (Mosquitto) → ingestion worker |
| Infra | Docker Compose |

Design language: **green + white + black only**, agriculture-forward. See `docs/DESIGN_SYSTEM.md`.

## Layout
```
smartmurima/
├── docker-compose.yml       # db, pgadmin, ollama, mqtt, backend, ingestion, frontend
├── .env.example
├── docs/                    # DESIGN_SYSTEM.md, API_CONTRACT.md
├── prompts/                 # FRONTEND_PROMPT.md, BACKEND_PROMPT.md  (build prompts)
├── infra/                   # mosquitto, db init (pgvector), pgadmin server
├── backend/                 # Django API + AI services (clean layered architecture)
└── frontend/                # Next.js client
```

## Quick start
```bash
cp .env.example .env          # first time only
docker compose up -d --build  # brings up the whole stack
```
On boot the `backend` service automatically runs migrations, creates the default
admin, and seeds the demo farmer/farm/fields/nodes. A one-shot `ollama-init`
service pulls the LLM + embedding models in the background — the assistant works
as soon as they finish (and degrades gracefully until then).

To stream simulated IoT telemetry for the seeded nodes (`SM-NODE-01`/`SM-NODE-02`):
```bash
docker compose --profile iot up -d --build simulator
docker compose logs -f simulator   # watch it publish every SIM_INTERVAL seconds
```

### URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/v1 |
| Django admin | http://localhost:8000/admin |
| API docs (Swagger) | http://localhost:8000/api/docs |
| pgAdmin | http://localhost:5050 |
| Ollama | http://localhost:11434 |
| MQTT | mqtt://localhost:1883 |

### Dev credentials
| Where | Username / email | Password |
|---|---|---|
| Django admin | `admin` | `admin12345` |
| Demo farmer (app login) | `farmer@smartmurima.rw` | `farmer12345` |
