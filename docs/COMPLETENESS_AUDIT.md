# SmartMurima — Backend Completeness Audit

Audits the backend against the dissertation requirements (Ch.4 §4.3 FR-01..10 + NFRs,
§2.3.2 feature list, §4.5) as traced through `API_CONTRACT.md`, `USE_CASES.md`, and
`TRACEABILITY_MATRIX.md`. This pass focused on four backend surfaces
(`weather`, `reports`, `alerts`, and the OTP SMS production path) and closed the gaps
found there. Verified with `python manage.py check` (clean, all external services absent).

> Source note: the plain-text dissertation export named in the task was not present on
> disk (`scratchpad/smartmurima.txt` absent; only the `.docx`/`.pdf` chapters exist).
> FR/feature definitions below are taken from the three in-repo specification documents,
> which restate §4.3 / §2.3.2 verbatim in their FR and use-case tables.

Legend: **Y** = implemented, **N** = absent, **Partial** = present but with a documented limitation.

---

## A. Functional requirements (FR-01..10 + derived)

| FR | Requirement | Impl | Where | Gaps I closed | Remaining notes |
|---|---|---|---|---|---|
| FR-01 | Registration, auth, RBAC, profiles, OTP | Y | `apps/accounts/{services,views,serializers,models}.py` | — (SMS prod path below) | Complete: hashed/single-use/TTL OTP, JWT + refresh, role + object perms. |
| FR-02 | Sensor capture (MQTT→DB) | Y | `apps/sensors/services.py`, `iot/`, `run_ingestion` cmd | Provided importable `evaluate_low_moisture` for the ingestion low-moisture rule | Ingestion is a worker, not HTTP (by design). Dedup/validation/quarantine present. |
| FR-03 | Monitoring dashboard data | Y | `apps/sensors` (`/sensor-readings*`), aggregation in repo | — | Latest-per-field + aggregated series present. |
| FR-04 | Irrigation recommendation | Partial | `apps/recommendations/services.py`, `ml/` | — (out of scope) | Real model loads from `ml/artifacts`; **heuristic stub** when artifact absent (flagged `details.stub`). Dataset/trained model needed for production accuracy. |
| FR-05 | Fertilizer recommendation | Partial | `apps/recommendations/services.py` | — | Same stub-fallback pattern as FR-04. |
| FR-06 | Crop-disease detection (CNN) | Partial | `apps/diseases/services.py` | — | Pipeline, persistence, low-confidence flagging, disease-risk alert all present. **Real CNN needs a trained model + dataset**; TensorFlow is commented out in `requirements.txt`, so it runs on a **stub classifier**. |
| FR-07 | AI assistant (RAG) | Partial | `apps/assistant/`, `rag/` | — | Full RAG pipeline (pgvector retrieval, grounded prompt, "I don't know", SSE). **LoRA/LLM is offline** (Ollama `llama3.1:8b` + `nomic-embed-text`); returns `503` when Ollama absent. |
| FR-08 | Alerts & notifications | Y | `apps/alerts/{services,repositories,views,urls}.py` | Added **per-(field,type) cooldown** (BR-AL1), `weather` + `system` rule methods, importable ingestion rule | `GET /alerts?unread=`, `POST /alerts/{id}/read`, RBAC scoping already present. Optional SMS delivery of critical alerts (UC-22 A2) not wired to the gateway yet — see notes. |
| FR-09 | Reports & export | Y | `apps/reports/{services,views,urls}.py` | Added **disease-report** + **yield** + per-type recommendation aggregation to `summary`; empty-range flag; header-safe CSV | Real PDF via `reportlab` (text fallback if absent); CSV via stdlib. |
| FR-10 | User & content administration | Y | `apps/accounts/admin_urls.py`, `apps/assistant` documents | — | `/admin-api/{users,sensor-nodes,documents}` + knowledge re-embed present. |
| derived | Yield forecast | Partial | `POST /recommendations/yield`, now surfaced in `/reports/summary` | Wired yield into report summary/PDF | Model stub-fallback like FR-04/05. |
| derived | Weather integration | Y | `apps/weather/{client,services,views}.py` | Live-vs-fallback **source signalling**, **last-known-good** preference before neutral, short-TTL cache, documented degradation, `source`/`stale` in response | Live path active when `WEATHER_API_URL` set; otherwise neutral estimate. Provider payload parsing is best-effort/generic. |
| derived | Extension oversight | Y | object-level perms in repos (`list_for_user`), scoped reports/weather | — | Extension/coop/admin see served farms; farmers see only their own. |
| derived | API documentation | Y | `config/urls.py` → `/api/schema`, `/api/docs` (drf-spectacular) | — | Live OpenAPI + Swagger UI. |

