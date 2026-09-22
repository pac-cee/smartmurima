# SmartMurima — Use Case Catalogue & Workflow Specification

This document specifies **every actor, every use case, and every workflow** end-to-end so that
no journey is left broken, no business rule is ambiguous, and every endpoint has a reason to
exist. Each use case lists preconditions, the main (happy-path) flow, **alternate and exception
flows**, postconditions, business rules, and the endpoint(s) + UI route(s) that realise it.
Cross-reference `API_CONTRACT.md`, `TRACEABILITY_MATRIX.md`, and the diagrams under `docs/diagrams/`.

## Actors

| Actor | Type | Description |
|---|---|---|
| **Farmer** | Human (primary) | Smallholder; owns farms/fields, receives recommendations, uploads leaf images, chats with the assistant. |
| **Cooperative Admin / Agronomist** | Human | Manages farms, fields, and nodes for cooperative members; oversees member activity. |
| **Extension Officer** | Human | Reviews dashboards/reports across supported farmers; validates guidance; reviews disease reports. |
| **System Administrator** | Human | Manages users/roles, sensor-node registry, and the RAG knowledge corpus. |
| **IoT Sensor Node** | System | ESP32 node; POSTs telemetry to `/api/v1/iot/telemetry/` and applies the pump command returned. |
| **AI Engine** | System | ML models, CNN, and RAG/LLM producing intelligent outputs. |
| **Weather API** | External | Supplies forecasts consumed by recommendation logic. |
| **SMS Gateway** | External | Delivers password-reset codes (console backend in dev). |

## Use case index (30 use cases across 8 domains)

| Domain | Use cases |
|---|---|
| Authentication & Identity | UC-01…UC-06 |
| Farm & Field Management | UC-07…UC-10 |
| Sensing & Monitoring | UC-11…UC-13 |
| Recommendations | UC-14…UC-17 |
| Disease Detection | UC-18…UC-19 |
| AI Assistant (RAG) | UC-20…UC-21 |
| Alerts & Reports | UC-22…UC-23 |
| Administration & Extension | UC-24…UC-30 |

---

## Domain 1 — Authentication & Identity

### UC-01 Register Account
- **Actors:** Farmer / Coop Admin / Extension (self-register); SMS Gateway (supporting).
- **Priority:** Must. **FR:** FR-01.
- **Preconditions:** User not already registered with the same email/phone.
- **Trigger:** User submits the registration form.
- **Main flow:**
  1. User submits `full_name, email, phone_number, password, role, language`.
  2. System validates uniqueness + password strength; creates an **inactive** `User`.
  3. `AuthService` creates an **active** farmer plus its `Farmer` profile (with the
     optional sector location) in one transaction.
  4. The response carries the user and a JWT pair; the UI goes straight to the dashboard.
- **Alternate flows:** A1 role defaults to `farmer` if omitted; A2 language defaults to `rw`.
- **Exception flows:** E1 email/phone already exists → `409` `{code: "conflict"}`, nothing created.
  E2 weak password → `400` with field errors.
- **Postconditions:** An active farmer account exists and the caller holds a valid session.
- **Business rules:** BR-A1 password ≥ 8 chars; BR-A2 account cannot authenticate until verified;
  BR-A3 self-registration always creates role=farmer; other roles are provisioned in the Django admin.
- **Endpoints:** `POST /auth/register` (single step; no verification round trip).
- **UI:** `/register` → `/dashboard`.

### UC-02 Reset a Forgotten Password
- **Actors:** Any user who cannot sign in.
- **Priority:** Must. **FR:** FR-01.
- **Preconditions:** An account exists for the identifier.
- **Main flow:**
  1. User requests a reset for their email/phone.
  2. `OtpService` issues a **hashed, TTL'd, single-use** code and delivers it via
     `SmsGateway` (dev: printed to the backend log and echoed as `dev_code`).
  3. User submits `identifier + code + new_password`.
  4. `OtpService` compares in constant time, checks TTL, purpose and attempt count;
     on success the code is consumed and the new password is set.
- **Exception flows:** E1 wrong code → increment attempts, `400`; after **max attempts** the
  code is invalidated and a new one must be requested (`429`). E2 expired → `400`, prompt
  resend. E3 already consumed → `400`. E4 resend inside the cooldown → `429`.
- **Postconditions:** Password changed; the code cannot be replayed.
- **Business rules:** BR-A4 single-use; BR-A5 max N attempts then invalidate; BR-A6 constant-time compare.
- **Endpoints:** `POST /auth/password/reset/request`, `POST /auth/password/reset/confirm`.
- **UI:** `/forgot-password` (6-cell code input, resend cooldown timer).

