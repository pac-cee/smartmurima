# SmartMurima — Software Requirements Specification (SRS)

**Document type:** IEEE-830-style Software Requirements Specification
**System:** SmartMurima — AI-Driven Precision Agriculture Platform
**Case study:** Smallholder farmers and cooperatives, Bugesera District, Eastern Province, Rwanda
**Author (source dissertation):** Tumusime Frank (2201000003), University of Kigali, 2026
**Version:** 1.0 · **Status:** Baselined against `USE_CASES.md`, `TRACEABILITY_MATRIX.md`, `API_CONTRACT.md`, `DESIGN_SYSTEM.md`

> This SRS is the requirements baseline for SmartMurima. It is consistent with, and traces to, the
> use-case catalogue (`USE_CASES.md`), the requirements traceability matrix (`TRACEABILITY_MATRIX.md`),
> the API contract (`API_CONTRACT.md`), the design system (`DESIGN_SYSTEM.md`), and the source
> dissertation (Chapters 1–4). Requirement identifiers (FR-01…FR-10, NFR-1…NFR-8) and use-case
> identifiers (UC-01…UC-30) are shared verbatim across all of these documents.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements of **SmartMurima**, an
AI-driven precision agriculture platform. It is intended for the project supervisor and examiners,
the backend and frontend implementation teams, testers, and future maintainers. It defines *what*
the system must do and the qualities it must exhibit, and it establishes the traceable baseline
against which the platform is designed, built, and evaluated.

### 1.2 Scope
SmartMurima is a single, accessible, offline-resilient web platform that unites real-time IoT
sensing, machine-learning recommendations, CNN-based crop-disease detection, and a locally served
(Ollama) Retrieval-Augmented Generation (RAG) assistant grounded in trusted RAB/MINAGRI agronomic
documents. The system:

- captures soil-moisture, temperature, humidity, and rainfall telemetry from ESP32 sensor nodes
  over MQTT and persists it against the correct farm and field;
- generates irrigation, fertilizer, and yield recommendations from sensor, crop, and weather features
  using Random Forest / XGBoost models;
- detects common crop diseases from leaf photographs using a MobileNetV2 convolutional neural network;
- answers natural-language agronomic questions (Kinyarwanda / English) with a grounded RAG assistant
  that always attaches source references and never answers ungrounded;
- presents monitoring dashboards, alerts, and exportable reports to farmers, cooperatives, and
  extension officers; and
- provides administration of users, roles, the sensor-node registry, and the RAG knowledge corpus.

**Out of scope** (per dissertation §1.6.3): financial services (credit/insurance), market linkage and
produce-sales facilitation, and control of autonomous agricultural machinery or robotics.

**Objective (business goals):** improve resource-use efficiency (water, fertilizer), raise and
stabilise yields, enable early disease detection, and extend scarce extension services through
data-driven, localized decision support in a semi-arid, climate-vulnerable farming environment.

### 1.3 Definitions, Acronyms, and Abbreviations
(Abbreviation list drawn from the dissertation "List of Abbreviations".)

| Abbreviation | Meaning |
|---|---|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| CNN | Convolutional Neural Network |
| CV | Computer Vision |
| DFD | Data Flow Diagram |
| DBMS | Database Management System |
| DRF | Django REST Framework |
| ERD | Entity Relationship Diagram |
| GDP | Gross Domestic Product |
| GDD | Growing-Degree-Days (derived feature) |
| GPS | Global Positioning System |
| ICT | Information and Communication Technology |
| IoT | Internet of Things |
| JSON | JavaScript Object Notation |
| JWT | JSON Web Token |
| LLM | Large Language Model |
| LoRA | Low-Rank Adaptation |
| MCU | Microcontroller Unit |
| MINAGRI | Ministry of Agriculture and Animal Resources |
| ML | Machine Learning |
| MQTT | Message Queuing Telemetry Transport |
| NDVI | Normalized Difference Vegetation Index |
| NISR | National Institute of Statistics of Rwanda |
| NPK | Nitrogen, Phosphorus, and Potassium |
| ORM | Object-Relational Mapping |
| OTP | One-Time Password |
| RAB | Rwanda Agriculture and Animal Resources Development Board |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| RF | Random Forest |
| SDG | Sustainable Development Goal |
| SMS | Short Message Service |
| SRS | Software Requirements Specification |
| SSE | Server-Sent Events |
| TLS | Transport Layer Security |
| UI | User Interface |
| UoK | University of Kigali |
| UX | User Experience |

### 1.4 References
- `docs/USE_CASES.md` — Use-case catalogue and workflow specification (UC-01…UC-30).
- `docs/TRACEABILITY_MATRIX.md` — Requirement → Use Case → Endpoint → UI → Test traceability.
- `docs/API_CONTRACT.md` — REST API contract (v1).
- `docs/DESIGN_SYSTEM.md` — Visual/UX design system (green/white/black identity).
- `docs/diagrams/*` — UML, ERD, DFD, and behavioural diagrams (Mermaid).
- `prompts/BACKEND_PROMPT.md`, `prompts/FRONTEND_PROMPT.md` — build specifications.
- Source dissertation: *SmartMurima: Design and Implementation of an AI-Driven Precision
  Agriculture Platform* (Tumusime Frank, University of Kigali, 2026), Chapters 1–4.

