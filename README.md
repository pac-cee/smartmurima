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
| Backend | Django 4.2 · Django REST Framework · JWT |
| Database | PostgreSQL (latest) + pgvector · pgAdmin |
| AI Assistant | Ollama (qwen2.5:0.5b, ~400MB) + RAG over pgvector |
| ML | scikit-learn / XGBoost (irrigation, fertilizer, yield) · MobileNetV2 CNN (disease) |
| IoT | ESP32 → HTTPS JSON → `/api/v1/iot/` (no broker) |
| Infra | Docker Compose |

Design language: **green + white + black only**, agriculture-forward. See `docs/DESIGN_SYSTEM.md`.

## Layout
```
smartmurima/
├── docker-compose.yml       # db, pgadmin, ollama, backend, frontend (+ simulator)
├── .env.example
├── docs/                    # DESIGN_SYSTEM.md, API_CONTRACT.md
├── prompts/                 # FRONTEND_PROMPT.md, BACKEND_PROMPT.md  (build prompts)
├── infra/                   # db init (pgvector), pgadmin server
├── firmware/                # ESP32 field-node firmware (agrimind_smart_farm)
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
service pulls the two small models (~0.7GB total) in the background — the
assistant works as soon as they finish and degrades gracefully until then.
`sm_ollama_init` showing **"Exited (0)"** is success: it is a job, not a server.

Seed the assistant's knowledge base (RAB/MINAGRI docs) once the models are in:
```bash
docker compose exec backend python manage.py seed_knowledge
```

To stream simulated IoT telemetry for the seeded nodes (`SM-NODE-01`/`SM-NODE-02`):
```bash
docker compose --profile iot up -d simulator
docker compose logs -f simulator   # posts every SIM_INTERVAL seconds
```
The simulator is a real HTTP client of `/api/v1/iot/telemetry/` — the same
endpoint the ESP32 firmware uses — so a demo with no hardware exercises exactly
the same code path as one with hardware. See `docs/IOT_INTEGRATION.md`.

### URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/v1 |
| Django admin | http://localhost:8000/admin |
| API docs (Swagger) | http://localhost:8000/api/docs |
| pgAdmin | http://localhost:5050 |
| Ollama | http://localhost:11434 |
| IoT device API | http://localhost:8000/api/v1/iot/ |

### Dev credentials
| Where | Username / email | Password |
|---|---|---|
| Django admin | `admin` | `admin12345` |
| Demo farmer (app login) | `farmer@smartmurima.rw` | `farmer12345` |

## How the pieces talk

```
Browser (Next.js :3000)  ──REST + JWT──▶  Django API (:8000)  ──▶  PostgreSQL + pgvector
                                                │
ESP32 / simulator  ──POST /api/v1/iot/──────────┤   (announce + telemetry; command block back)
                                                │
                                                └──▶  Ollama (:11434)  — RAG assistant
```

**Sign-in is one step.** `POST /auth/register` creates an active account and
returns a JWT pair immediately — there is no OTP or verification screen. The
only one-time code left in the system is the password-reset code, which the dev
console gateway prints to the backend logs.

**Administration is the Django admin** (`/admin`), not a bespoke UI: users,
farms, fields, devices, readings, alerts, recommendations, disease reports and
knowledge documents are all managed there. Any user with `role=admin` is granted
staff access automatically, so promoting someone in the admin is all it takes.

## Verifying it end to end

```bash
docker compose exec backend python -m pytest -q        # backend suite
docker compose exec frontend npx tsc --noEmit          # frontend typecheck
curl -s localhost:8000/health                          # API liveness
docker compose exec backend python manage.py simulate_devices --once
```