> **Design note.** Registration and login previously required an OTP round trip.
> That step was removed: it blocked sign-up behind an SMS gateway that is not
> provisioned in the pilot, and an unverifiable account is worse than an
> unverified one. One-time codes now exist only where they carry their weight —
> proving control of an identifier you are trying to *recover*.

### UC-03 Login
- **Priority:** Must. **FR:** FR-01.
- **Preconditions:** An active account.
- **Main flow:** 1. User submits `identifier + password` (username, email **or** phone).
  2. System authenticates against the hashed password. 3. JWT access + refresh are issued.
- **Exception flows:** E1 bad credentials → `400 {code:"validation_error"}` (generic, no user
  enumeration). E2 deactivated account → `400` explaining to contact an administrator.
  E3 throttle after repeated failures → `429` (scope `auth`, 20/min).
- **Postconditions:** Authenticated session (access+refresh held client-side, silent refresh on 401).
- **Endpoints:** `POST /auth/login`, `POST /auth/token/refresh`.

### UC-04 Reset Password (OTP)
- **Main flow:** request → OTP sent → confirm with `code + new_password`.
- **Exception flows:** E1 unknown identifier → respond `200` generically (no enumeration), no OTP if absent. E2 invalid/expired code → as UC-02.
- **Endpoints:** `POST /auth/password/reset/request`, `POST /auth/password/reset/confirm`.
- **UI:** `/forgot-password`.

### UC-05 Manage Profile & Language
- **Main flow:** view/update `full_name, phone_number, language(rw/en)`; change password (requires current).
- **Exception:** E1 phone change re-triggers OTP verification of the new number.
- **Endpoints:** `GET/PATCH /auth/me`. **UI:** `/settings`.

### UC-06 Refresh Token / Logout
- **Main flow:** access expiry → silent refresh; logout clears tokens + rotates/blacklists refresh.
- **Exception:** E1 refresh invalid/expired → force re-login (`401`).
- **Endpoints:** `POST /auth/token/refresh`. **UI:** global (interceptor).

---

## Domain 2 — Farm & Field Management

### UC-07 Register Farm
- **Actors:** Farmer, Coop Admin. **FR:** FR-01/derived.
- **Main flow:** create `name, sector, latitude, longitude, area_hectares`; linked to the owning farmer.
- **Exception:** E1 invalid coordinates/negative area → `400`. E2 coop admin creating on behalf → must specify member farmer they manage, else `403`.
- **Endpoints:** `GET/POST /farms`, `GET/PATCH/DELETE /farms/{id}`. **UI:** `/farms`, `/farms/[id]`.
- **Business rules:** BR-F1 a farmer owns ≥0 farms; only owner or managing coop admin may edit.

### UC-08 Manage Fields (assign crop & stage)
- **Main flow:** create/update `Field(farm, name, crop, planting_date, growth_stage, area_hectares)`.
- **Alternate:** A1 update growth stage over the season (drives recommendation features).
- **Exception:** E1 field area > farm area → `400`. E2 crop not in catalogue → `400`.
- **Endpoints:** `GET/POST /fields`, `GET /crops`. **UI:** `/farms/[id]`, `/fields/[id]`.
- **Business rules:** BR-F2 a field belongs to exactly one farm; BR-F3 one active crop per field.

### UC-09 Register / Manage Sensor Node
- **Actors:** Coop Admin, Admin.
- **Main flow:** register `SensorNode(field, device_id, status)`; `device_id` unique; drives ingestion mapping.
- **Exception:** E1 duplicate `device_id` → `409`. E2 unregistered `device_id` publishes telemetry → ingestion **quarantines/ignores** it and logs (see UC-11 E2).
- **Endpoints:** `GET/POST /sensor-nodes`, admin `/admin-api/sensor-nodes`. **UI:** `/farms/[id]`, `/admin`.
- **Business rules:** BR-F4 telemetry is only persisted for **registered** nodes; `last_seen` updated on each reading.

### UC-10 Switch Active Farm / Field (context)
- **Main flow:** top-bar switcher sets the active farm/field context for dashboard, recommendations, diseases.
- **Exception:** E1 user has no farms → dashboard shows onboarding EmptyState prompting UC-07.
- **UI:** TopBar `FarmFieldSwitcher` (client state).

---

## Domain 3 — Sensing & Monitoring