### 1.5 Overview
Section 2 gives the overall description (product perspective, functions, users, environment,
constraints, assumptions). Section 3 specifies each system feature (FR-01…FR-10 plus the derived
yield, weather, and extension features) with stimulus/response and functional requirements,
cross-referencing use cases. Section 4 specifies external interfaces. Section 5 specifies the
non-functional requirements. Section 6 summarises the data requirements.

---

## 2. Overall Description

### 2.1 Product Perspective
SmartMurima is a new, self-contained, containerised product rather than a component of a larger
system. It follows a **layered, service-oriented architecture** (dissertation §4.5.1) in which
loosely coupled components communicate over well-defined interfaces:

- **IoT sensing layer** — ESP32 nodes reading soil moisture (capacitive), temperature/humidity
  (DHT22), and optional rainfall, publishing JSON telemetry over MQTT.
- **Messaging & ingestion layer** — Eclipse Mosquitto MQTT broker decoupling intermittently
  connected nodes from the backend, plus an ingestion worker that validates, deduplicates, and
  persists readings.
- **Application layer** — Django + Django REST Framework backend implementing domain logic, auth,
  RBAC, and the REST API, structured as strict per-app layers (views → services → repositories → models).
- **Presentation layer** — Next.js 14 web frontend communicating with the backend exclusively over
  REST, styled to the green/white/black design system.
- **Intelligence layer** — an ML service (RF/XGBoost for irrigation/fertilizer/yield; MobileNetV2
  CNN for disease) and an AI Assistant service (RAG over a pgvector store + Llama 3.1 8B on Ollama).
- **Data layer** — PostgreSQL with the pgvector extension, storing relational data and document
  embeddings.
- **External weather API** — proxied and cached by the backend and fed into the recommendation models.
- **Nginx** — reverse proxy and TLS termination fronting the frontend and backend.

The component and deployment relationships are specified in `docs/diagrams/component.md` and
`docs/diagrams/deployment.md`.

### 2.2 Product Functions
At a high level the system provides:

1. Registration, OTP verification, login (optional OTP 2FA), password reset, profile/language
   management, and token refresh/logout with RBAC (FR-01).
2. MQTT sensor-data capture, validation, deduplication, and persistence (FR-02).
3. Monitoring dashboards and per-field detail with live readings, trends, alerts, and history (FR-03).
4. Irrigation recommendations from ML models with confidence and provenance (FR-04).
5. Fertilizer recommendations (FR-05).
6. Yield forecasts (derived).
7. CNN crop-disease detection from leaf images with confidence and treatment guidance (FR-06).
8. Grounded RAG conversational assistant with source references, streamed responses (FR-07).
9. Alerts and notifications with cooldown and scoping (FR-08).
10. Report generation and PDF/CSV export (FR-09).
11. Administration of users/roles, sensor-node registry, and knowledge corpus (FR-10).
12. Weather forecast integration (derived) and extension oversight (derived).

### 2.3 User Classes and Characteristics
Four **human actors** and three **system actors** (with an external SMS gateway), per `USE_CASES.md`:

**Human actors**

| Actor | Characteristics | Typical use cases |
|---|---|---|
| **Farmer** (primary) | Smallholder; may have low digital literacy; prefers Kinyarwanda; owns farms/fields; uses phone/tablet under intermittent connectivity. | UC-01–06, UC-07/08/10, UC-12/13, UC-14–19, UC-20/21, UC-22/23 |
| **Cooperative Admin / Agronomist** | Manages farms, fields, and nodes for cooperative members; oversees member activity. | Farmer use cases on behalf of members, UC-09/25, UC-28 |
| **Extension Officer** | Reviews dashboards/reports across supported farmers; validates guidance; reviews disease reports (object-level scoped). | UC-12/13, UC-23, UC-27, UC-28 |
| **System Administrator** | Manages users/roles, the sensor-node registry, and the RAG knowledge corpus. | UC-24, UC-25, UC-26, UC-30 |

**System / external actors**

| Actor | Type | Role |
|---|---|---|
| **IoT Sensor Node** | System (ESP32) | Publishes telemetry over MQTT (UC-11). |
| **AI Engine** | System | ML models, CNN, and RAG/LLM producing intelligent outputs (UC-14–16, UC-18, UC-20). |
| **Weather API** | External | Supplies cached forecasts to recommendation logic (UC-29). |
| **SMS Gateway** | External | Delivers OTP codes; console backend in development (UC-01/02). |

### 2.4 Operating Environment
The system is deployed with **Docker Compose** (project `smartmurima`) comprising the services
`db` (pgvector/pgvector:pg17), `pgadmin`, `ollama`, `mqtt` (eclipse-mosquitto:2), `backend`
(Django + Gunicorn), `ingestion` (MQTT worker `run_ingestion`), and `frontend` (Next.js).

