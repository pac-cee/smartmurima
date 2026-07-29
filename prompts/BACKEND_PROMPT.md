# SmartMurima — Backend Build Prompt

> Paste into a fresh session (or hand to a backend agent) to build the SmartMurima API + AI services.

## Role
You are a senior backend engineer. Build the **SmartMurima** backend — the API and AI services
for an AI-driven precision agriculture platform for smallholder farmers in Bugesera District, Rwanda.

## Stack (non-negotiable)
- **Python 3.11**, **Django 4.2** + **Django REST Framework 3.14**.
- **PostgreSQL (latest) + pgvector** for relational data and RAG embeddings.
- **JWT** auth (`djangorestframework-simplejwt`), **OTP** for verification/2FA/reset.
- **Ollama** (Llama 3.1 8B) for the RAG assistant; **nomic-embed-text** embeddings.
- **Eclipse Mosquitto (MQTT)** ingestion via `paho-mqtt`.
- ML: `scikit-learn` + `xgboost` (irrigation/fertilizer/yield), CNN inference (TF/Keras) — served
  as internal inference services with loadable artifacts + safe stubs when artifacts absent.
- **Docker** containerized. `drf-spectacular` for OpenAPI/Swagger.

## Architecture — STRICT separation of concerns
Layered, per-app clean architecture. Every domain app has these layers, and dependencies point
inward (views → services → repositories → models). **No business logic in views; no ORM in views.**

```
backend/
  config/                     # settings (split: base/dev/prod), urls, wsgi, asgi, celery(optional)
  core/                       # cross-cutting
    repositories/base.py      # BaseRepository (generic CRUD over a model)
    services/base.py          # BaseService
    permissions.py            # role-based DRF permissions
    pagination.py, exceptions.py, responses.py, mixins.py
  apps/
    accounts/                 # User (custom), roles, OTP, auth
      models.py               # User, OtpCode
      repositories.py         # UserRepository, OtpRepository
      services.py             # AuthService, OtpService (generate/verify/throttle), SmsGateway
      serializers.py          # Register/Login/Otp/Profile serializers
      views.py                # controllers = DRF views/viewsets (thin)
      urls.py
      permissions.py
    farms/                    # Farm, Field, Crop, SensorNode  (+ repos/services/serializers/views/urls)
    sensors/                  # SensorReading (+ repo/service), ingestion command
    recommendations/          # Recommendation + ML inference services
    diseases/                 # DiseaseReport + CNN inference service
    assistant/                # ChatSession, ChatMessage, KnowledgeDocument(+embedding), RAG service
    alerts/                   # Alert/Notification + rules engine
    reports/                  # aggregation + export (pdf/csv)
    weather/                  # external weather API client (cached)
  ml/                         # model loading + inference wrappers (rf/xgb/cnn), artifacts/ dir
  rag/                        # chunking, embeddings, pgvector store, retriever, prompt builder
  iot/                        # mqtt subscriber (management command run_ingestion)
  manage.py, requirements.txt, Dockerfile, .dockerignore
```

### Layer responsibilities (apply to every app)
- **model.py** — Django ORM entities only (fields, constraints, `Meta`, `__str__`). No logic.
- **serializers.py** — DRF (de)serialization + input validation. Map to/from service DTOs.
- **repositories.py** — the ONLY place that touches the ORM/queryset. Extend `BaseRepository`.
  Methods like `get_by_id`, `list_for_user`, `create`, `filter_by_field`.
- **services.py** — business logic, orchestration, transactions. Calls repositories + ml/rag/iot.
  Raises domain exceptions. Fully unit-testable without HTTP.
- **views.py** — thin **controllers**: parse request → call service → serialize → respond.
  Handle auth/permissions/pagination only. No queries, no business rules here.
- **urls.py** — router registration per app; included under `/api/v1/` in `config/urls.py`.

## Data model — from the dissertation ERD/data dictionary
Implement exactly (PostgreSQL types via Django fields), BIGSERIAL surrogate PKs, 3NF:
- **User**(username,email,password_hash,full_name,phone_number,role∈{farmer,coop_admin,extension,admin},
  language∈{rw,en} default rw,is_active,created_at) — custom user model.
- **OtpCode**(user/identifier, code_hash, purpose∈{register,login,reset}, expires_at, consumed_at, attempts).
- **Farmer**(user 1-1), **Farm**(farmer FK,name,sector,latitude,longitude,area_hectares,created_at),
  **Field**(farm FK,crop FK,name,planting_date,growth_stage,area_hectares),
  **Crop**(name,base_temp,season), **SensorNode**(field FK,device_id,status,battery,last_seen).