### UC-11 Ingest Sensor Data (IoT → System)
- **Actors:** IoT Sensor Node (primary), AI Engine (downstream). **FR:** FR-02.
- **Preconditions:** The node has been claimed to a field and holds its token (UC-09).
- **Main flow:**
  1. Node POSTs `{token, pump, readings:[{sensor_type, value, optimal_min, optimal_max}]}`
     to `/api/v1/iot/telemetry/`.
  2. The endpoint resolves the token to a `SensorNode` — the device authenticates
     itself; no user session is involved.
  3. Typed readings are flattened onto reading columns (moisture, temperature,
     humidity, rainfall, pH, EC, N, P, K). Unknown `sensor_type`s are ignored, never rejected.
  4. **Deduplicate** on `(sensor_node, recorded_at)`; persist `SensorReading` via the repository.
  5. Update node `last_seen`, battery and reported `pump_state`; evaluate the
     low-moisture alert rule (→ UC-22).
  6. Respond with the `{command}` block (pump mode/state + dry/wet thresholds) the device applies.
- **Alternate:** A1 backend unreachable → the device retries on its next interval;
  buffering lives on the device now that there is no broker.
- **Exception flows:** E1 malformed JSON / out-of-range moisture → `400`, log, do **not** crash.
  E2 unknown or revoked token → `403`; the board re-pairs automatically on its next announce.
  E3 device not claimed to a field → `403`. E4 duplicate → skip silently.
- **Postconditions:** Valid reading stored and queryable; node liveness and pump state updated.
- **Business rules:** BR-S1 readings immutable once stored; BR-S2 physically implausible
  values rejected; BR-S3 gaps flagged so dependent recommendations can be suppressed (see UC-14 E1).
- **Realisation:** `apps/sensors/iot_views.py` + `IngestionService`. A public HTTP
  endpoint authenticated by device token, exercised identically by the real
  firmware and by `manage.py simulate_devices`.

### UC-12 View Monitoring Dashboard
- **Actors:** Farmer, Coop Admin, Extension. **FR:** FR-03.
- **Main flow:** load latest per-field readings + KPI stats + trend charts + active recommendations + alerts + recent disease reports for the active context.
- **Alternate:** A1 range selector (24h/7d/30d) re-queries aggregated series. A2 auto-refresh/poll for near-real-time.
- **Exception:** E1 stale/no readings → show "sensor offline" state + `last_seen`. E2 no data yet → EmptyState.
- **Endpoints:** `GET /sensor-readings/latest`, `GET /sensor-readings?...&agg=`, `GET /recommendations`, `GET /alerts`, `GET /diseases/reports`. **UI:** `/dashboard`.

### UC-13 View Field Detail
- **Main flow:** per-field gauges (soil/temp/humidity), historical charts, recommendation + disease history for that field.
- **Endpoints:** as UC-12 filtered by `field`. **UI:** `/fields/[id]`.

---

## Domain 4 — Recommendations

### UC-14 Request Irrigation Recommendation
- **Actors:** Farmer (primary); AI Engine, IoT Node, Weather API (supporting). **FR:** FR-04.
- **Preconditions:** Authenticated; field has a node with **recent** readings.
- **Main flow:**
  1. Farmer selects a field and requests an irrigation recommendation.
  2. Service retrieves latest + rolling readings (repo), crop type/stage, and the weather forecast (UC-29).
  3. `FeatureBuilder` assembles features (rolling 3/7-day soil-moisture avg, GDD, days-since-irrigation, forecast rain).
  4. `IrrigationClassifier` predicts decision ∈ {no_action, moderate, urgent} + confidence.
  5. Service **persists** a `Recommendation(type=irrigation, decision, value(mm), unit, confidence, details)`.
  6. If soil moisture critically low → raise `low_moisture` alert (UC-22). Result displayed.
- **Alternate:** A1 model artifact missing → deterministic **heuristic stub** used, flagged `details.stub=true` (never fail).
- **Exception flows:** E1 readings **stale/missing** → fall back to most-recent valid data **and flag the limitation**, or suppress with a "insufficient recent data" message if gap too large (BR-S3). E2 no field/node → `400` prompting UC-09. E3 weather API down → proceed without forecast feature, note reduced confidence.
- **Postconditions:** Recommendation persisted + shown; alert raised if critical.
- **Business rules:** BR-R1 every recommendation is persisted with confidence + provenance; BR-R2 never issue on data older than the configured staleness bound without flagging.
- **Endpoints:** `POST /recommendations/irrigation`, `GET /recommendations?type=irrigation`. **UI:** `/recommendations`, field detail.