| Concern | Environment |
|---|---|
| Server | 8-core CPU, 32 GB RAM, 512 GB SSD, NVIDIA GPU (≈8 GB VRAM) for LLM/CNN inference; Ubuntu Server 22.04 LTS |
| Backend runtime | Python 3.11, Django 4.2, DRF 3.14, Gunicorn (3 workers) |
| Frontend runtime | Node 20, Next.js 14, React 18 |
| Database | PostgreSQL 15+/pg17 + pgvector |
| LLM runtime | Ollama serving Llama 3.1 8B; nomic-embed-text embeddings |
| Messaging | Eclipse Mosquitto 2.x (ports 1883 / 9001) |
| Reverse proxy | Nginx 1.24 (TLS termination) |
| Field devices | ESP32-WROOM-32 + capacitive soil-moisture v1.2 + DHT22 (+ optional rain sensor); Wi-Fi via site gateway/4G-LTE uplink |
| Client devices | Smartphones, tablets, computers via modern web browser |

### 2.5 Design and Implementation Constraints
- **Layered clean architecture is mandatory:** dependencies point inward
  (views → services → repositories → models); no business logic or ORM access in views (BACKEND_PROMPT).
- **Fixed technology stack:** Django/DRF, PostgreSQL+pgvector, JWT+OTP, Ollama (Llama 3.1 8B) +
  nomic-embed-text, Mosquitto/paho-mqtt, scikit-learn/XGBoost, TF/Keras CNN, Next.js/Tailwind/shadcn.
- **Design identity:** only three hues — green, white, black; semantic states expressed through green
  shades/black/opacity, never new hues (`DESIGN_SYSTEM.md`).
- **All data models normalised to 3NF** with BIGSERIAL surrogate primary keys.
- **Local-first AI:** the LLM is served locally (privacy, cost, offline resilience); farmer data stays
  within the platform (BR-AS2).
- **Graceful degradation is required, not optional:** ML/CNN artifacts absent → deterministic stubs;
  RAG with no context → "I don't know"; ingestion drop-and-log; weather-optional.
- **API versioning:** all endpoints under `/api/v1`; OpenAPI schema at `/api/schema`, Swagger at `/api/docs`.
- **Internationalisation:** Kinyarwanda default (`rw`) with English (`en`) toggle across UI and assistant.

### 2.6 Assumptions and Dependencies
- Rural connectivity is **intermittent**; the MQTT broker buffers messages during backend downtime and
  the ingestion worker drains them on reconnect, so no readings are lost (NFR-6).
- Clients cache recent data and reconnect SSE streams so the UI remains usable offline/degraded.
- The external weather provider may be unavailable or lack an API key; recommendations must still
  proceed without the forecast feature, flagging reduced confidence (UC-29 E1).
- The Ollama runtime and the embedding/LLM models must be pulled and available for the assistant;
  their absence yields graceful `503` responses (UC-20 E3/E4).
- ML/CNN model artifacts may be absent (e.g., in early builds); safe heuristic stubs guarantee the API
  always responds, flagged accordingly.
- Only telemetry from **registered** `device_id`s is persisted; unknown devices are quarantined.
- OTP delivery in development is a console backend (printed code); a pluggable SMS provider is used in
  production.

---

## 3. System Features

Each feature below states a **description**, **stimulus/response sequences**, and enumerated
**functional requirements**, cross-referencing the realising use cases. Endpoints are per
`API_CONTRACT.md` (base `/api/v1`).

### 3.1 FR-01 — Registration, Authentication, RBAC, and Profiles
**Use cases:** UC-01, UC-02, UC-03, UC-04, UC-05, UC-06.
**Description:** Farmers, cooperative admins, extension officers, and administrators register, verify
by OTP, log in securely (optional OTP 2FA), reset passwords, manage profiles/language, and refresh or
revoke tokens, all under role-based access control.

**Stimulus/response:**
- *Stimulus:* user submits registration form → *Response:* inactive `User` created; hashed OTP
  (purpose `register`, TTL from env) generated and sent; UI advances to Verify OTP.
- *Stimulus:* user submits 6-digit code → *Response:* on valid code the account is activated and JWT
  access+refresh tokens are issued; on wrong/expired/consumed code, a scoped error is returned and
  attempts are tracked, locking after max attempts.
- *Stimulus:* login with identifier+password → *Response:* JWTs issued, or an OTP 2FA step is triggered.

**Functional requirements:**
- FR-01.1 The system shall create an inactive user on registration and shall not authenticate the
  account until it is OTP-verified (BR-A2). Duplicate email/phone → `409 already_exists` with no OTP sent.
- FR-01.2 OTP codes shall be 6-digit, stored **hashed**, purpose-scoped (`register|login|reset`),
  single-use, TTL-bounded, rate-limited (max attempts + resend cooldown), and compared in constant time.