---

## B. §2.3.2 book feature list

| Feature | Impl | Where | Gaps I closed | Remaining notes |
|---|---|---|---|---|
| Real-time IoT monitoring | Y | `apps/sensors`, `iot/`, MQTT ingestion worker | — | Broker buffering + dedup + implausible-value rejection. |
| ML irrigation & fertilizer advisory | Partial | `apps/recommendations`, `ml/` | — | Deterministic **heuristic stubs** until trained artifacts are dropped in `ml/artifacts`. Never hard-fails. |
| CNN crop-disease detection | Partial | `apps/diseases`, `ml/` | — | **Real CNN needs dataset + trained model**; TensorFlow disabled in requirements → stub classifier, low-confidence flagged. |
| RAG assistant (RAB/MINAGRI grounded) | Partial | `apps/assistant`, `rag/` | — | Grounding + provenance + no-hallucination path complete; **LLM/embeddings are offline** (Ollama) and return `503` when the service is down. |
| Dashboards + alerts | Y | `apps/sensors` + `apps/alerts` | Alerts rules-engine hardening (cooldown, weather/system, ingestion hook) | Dashboard read endpoints + alert center + cooldown de-spam. |
| Offline / SMS access | Partial | `apps/accounts/services.py` (`SmsGateway`) | — | Pluggable HTTP SMS gateway present; **needs a real provider key** (`SMS_PROVIDER`/`SMS_API_KEY`/`SMS_SENDER_ID`). Dev falls back to console gateway. Broker buffering covers connectivity gaps. |

---

## C. Changes made in this pass

**Weather (`apps/weather/`)** — UC-29
- `client.py`: `fetch()` now returns `(items, source)` where `source ∈ {"live","neutral"}`;
  parsing no longer silently folds fallback into "live". Neutral items tagged
  `raw={"source":"neutral"}`. Documented fallback contract in the module docstring.
- `services.py`: serving strategy `cache → live → last_known → neutral`. When the external
  API is unset/unreachable, **prefers the last-known-good stored forecast** for upcoming
  dates before emitting a synthetic neutral outlook. Returns `{forecast, source, stale}`.
- `views.py`: passes `source`/`stale` through to the response.
- Cache TTL from `WEATHER_CACHE_SECONDS` (default 1800s).

**Reports (`apps/reports/services.py`)** — FR-09 / UC-23
- `summary()` now aggregates **disease reports** (total + unhealthy), **latest yield estimate**,
  and a **per-type recommendation** breakdown, alongside the existing sensor-trend aggregation.
  Date filters applied to recommendations/diseases too. Adds an `empty` flag for empty ranges.
- PDF (`reportlab`) and CSV (stdlib) render the enriched summary; CSV always emits its header
  row so an empty range is a valid header-only file, not an error.

**Alerts (`apps/alerts/`)** — FR-08 / UC-22
- `services.py`: added `_within_cooldown` + `_raise` implementing **per-(field,type) cooldown**
  (`ALERT_COOLDOWN_SECONDS`, default 3600s); `raise_low_moisture`/`raise_disease_risk` now
  cooldown-aware (return `Optional[Alert]`); added `raise_weather` and `raise_system` rules.
  Added module-level `evaluate_low_moisture(user, field, soil_moisture, threshold=None)` as the
  **importable ingestion entry point** (see note below).
- `repositories.py`: added `recent_of_type()` for DB-agnostic cooldown lookups (field scoping
  done in Python against `context`, avoiding JSON key lookups so it works on SQLite + Postgres).

> **Sensors integration note:** `apps/sensors` was **not modified** (out of scope). It already
> calls `AlertService().raise_low_moisture(...)`, which now inherits the cooldown automatically.
> To adopt the clean seam, `apps/sensors/services.py` can switch its `_evaluate_low_moisture`
> body to `from apps.alerts.services import evaluate_low_moisture; evaluate_low_moisture(owner, node.field, reading.soil_moisture)`.