### UC-15 Request Fertilizer Recommendation
- **FR:** FR-05.
- **Main flow:** features from crop, growth stage, field/soil condition → `FertilizerRecommender` → type + quantity + confidence → persist + display.
- **Exception:** as UC-14 (stub fallback, missing data flag).
- **Endpoints:** `POST /recommendations/fertilizer`. **UI:** `/recommendations`.

### UC-16 Request / View Yield Forecast
- **FR:** derived (yield prediction).
- **Main flow:** features (cumulative GDD, seasonal soil-moisture stats, fertilizer history, planting date) → `YieldRegressor` → estimated t/ha + confidence → persist + display.
- **Exception:** E1 mid-season with sparse history → wide interval / low confidence, flagged.
- **Endpoints:** `POST /recommendations/yield`. **UI:** `/recommendations`, `/reports`.

### UC-17 View Recommendation History
- **Main flow:** list/filter recommendations by field/type/date with confidence bars.
- **Endpoints:** `GET /recommendations?...`. **UI:** `/recommendations`.

---

## Domain 5 — Disease Detection

### UC-18 Detect Crop Disease from Image
- **Actors:** Farmer (primary); AI Engine. **FR:** FR-06.
- **Preconditions:** Authenticated; a field selected.
- **Main flow:**
  1. Farmer uploads/captures a leaf photo.
  2. Service validates format/size/quality; pre-processes (resize/normalise).
  3. `DiseaseClassifier` (CNN) returns predicted class + confidence.
  4. **Confidence ≥ threshold:** persist `DiseaseReport` (disease, confidence, is_healthy, treatment, image), fetch management guidance, display diagnosis + treatment.
- **Alternate:** A1 healthy leaf → `is_healthy=true`, reassuring message. A2 model artifact missing → stub classifier, flagged.
- **Exception flows:** E1 invalid/blurry image → reject + re-prompt (no report saved). E2 **confidence < threshold** → advise unreliable result, recommend clearer image or extension officer; save report flagged `low_confidence` for review. E3 unsupported crop → generic guidance + suggest expert.
- **Postconditions:** Report stored for the field; visible to farmer + extension/coop for review (UC-28).
- **Business rules:** BR-D1 images stored in media with access control; BR-D2 low-confidence never presented as definitive.
- **Endpoints:** `POST /diseases/detect` (multipart). **UI:** `/diseases`.

### UC-19 View Disease Reports
- **Main flow:** history of reports per field with image thumbnails, disease, confidence, treatment.
- **Endpoints:** `GET /diseases/reports?field=`. **UI:** `/diseases`, field detail.

---

## Domain 6 — AI Assistant (RAG)

### UC-20 Ask AI Assistant (grounded RAG)
- **Actors:** Farmer/Extension (primary); AI Engine. **FR:** FR-07.
- **Preconditions:** Authenticated; knowledge corpus embedded (UC-26).
- **Main flow:**
  1. User submits a natural-language question (rw/en) in a chat session.
  2. `AssistantService` embeds the question (Ollama `nomic-embed-text`).
  3. pgvector similarity search retrieves top-k RAB/MINAGRI chunks.
  4. `PromptBuilder` builds a grounded prompt ("answer ONLY from context, else say you don't know").
  5. Ollama `llama3.1:8b` generates the answer; response **streamed** (SSE) to the UI.
  6. Persist `ChatMessage` (user + assistant) with **source references**; display answer + source chips.
- **Alternate:** A1 new session auto-created if none supplied. A2 detected language routes the system prompt/answer language.
- **Exception flows:** E1 empty question → `400 {code:"question_required"}`. E2 **no relevant context** found → assistant explicitly says it doesn't know and suggests contacting extension (no hallucination). E3 Ollama unreachable → `503 {code:"assistant_unavailable"}`, graceful UI message. E4 embedding model missing → `503` with clear ops message.
- **Postconditions:** Exchange persisted; answer grounded and attributable.
- **Business rules:** BR-AS1 **never answer ungrounded**; always attach sources when context used; BR-AS2 farmer data stays local (privacy).
- **Endpoints:** `POST /assistant/chat`, `POST /assistant/chat/stream` (SSE). **UI:** `/assistant`.

### UC-21 Manage Chat Sessions / History
- **Main flow:** list sessions, open a session's messages, start new session, (optional) delete.
- **Endpoints:** `GET/POST /assistant/sessions`, `GET /assistant/sessions/{id}/messages`. **UI:** `/assistant`.

---

## Domain 7 — Alerts & Reports