- FR-01.3 Successful verification for `register`/`login` shall activate the account and issue JWT
  access + refresh tokens with refresh rotation.
- FR-01.4 Login shall never enumerate users (generic `401 invalid_credentials`); inactive accounts →
  `403 not_verified` with resend offer; repeated failures → `429`.
- FR-01.5 Password reset shall be OTP-based and shall respond generically to unknown identifiers
  (no enumeration).
- FR-01.6 Users shall view/update `full_name, phone_number, language(rw/en)` and change password with
  the current password; a phone change re-triggers OTP verification of the new number.
- FR-01.7 The system shall support silent access-token refresh and logout with refresh rotation/blacklist.
- FR-01.8 Every endpoint shall enforce RBAC over roles `farmer | coop_admin | extension | admin`, with
  object-level ownership checks where applicable.

**Endpoints:** `/auth/register`, `/auth/otp/verify`, `/auth/otp/resend`, `/auth/login`,
`/auth/token/refresh`, `/auth/password/reset/request|confirm`, `/auth/me`.
**UI:** `/register`, `/verify-otp`, `/login`, `/forgot-password`, `/settings`.

### 3.2 FR-02 — Sensor Data Capture (MQTT → DB)
**Use cases:** UC-11.
**Description:** The system receives soil-moisture, temperature, humidity, and rainfall readings from
IoT nodes via MQTT and persists them against the correct field and farm.

**Stimulus/response:**
- *Stimulus:* node publishes JSON `{device_id, soil_moisture, temperature, humidity, rainfall}` to
  `smartmurima/<id>/telemetry` → *Response:* the ingestion worker parses, validates, deduplicates on
  `(device_id, timestamp)`, persists a `SensorReading` against the mapped field, updates node
  `last_seen`/battery, and evaluates the low-moisture alert rule.

**Functional requirements:**
- FR-02.1 The ingestion worker (`run_ingestion`, paho-mqtt) shall subscribe to the configured topic and
  persist valid readings via `SensorReadingRepository`; ingestion is internal, not a public HTTP POST.
- FR-02.2 Telemetry shall be persisted **only** for registered `device_id`s; unknown devices shall be
  quarantined, logged, and shall raise a `system` alert to the admin.
- FR-02.3 Malformed JSON or physically implausible values (e.g., negative moisture, temperature outside
  DHT22 range) shall be dropped and logged without crashing the worker.
- FR-02.4 Duplicate `(device_id, timestamp)` readings shall be skipped silently.
- FR-02.5 Stored readings shall be immutable; long data gaps shall be flagged so dependent
  recommendations can be suppressed (BR-S3).
- FR-02.6 During backend downtime the broker shall buffer messages; the worker shall drain them on
  reconnect with no data loss.

**Endpoints:** `run_ingestion` worker; read via `GET /sensor-readings`.

### 3.3 FR-03 — Monitoring Dashboard and Field Detail
**Use cases:** UC-12, UC-13.
**Description:** The dashboard visualises current and historical readings, KPI stats, trend charts,
active recommendations, alerts, and recent disease reports for the active farm/field context; the
field-detail view shows per-field gauges and history.

**Stimulus/response:**
- *Stimulus:* user opens the dashboard → *Response:* latest per-field readings, KPI tiles, trend series,
  active recommendations, alerts, and recent disease reports are loaded for the active context.
- *Stimulus:* user selects a range (24h/7d/30d) → *Response:* aggregated series are re-queried.

**Functional requirements:**
- FR-03.1 The system shall provide latest-per-field readings and aggregated series
  (`agg=hourly|daily`) with pagination and range selection.
- FR-03.2 The dashboard shall display KPI stats (soil moisture, temperature, humidity, active alerts),
  a sensor trend chart, a recommendations feed, an alerts view, and a disease-reports strip.
- FR-03.3 When readings are stale or the node is offline, the UI shall show an offline state with
  `last_seen`; with no data yet, an EmptyState onboarding shall be shown.
- FR-03.4 The field-detail view shall show per-field gauges (soil/temp/humidity), historical charts,
  and recommendation + disease history filtered by field.

**Endpoints:** `GET /sensor-readings/latest`, `GET /sensor-readings?...&agg=`, `GET /recommendations`,
`GET /alerts`, `GET /diseases/reports`.
**UI:** `/dashboard`, `/fields/[id]`.

### 3.4 FR-04 — Irrigation Recommendation
**Use cases:** UC-14.
**Description:** The system generates an irrigation decision (`no_action | moderate | urgent`) and a
recommended water amount with confidence, from sensor, crop/stage, and weather features.

**Stimulus/response:**
- *Stimulus:* farmer selects a field and requests an irrigation recommendation → *Response:* the service
  builds features (rolling 3/7-day soil-moisture average, GDD, days-since-irrigation, forecast rain),
  runs `IrrigationClassifier`, persists a `Recommendation`, raises a `low_moisture` alert if critical,
  and displays the result.

**Functional requirements:**
- FR-04.1 The service shall assemble features via `FeatureBuilder` from latest + rolling readings,
  crop type/stage, and the cached weather forecast.