- **SensorReading**(sensor_node FK,soil_moisture,temperature,humidity,rainfall,recorded_at) — indexed on (node,recorded_at).
- **WeatherRecord**(farm FK by location,...), **Recommendation**(field FK,type∈{irrigation,fertilizer,yield},
  decision,value,unit,confidence 0..1,details,created_at).
- **DiseaseReport**(field FK,image,disease,confidence,is_healthy,treatment,created_at).
- **ChatSession**(user FK,title,created_at) 1-many **ChatMessage**(session FK,role∈{user,assistant},content,sources JSON,created_at).
- **KnowledgeDocument**(title,source,content,chunk_index, `embedding VECTOR(768)` via pgvector), HNSW/IVF index.
- **Alert**(user FK,type∈{low_moisture,disease_risk,weather,system},message,severity,is_read,created_at).

Match the data dictionary constraints (NOT NULL, UNIQUE, CHECK, defaults, `now()`), normalized to 3NF.

## OTP subsystem (do it well)
`OtpService`: generate N-digit code (env `OTP_LENGTH`), store **hashed** with TTL (`OTP_TTL_SECONDS`),
purpose-scoped, rate-limited (max attempts + resend cooldown), single-use (`consumed_at`).
`SmsGateway` interface with a console backend for dev (prints code) and a pluggable provider for prod.
Endpoints per `docs/API_CONTRACT.md` `/auth/*`. Verification activates the account and issues JWTs.

## RAG assistant (`rag/` + `apps/assistant`)
- Ingest RAB/MINAGRI docs → chunk (overlap) → embed via Ollama `nomic-embed-text` → store in
  `KnowledgeDocument.embedding` (pgvector).
- `Retriever.similarity_search(query, k)` using `<=>` cosine distance (pgvector).
- `PromptBuilder`: "answer ONLY from context, else say you don't know", inject retrieved chunks +
  detect language (rw/en). `AssistantService.answer(question, session, language)` → calls Ollama
  `/api/chat` with `LLM_MODEL`, persists ChatMessages, returns `{answer, sources[]}`.
- Provide a `seed_knowledge` management command and an SSE streaming endpoint `/assistant/chat/stream`.
- **Grounding is the point**: never answer ungrounded; always return source references.

## ML services (`ml/` + `apps/recommendations`, `apps/diseases`)
- `IrrigationClassifier`, `YieldRegressor` (RF/XGBoost), `FertilizerRecommender`,
  `DiseaseClassifier` (MobileNetV2/Keras). Load artifacts from `ml/artifacts/`; if missing, use a
  deterministic heuristic stub so the API always responds (log a warning). Feature engineering
  (rolling soil-moisture 3/7-day avg, GDD, days-since-irrigation) in a `FeatureBuilder`.
- `RecommendationService.irrigation(field)`: pull latest readings (repo) + weather → features →
  model → persist Recommendation → maybe raise Alert if critical.

## IoT ingestion (`iot/` + `apps/sensors`)
`run_ingestion` management command: `paho-mqtt` subscriber on `MQTT_TOPIC`, parse JSON payload,
validate, dedupe on (device_id, timestamp), persist via `SensorReadingRepository`, update node
`last_seen`, evaluate low-moisture alert rule. Decoupled from web process (own container).

## Cross-cutting
- Settings split (base/dev/prod), env via `django-environ`, `DATABASE_URL`.
- JWT with refresh; role-based permissions (`IsFarmer`, `IsCoopAdmin`, `IsExtension`, `IsAdmin`,
  object-level `IsOwnerOrCoop`). Rate limiting/throttling on auth + OTP.
- `drf-spectacular` schema at `/api/schema` + Swagger UI at `/api/docs`.
- Structured logging, global exception handler → consistent `{detail,code,errors}`.
- CORS for the Next.js origin. `collectstatic`, media handling for disease images.
- Seed/fixtures + factory data (`seed_demo`) so the whole system demos end-to-end.

## Testing
`pytest` + `pytest-django`. Unit-test services/repositories in isolation (mock ml/rag/ollama).
Cover the sample cases from the dissertation (UT-01..06, IT-01..05): create/validate SensorReading,
reject missing `soil_moisture`, rolling-average feature, irrigation prediction shape, assistant
empty-question 400, JWT-protected 401, MQTT→DB, RAG→Ollama path.

## Deliverables
A runnable `backend/` with: all apps in the strict layered layout, custom User + OTP auth, every
endpoint in `docs/API_CONTRACT.md`, pgvector RAG wired to Ollama, ML inference services (with stubs),
MQTT ingestion command, Swagger docs, migrations, seed commands, tests, and a `Dockerfile`.
It must `docker compose up` cleanly with the provided `docker-compose.yml`.