**OTP SMS production path (`apps/accounts/services.py`)** — FR-01
- Already present and correct: `HttpSmsGateway` (generic HTTP POST, bearer auth) selected by
  `get_sms_gateway()` when `SMS_PROVIDER` is set, else `ConsoleSmsGateway` (dev). Driven by
  `SMS_PROVIDER`/`SMS_API_KEY`/`SMS_SENDER_ID`. OTP models/flow untouched. **No change needed.**

---

## D. Reverse endpoint trace (API_CONTRACT path → router)

Every path in `API_CONTRACT.md` resolves to a registered route. **No missing or orphan routes.**

| Contract path | In router? | Where |
|---|---|---|
| `POST /auth/register` | Y | `apps/accounts/urls.py` |
| `POST /auth/otp/verify` | Y | `apps/accounts/urls.py` |
| `POST /auth/otp/resend` | Y | `apps/accounts/urls.py` |
| `POST /auth/login` | Y | `apps/accounts/urls.py` |
| `POST /auth/token/refresh` | Y | `apps/accounts/urls.py` |
| `POST /auth/password/reset/request` | Y | `apps/accounts/urls.py` |
| `POST /auth/password/reset/confirm` | Y | `apps/accounts/urls.py` |
| `GET/PATCH /auth/me` | Y | `apps/accounts/urls.py` |
| `GET/POST /farms`, `/farms/{id}` | Y | `apps/farms/urls.py` (router) |
| `GET/POST /fields` | Y | `apps/farms/urls.py` (router) |
| `GET /crops` | Y | `apps/farms/urls.py` (router) |
| `GET/POST /sensor-nodes` | Y | `apps/farms/urls.py` (+ `admin-api`) |
| `GET /sensor-readings?...` | Y | `apps/sensors/urls.py` |
| `GET /sensor-readings/latest` | Y | `apps/sensors/urls.py` |
| `GET /recommendations` | Y | `apps/recommendations/urls.py` |
| `POST /recommendations/irrigation` | Y | `apps/recommendations/urls.py` |
| `POST /recommendations/fertilizer` | Y | `apps/recommendations/urls.py` |
| `POST /recommendations/yield` | Y | `apps/recommendations/urls.py` (`yield_estimate` action) |
| `POST /diseases/detect` | Y | `apps/diseases/urls.py` |
| `GET /diseases/reports` | Y | `apps/diseases/urls.py` |
| `GET/POST /assistant/sessions` | Y | `apps/assistant/urls.py` |
| `GET /assistant/sessions/{id}/messages` | Y | `apps/assistant/urls.py` |
| `POST /assistant/chat` | Y | `apps/assistant/urls.py` |
| `POST /assistant/chat/stream` | Y | `apps/assistant/urls.py` |
| `GET/POST /assistant/documents` | Y | `apps/assistant/urls.py` |
| `GET /alerts?unread=` | Y | `apps/alerts/urls.py` |
| `POST /alerts/{id}/read` | Y | `apps/alerts/urls.py` |
| `GET /reports/summary` | Y | `apps/reports/urls.py` |
| `GET /reports/export?format=` | Y | `apps/reports/urls.py` |
| `GET /weather/forecast?farm=` | Y | `apps/weather/urls.py` |
| `/admin-api/users` | Y | `apps/accounts/admin_urls.py` (router) |
| `/admin-api/sensor-nodes` | Y | `apps/accounts/admin_urls.py` (router) |
| `/admin-api/documents` | Y | `apps/accounts/admin_urls.py` (router) |
| `GET /api/schema`, `GET /api/docs` | Y | `config/urls.py` |

---

## E. Honest limitations (not closed here)

- **Trained models absent** — irrigation/fertilizer/yield/CNN run on deterministic stubs until
  real artifacts exist. Requires labelled datasets + training (out of backend scope).
- **RAG LLM is offline-only** — depends on a running Ollama; degrades to `503`, never fabricates.
- **SMS delivery unproven** — production HTTP gateway is wired but untested against a live
  provider; needs a real `SMS_PROVIDER` endpoint + key. Optional SMS delivery of *critical
  alerts* (UC-22 A2) is not yet connected to the gateway.
- **Weather provider parsing is generic** — `_parse` is best-effort across providers; a specific
  provider (e.g. OpenWeather/Open-Meteo) would warrant an exact mapper.
- **No new automated tests added** in this pass (the traceability matrix lists T-W*, T-RP*, T-AL*
  as intended coverage; the changed services remain unit-testable via injected repos/clients).