- FR-04.2 `IrrigationClassifier` shall return a decision label and a confidence in [0,1].
- FR-04.3 Every recommendation shall be persisted with `type=irrigation`, decision, value (mm), unit,
  confidence, and details/provenance (BR-R1).
- FR-04.4 If model artifacts are missing, a deterministic heuristic stub shall be used and flagged
  `details.stub=true`; the API shall never fail for this reason.
- FR-04.5 If readings are stale/missing, the service shall fall back to most-recent valid data and flag
  the limitation, or suppress with an "insufficient recent data" message when the gap is too large
  (BR-R2 / BR-S3).
- FR-04.6 If the weather API is down, the service shall proceed without the forecast feature and note
  reduced confidence.
- FR-04.7 If soil moisture is critically low, a `low_moisture` alert shall be raised (→ FR-08).

**Endpoints:** `POST /recommendations/irrigation`, `GET /recommendations?type=irrigation`.
**UI:** `/recommendations`, field detail.

### 3.5 FR-05 — Fertilizer Recommendation
**Use cases:** UC-15.
**Description:** The system recommends fertilizer type and quantity from crop, growth stage, and field
condition.

**Functional requirements:**
- FR-05.1 The service shall build features from crop, growth stage, and field/soil condition and run
  `FertilizerRecommender` to produce type + quantity + confidence.
- FR-05.2 The recommendation shall be persisted (`type=fertilizer`) with confidence and provenance and
  displayed.
- FR-05.3 Stub fallback and missing-data flagging shall behave as in FR-04.

**Endpoints:** `POST /recommendations/fertilizer`.
**UI:** `/recommendations`.

### 3.6 (Derived) — Yield Forecast
**Use cases:** UC-16.
**Description:** The system forecasts expected harvest (t/ha) with confidence from cumulative GDD,
seasonal soil-moisture statistics, fertilizer history, and planting date.

**Functional requirements:**
- FR-Y.1 The service shall run `YieldRegressor` and persist a `Recommendation` (`type=yield`) with the
  estimate, unit, and confidence.
- FR-Y.2 Mid-season with sparse history shall yield a wide interval / low confidence, flagged.

**Endpoints:** `POST /recommendations/yield`.
**UI:** `/recommendations`, `/reports`.

### 3.7 FR-06 — Crop-Disease Detection
**Use cases:** UC-18, UC-19.
**Description:** A farmer uploads a leaf photo; a MobileNetV2 CNN returns a probable disease class,
confidence, and management guidance; reports are stored and reviewable.

**Stimulus/response:**
- *Stimulus:* farmer uploads/captures a leaf photo → *Response:* the service validates and pre-processes
  the image, runs `DiseaseClassifier`, and (if confidence ≥ threshold) persists a `DiseaseReport` with
  disease, confidence, `is_healthy`, treatment, and image, then displays the diagnosis and treatment.

**Functional requirements:**
- FR-06.1 The system shall validate image format/size/quality and pre-process (resize/normalise) before
  inference; invalid/blurry images shall be rejected and re-prompted with no report saved.
- FR-06.2 On confidence ≥ threshold the report shall be persisted and treatment guidance displayed; a
  healthy leaf shall set `is_healthy=true` with a reassuring message.
- FR-06.3 On confidence < threshold the result shall be presented as unreliable (never definitive,
  BR-D2), advise a clearer image or an extension officer, and save the report flagged `low_confidence`
  for review.
- FR-06.4 If CNN artifacts are missing, a stub classifier shall be used, flagged.
- FR-06.5 Disease images shall be stored in media with access control (BR-D1); reports shall be visible
  to the farmer and to extension/coop reviewers (UC-28).

**Endpoints:** `POST /diseases/detect` (multipart), `GET /diseases/reports?field=`.
**UI:** `/diseases`, field detail.

### 3.8 FR-07 — AI Assistant (Grounded RAG)
**Use cases:** UC-20, UC-21.
**Description:** A conversational assistant answers natural-language agronomic questions (rw/en),
grounded by RAG over the RAB/MINAGRI corpus, streaming responses and attaching source references.

**Stimulus/response:**
- *Stimulus:* user submits a question in a chat session → *Response:* the assistant embeds the question
  (nomic-embed-text), retrieves top-k chunks from pgvector, builds a grounded prompt, generates an
  answer via Llama 3.1 8B (streamed over SSE), and persists user+assistant `ChatMessage`s with source
  references.

**Functional requirements:**
- FR-07.1 The system shall embed the question and perform a pgvector cosine-similarity search for the
  top-k knowledge chunks.
- FR-07.2 The prompt shall instruct the model to answer **only** from the retrieved context and to say
  it does not know otherwise; the assistant shall never answer ungrounded (BR-AS1).
- FR-07.3 When context is used, the response shall include source references (title/ref/snippet) shown
  as source chips.