### UC-22 Receive & Manage Alerts
- **Actors:** All human users; AI Engine/rules (source). **FR:** FR-08.
- **Main flow:** system rules raise alerts (`low_moisture`, `disease_risk`, `weather`, `system`); user sees bell badge, opens center, marks read.
- **Alternate:** A1 severity ordering; A2 optional SMS delivery of critical alerts.
- **Exception:** E1 duplicate alert within cooldown suppressed (no spam).
- **Endpoints:** `GET /alerts?unread=`, `POST /alerts/{id}/read`. **UI:** `/alerts`, TopBar bell.
- **Business rules:** BR-AL1 alert cooldown per (field, type); BR-AL2 alerts scoped to the owning/served users.

### UC-23 Generate & Export Reports
- **Actors:** Farmer, Coop Admin, Extension. **FR:** FR-09.
- **Main flow:** choose farm + period → aggregate sensor trends, recommendations issued, disease reports, yield estimates → view + export PDF/CSV.
- **Exception:** E1 empty range → EmptyState; E2 export failure → retry with error toast.
- **Endpoints:** `GET /reports/summary`, `GET /reports/export?format=`. **UI:** `/reports`.

---

## Domain 8 — Administration & Extension

### UC-24 Manage Users & Roles
- **Actor:** System Admin. **FR:** FR-10.
- **Main flow:** list/create/update/deactivate users; assign roles.
- **Exception:** E1 cannot remove the last admin; E2 self-deactivation blocked.
- **Endpoints:** `/admin-api/users`. **UI:** `/admin`.
- **Business rules:** BR-ADM1 destructive actions audit-logged.

### UC-25 Manage Sensor-Node Registry
- **Actor:** System Admin, Coop Admin. See UC-09. **UI:** `/admin`.

### UC-26 Manage Knowledge Documents (RAG corpus)
- **Actor:** System Admin. **FR:** FR-10.
- **Main flow:** upload/edit RAB/MINAGRI documents → chunk → **re-embed** into pgvector → available to UC-20.
- **Exception:** E1 embedding service down → queue for re-embed, mark document `pending`.
- **Endpoints:** `GET/POST /assistant/documents`, `/admin-api/documents`; `seed_knowledge` command. **UI:** `/admin`.
- **Business rules:** BR-ADM2 only embedded docs are retrievable; provenance retained for source chips.

### UC-27 Extension: Review Farmers & Validate Guidance
- **Actor:** Extension Officer.
- **Main flow:** view dashboards/reports across supported farmers; annotate/validate recommendations.
- **Endpoints:** scoped `GET /reports/summary`, `GET /recommendations`, `GET /sensor-readings`. **UI:** `/dashboard`, `/reports`.
- **Business rules:** BR-EX1 extension sees only farmers they support (object-level permission).

### UC-28 Extension/Coop: Review Disease Reports
- **Main flow:** review flagged/low-confidence disease reports for supported/member farmers; advise.
- **Endpoints:** `GET /diseases/reports?...`. **UI:** `/diseases`.

### UC-29 Fetch Weather Forecast (system)
- **Actor:** Weather API (external), AI Engine.
- **Main flow:** backend proxies + caches forecast per farm location; feeds UC-14/15/16 and weather alerts.
- **Exception:** E1 provider down/absent key → recommendations proceed without forecast, degraded-confidence note.
- **Endpoints:** `GET /weather/forecast?farm=`. **UI:** dashboard weather widget.

### UC-30 View API Documentation (developer)
- **Actor:** Developer/Admin.
- **Main flow:** browse live OpenAPI schema + Swagger UI.
- **Endpoints:** `/api/schema`, `/api/docs`.

---

## Workflow integrity checklist (guards against broken journeys)
- ✅ Every use case has explicit **alternate + exception flows** (offline, stale data, model/LLM absent, low confidence, throttling).
- ✅ Every use case maps to at least one **endpoint** and (where user-facing) a **UI route** — see `TRACEABILITY_MATRIX.md`.
- ✅ **Degradation paths** defined so the system never hard-fails: ML/CNN stubs, RAG "I don't know", ingestion drop-and-log, weather-optional, broker buffering.
- ✅ **Security business rules**: OTP hashed/single-use/rate-limited; role + object-level permissions; no user enumeration.
- ✅ **Data-integrity rules**: dedup, immutable readings, implausible-value rejection, 3NF schema, confidence + provenance on every AI output.
- ✅ Each use case has corresponding **tests** (unit/integration/acceptance) in `TRACEABILITY_MATRIX.md`.
