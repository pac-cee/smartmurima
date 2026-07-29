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
cp .env.example .env
docker compose up --build
# then, one-time, pull the models into Ollama:
docker exec sm_ollama ollama pull llama3.1:8b
docker exec sm_ollama ollama pull nomic-embed-text
docker exec sm_backend python manage.py seed_knowledge
docker exec sm_backend python manage.py seed_demo
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API + Swagger | http://localhost:8000/api/docs |
| pgAdmin | http://localhost:5050 |
| Ollama | http://localhost:11434 |
| MQTT | mqtt://localhost:1883 |