- FR-07.4 Responses shall be streamable over SSE (`/assistant/chat/stream`).
- FR-07.5 Empty questions → `400 question_required`; no relevant context → an explicit "I don't know"
  with a suggestion to contact extension (no hallucination); Ollama unreachable → `503
  assistant_unavailable`; embedding model missing → `503` with a clear ops message.
- FR-07.6 Detected language shall route the system prompt and answer language (rw/en); farmer data shall
  remain local (BR-AS2).
- FR-07.7 Users shall list sessions, open a session's messages, and start new sessions.

**Endpoints:** `POST /assistant/chat`, `POST /assistant/chat/stream`, `GET/POST /assistant/sessions`,
`GET /assistant/sessions/{id}/messages`.
**UI:** `/assistant`.

### 3.9 FR-08 — Alerts and Notifications
**Use cases:** UC-22.
**Description:** System rules raise alerts (`low_moisture | disease_risk | weather | system`); users see
a bell badge, open the center, and mark alerts read.

**Functional requirements:**
- FR-08.1 The alert-rules engine shall raise typed, severity-ordered alerts scoped to the owning/served
  users (BR-AL2).
- FR-08.2 A per-(field, type) cooldown shall suppress duplicate alerts within the cooldown window
  (BR-AL1).
- FR-08.3 Users shall list unread alerts and mark alerts read; critical alerts may optionally be
  delivered by SMS.

**Endpoints:** `GET /alerts?unread=true`, `POST /alerts/{id}/read`.
**UI:** `/alerts`, TopBar bell.

### 3.10 FR-09 — Reports and Export
**Use cases:** UC-23.
**Description:** Users choose a farm and period and receive aggregated sensor trends, recommendations
issued, disease reports, and yield estimates, viewable and exportable as PDF/CSV.

**Functional requirements:**
- FR-09.1 The report service shall aggregate sensor trends, recommendations, disease reports, and yield
  estimates over the selected farm and period.
- FR-09.2 Reports shall be exportable as PDF and CSV; an empty range shall show an EmptyState; export
  failure shall surface a retryable error.

**Endpoints:** `GET /reports/summary?farm=&from=&to=`, `GET /reports/export?format=pdf|csv`.
**UI:** `/reports`.

### 3.11 FR-10 — User and Content Administration
**Use cases:** UC-24, UC-25, UC-26.
**Description:** The administrator manages user accounts and roles, the sensor-node registry, and the
RAG knowledge documents.

**Functional requirements:**
- FR-10.1 The admin shall list/create/update/deactivate users and assign roles; the last admin cannot be
  removed and self-deactivation is blocked; destructive actions are audit-logged (BR-ADM1).
- FR-10.2 The admin (and coop admin) shall manage the sensor-node registry with unique `device_id`
  (duplicate → `409`).
- FR-10.3 The admin shall upload/edit RAB/MINAGRI documents that are chunked and re-embedded into
  pgvector; only embedded documents are retrievable and provenance is retained for source chips
  (BR-ADM2). If the embedding service is down, documents are queued and marked `pending`.

**Endpoints:** `/admin-api/users`, `/admin-api/sensor-nodes`, `/admin-api/documents`,
`/assistant/documents`; `seed_knowledge` command.
**UI:** `/admin`.

### 3.12 Supporting Features — Farm/Field/Node Management, Weather, Extension, API Docs
- **Farm & field management (UC-07, UC-08, UC-09, UC-10):** create/manage `Farm` (name, sector,
  latitude, longitude, area_hectares), `Field` (farm, name, crop, planting_date, growth_stage,
  area_hectares), `Crop` catalogue, and `SensorNode` (field, device_id, status). Business rules:
  a field belongs to exactly one farm (BR-F2); one active crop per field (BR-F3); telemetry only for
  registered nodes (BR-F4); field area may not exceed farm area. Endpoints: `/farms*`, `/fields`,
  `/crops`, `/sensor-nodes*`. UI: `/farms`, `/farms/[id]`, `/fields/[id]`, TopBar switcher.
- **(Derived) Weather integration (UC-29):** the backend proxies and caches per-farm forecasts feeding
  UC-14/15/16 and weather alerts; provider down → proceed with a degraded-confidence note. Endpoint:
  `GET /weather/forecast?farm=`.
- **(Derived) Extension oversight (UC-27, UC-28):** extension officers view scoped dashboards/reports
  and review flagged/low-confidence disease reports for the farmers they support (object-level
  permission, BR-EX1).
- **API documentation (UC-30):** live OpenAPI schema at `/api/schema` and Swagger UI at `/api/docs`.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
The UI conforms to `docs/DESIGN_SYSTEM.md`:
- **Identity:** green + white + black only; semantic states via green shades/black/opacity; no other hues.
- **App shell:** fixed left sidebar (`--green-800`, collapsible to a 72px icon rail) + white top bar
  (hairline border) with the farm/field switcher, `rw/en` language toggle, alerts bell with unread
  count, theme toggle, and user menu. Mobile: sidebar → bottom tab bar.
- **Low digital literacy:** big touch targets (≥44px), icons + plain-language labels, charts over dense
  text, Kinyarwanda default with English toggle.
- **Components:** StatTile, SensorGauge, SensorTrendChart (green ramp), RecommendationCard (confidence
  bar), DiseaseUploadCard, AssistantChat (farmer bubbles `--green-50`, assistant white bordered, source
  chips, streaming), AlertItem, OtpInput (6-cell), LanguageToggle, DataTable, EmptyState, Skeletons.
- **Accessibility:** WCAG AA contrast, full keyboard navigation, visible focus, ARIA on interactive
  widgets, alt text on imagery, `prefers-reduced-motion` respected.
- **Routes:** the App-Router routes listed per feature in §3 and in `FRONTEND_PROMPT.md`.

### 4.2 Hardware Interfaces
- **ESP32-WROOM-32** sensor node (Wi-Fi, 3.3 V, battery/solar) running firmware that samples sensors and
  publishes MQTT telemetry.
- **Capacitive soil-moisture sensor** (v1.2, 3.3–5 V, corrosion-resistant) — volumetric water content.
- **DHT22** temperature/humidity sensor (−40…80 °C ±0.5 °C; 0–100 % RH ±2 %).
- **Optional rain sensor** (resistive, digital + analog).
- **Site gateway/router** (Wi-Fi with 4G/LTE uplink) providing internet connectivity for nodes and users.
- Telemetry payload: JSON `{device_id, soil_moisture, temperature, humidity, rainfall}` on topic
  `smartmurima/<device_id>/telemetry`.

### 4.3 Software Interfaces
- **Ollama** (`http://ollama:11434`) — chat completion with `llama3.1:8b`; embeddings with
  `nomic-embed-text` (768-dim vectors).
- **PostgreSQL + pgvector** — relational persistence and vector similarity search (cosine `<=>`) over
  `KnowledgeDocument.embedding VECTOR(768)` with an HNSW/IVF index.
- **Weather API** (external) — forecast provider proxied and cached by the backend; optional (degrades
  gracefully when absent).
- **MQTT broker** (Eclipse Mosquitto, `mqtt://mqtt:1883`) — publish/subscribe telemetry transport.
- **SMS Gateway** — OTP delivery; console backend in development, pluggable provider in production.
- **drf-spectacular** — OpenAPI schema and Swagger UI.

### 4.4 Communications Interfaces
- **HTTPS/REST** — frontend ↔ backend over `/api/v1`, JSON payloads, JWT `Authorization: Bearer`,
  paginated list envelope `{count, next, previous, results}`, ISO-8601 timestamps, error envelope
  `{detail, code, errors}`; TLS terminated at Nginx.
- **MQTT** — ESP32 nodes → Mosquitto → ingestion worker (QoS/retained per broker config); broker buffers
  during outages.
- **SSE (Server-Sent Events)** — streamed assistant responses via `/assistant/chat/stream`, with client
  reconnect.
- **CORS** — configured for the Next.js origin.

---

## 5. Non-functional Requirements
(Mirrors `TRACEABILITY_MATRIX.md` §B; dissertation §4.3.2.)

| NFR | Requirement | Mechanism | Verified by |
|---|---|---|---|
| **NFR-1 Performance** | Typical page interactions < 3 s; sensor readings ingested in near real time. | Query indexes (e.g., `(node, recorded_at)`), pagination, TanStack Query cache, MQTT streaming. | Load test T-P1; ingestion latency T-P2. |
| **NFR-2 Scalability** | Accommodate growing farmers/cooperatives/nodes/readings without redesign. | Service-oriented, containerised, stateless API, horizontally scalable ingestion/ML services. | Architecture review; docker scale test. |
| **NFR-3 Security** | Authenticated, role-based access; TLS in transit; hashed credentials; validated inputs; protection against common web vulnerabilities. | JWT + refresh rotation, hashed single-use OTP, role + object-level permissions, DRF validators, Nginx TLS. | T-A6 (401), T-A7 (RBAC 403), security review. |
| **NFR-4 Usability** | Simple, visual, intuitive for low digital literacy. | Design system, `rw` default, icons + plain language, ≥44px targets, charts over text. | Acceptance sessions AT-1…AT-5. |
| **NFR-5 Reliability** | Handle sensor dropouts, malformed messages, and model failures gracefully. | ML/CNN stubs, RAG "don't know", ingest drop-and-log, global exception handler. | T-R (stub), T-AS2, T-S (bad payload). |
| **NFR-6 Availability / offline** | Usable under intermittent connectivity; no reading loss during transient outages. | Broker buffering + replay, client caching, SSE reconnect. | T-S (broker replay). |
| **NFR-7 Maintainability** | Modular, documented, containerised; services independently updatable. | Layered per-app architecture, Dockerfiles, OpenAPI at `/api/docs`. | Code review; `/api/docs`. |
| **NFR-8 Localization** | Kinyarwanda + English throughout UI and assistant. | next-intl, `language` field, RAG language routing. | T-AS (language), UI i18n test. |

Coverage gates (per `TRACEABILITY_MATRIX.md` §E): CI target ≥ 80 % line coverage on
`apps/*/services.py` and `apps/*/repositories.py`; every FR must have ≥ 1 passing test; every exception
flow (E1/E2/…) should have a corresponding negative test.

---

## 6. Data Requirements
Summarises the dissertation ERD (§4.5.9), the normalization discussion (§4.5.8, 3NF), and the data
dictionary (§4.5.10). The full ERD is in `docs/diagrams/erd.md`; the domain class model is in
`docs/diagrams/class.md`.

### 6.1 Entities and Relationships (3NF, BIGSERIAL surrogate keys)
- **User** 1—1 **Farmer**; **Farmer** 1—* **Farm**; **Farm** 1—* **Field**; **Field** *—1 **Crop**
  (active crop assignment); **Field** 1—* **SensorNode**; **SensorNode** 1—* **SensorReading**.
- **WeatherRecord** associated with **Farm** by location.
- **Field** 1—* **Recommendation** and 1—* **DiseaseReport** (intelligent outputs per field).
- **User** 1—* **ChatSession**; **ChatSession** 1—* **ChatMessage**; **KnowledgeDocument** is the RAG
  corpus (with pgvector embedding). **User** 1—* **Alert**. **User** 1—* **OtpCode**.

### 6.2 Key Data Dictionary Tables (from dissertation §4.5.10)

**users**

| Field | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PRIMARY KEY |
| username | VARCHAR(150) | NOT NULL, UNIQUE |
| email | VARCHAR(254) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(128) | NOT NULL |
| full_name | VARCHAR(150) | NOT NULL |
| phone_number | VARCHAR(20) | NULL |
| role | VARCHAR(20) | NOT NULL, CHECK (farmer/coop_admin/extension/admin) |
| language | VARCHAR(5) | NOT NULL, DEFAULT 'rw' |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() |

**farms**

| Field | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PRIMARY KEY |
| farmer_id | BIGINT | NOT NULL, FK → farmers(id) |
| name | VARCHAR(120) | NOT NULL |
| sector | VARCHAR(80) | NOT NULL |
| latitude | DECIMAL(9,6) | NULL |
| longitude | DECIMAL(9,6) | NULL |
| area_hectares | DECIMAL(6,2) | NOT NULL, DEFAULT 0 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() |

**sensor_readings**

| Field | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PRIMARY KEY |
| sensor_node_id | BIGINT | NOT NULL, FK → sensor_nodes(id) |
| soil_moisture | DECIMAL(5,2) | NOT NULL |
| temperature | DECIMAL(4,1) | NULL |
| humidity | DECIMAL(4,1) | NULL |
| rainfall | DECIMAL(5,2) | NULL |
| recorded_at | TIMESTAMP | NOT NULL, DEFAULT now() |

*Indexed on `(sensor_node_id, recorded_at)`; readings are immutable and deduplicated on
`(device_id, timestamp)` at ingestion.*

**recommendations**

| Field | Type | Constraints |
|---|---|---|
| id | BIGSERIAL | PRIMARY KEY |
| field_id | BIGINT | NOT NULL, FK → fields(id) |
| type | VARCHAR(20) | NOT NULL, CHECK (irrigation/fertilizer/yield) |
| decision | VARCHAR(30) | NOT NULL |
| value | DECIMAL(8,2) | NULL |
| confidence | DECIMAL(4,3) | NULL (0–1) |
| details | TEXT | NULL |
| created_at | TIMESTAMP | NOT NULL, DEFAULT now() |

### 6.3 Other Persistent Entities (per BACKEND_PROMPT data model)
- **OtpCode**(user/identifier, code_hash, purpose∈{register,login,reset}, expires_at, consumed_at,
  attempts).
- **Field**(farm FK, crop FK, name, planting_date, growth_stage, area_hectares).
- **Crop**(name, base_temp, season).
- **SensorNode**(field FK, device_id UNIQUE, status, battery, last_seen).
- **WeatherRecord**(farm FK by location, forecast/observed attributes).
- **DiseaseReport**(field FK, image, disease, confidence, is_healthy, treatment, created_at).
- **ChatSession**(user FK, title, created_at) 1—* **ChatMessage**(session FK, role∈{user,assistant},
  content, sources JSON, created_at).
- **KnowledgeDocument**(title, source, content, chunk_index, `embedding VECTOR(768)`) with HNSW/IVF
  index.
- **Alert**(user FK, type∈{low_moisture,disease_risk,weather,system}, message, severity, is_read,
  created_at).

### 6.4 Data Integrity Rules
- 3NF throughout; single-column BIGSERIAL surrogate keys avoid partial/transitive dependencies.
- Sensor readings are immutable once stored; implausible values are rejected at ingestion.
- Every AI output (recommendation, disease report) carries a confidence and provenance.
- OTP codes are hashed, single-use, TTL-bounded, and rate-limited.
- Referential integrity enforced by foreign keys; deletes respect ownership and RBAC.
</content>
