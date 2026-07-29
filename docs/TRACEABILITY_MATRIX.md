# SmartMurima — Requirements Traceability Matrix

Two-way trace so nothing is orphaned: every **Requirement → Use Case → API Endpoint → UI Route →
Test**. If a row has a blank cell, that is a gap to close before "done". Test IDs map to the
dissertation's UT-/IT- cases plus added coverage (T-*).

## A. Functional requirements → everything

| FR | Requirement | Use Case(s) | Endpoint(s) | UI Route | Service / Logic | Tests |
|---|---|---|---|---|---|---|
| FR-01 | Registration, auth, RBAC, profiles | UC-01,02,03,04,05,06 | `/auth/register`,`/auth/otp/verify`,`/auth/otp/resend`,`/auth/login`,`/auth/token/refresh`,`/auth/password/reset/*`,`/auth/me` | `/register`,`/verify-otp`,`/login`,`/forgot-password`,`/settings` | AuthService, OtpService, SmsGateway, RBAC permissions | UT-05,UT-06,T-A1..A7 |
| FR-02 | Sensor data capture (MQTT→DB) | UC-11 | `run_ingestion` (worker); `GET /sensor-readings` | — (worker) | Ingestion, SensorReadingRepository, dedup/validation | UT-01,UT-02,IT-01,T-S1..S3 |
| FR-03 | Monitoring dashboard | UC-12,13 | `/sensor-readings/latest`,`/sensor-readings?agg=`,`/recommendations`,`/alerts`,`/diseases/reports` | `/dashboard`,`/fields/[id]` | SensorService aggregation | IT-02,T-DB1,T-DB2 |
| FR-04 | Irrigation recommendation | UC-14 | `POST /recommendations/irrigation` | `/recommendations` | FeatureBuilder, IrrigationClassifier, RecommendationService | UT-03,UT-04,T-R1..R4 |
| FR-05 | Fertilizer recommendation | UC-15 | `POST /recommendations/fertilizer` | `/recommendations` | FertilizerRecommender | T-R5,T-R6 |
| FR-06 | Crop-disease detection | UC-18,19 | `POST /diseases/detect`,`GET /diseases/reports` | `/diseases` | DiseaseClassifier (CNN), image validation | IT-05,T-D1..D4 |
| FR-07 | AI assistant (RAG) | UC-20,21 | `POST /assistant/chat`,`/chat/stream`,`/assistant/sessions*` | `/assistant` | AssistantService, Retriever(pgvector), PromptBuilder, Ollama | UT (empty-q),IT-03,T-AS1..AS4 |
| FR-08 | Alerts & notifications | UC-22 | `GET /alerts`,`POST /alerts/{id}/read` | `/alerts`, TopBar bell | AlertRules engine, cooldown | T-AL1..AL3 |
| FR-09 | Reports & export | UC-23 | `GET /reports/summary`,`/reports/export` | `/reports` | ReportService, PDF/CSV exporter | IT-04,T-RP1,T-RP2 |
| FR-10 | User & content administration | UC-24,25,26 | `/admin-api/users`,`/admin-api/sensor-nodes`,`/admin-api/documents`,`/assistant/documents` | `/admin` | AdminService, KnowledgeService (chunk+embed) | T-ADM1..ADM4 |
| (derived) | Yield forecast | UC-16 | `POST /recommendations/yield` | `/recommendations`,`/reports` | YieldRegressor | T-R7,T-R8 |
| (derived) | Weather integration | UC-29 | `GET /weather/forecast` | dashboard widget | WeatherClient (cached) | T-W1,T-W2 |
| (derived) | Extension oversight | UC-27,28 | scoped read endpoints | `/dashboard`,`/reports`,`/diseases` | object-level permissions | T-EX1,T-EX2 |

## B. Non-functional requirements → mechanism → verification

| NFR | Requirement | Mechanism | Verified by |
|---|---|---|---|
| NFR-1 Performance | <3s interactions, near-real-time ingest | query indexes, pagination, TanStack cache, MQTT stream | load test T-P1; ingestion latency T-P2 |
| NFR-2 Scalability | grow farmers/nodes/readings | service-oriented, containerised, stateless API, horizontal ingest/ML | architecture review; docker scale test |
| NFR-3 Security | authn, RBAC, TLS, hashing, input validation | JWT+refresh rotation, hashed OTP, role+object perms, DRF validators, Nginx TLS | T-A6 (401), T-A7 (RBAC), security-review |
| NFR-4 Usability | low-literacy, icons, plain language | design system, rw default, ≥44px targets | acceptance session AT-* |
| NFR-5 Reliability | graceful degradation | ML/CNN stubs, RAG "don't know", ingest drop-and-log, error handler | T-R (stub), T-AS2, T-S (bad payload) |
| NFR-6 Availability/offline | intermittent connectivity | broker buffering, client cache, SSE reconnect | T-S (broker replay) |
| NFR-7 Maintainability | modular, documented, containerised | layered per-app architecture, Dockerfiles, OpenAPI | code review; `/api/docs` |
| NFR-8 Localization | rw + en | next-intl, language field, RAG language routing | T-AS (language), UI i18n test |

## C. Endpoint → use case → test (reverse trace: no orphan endpoints)

Every endpoint in `API_CONTRACT.md` MUST appear here with an owning use case and a test. During
implementation review, diff this list against the router; any route not listed is either
undocumented (add it) or dead (remove it).

`auth/register`→UC-01, `auth/otp/verify`→UC-02, `auth/otp/resend`→UC-01/02, `auth/login`→UC-03,
`auth/token/refresh`→UC-06, `auth/password/reset/request|confirm`→UC-04, `auth/me`→UC-05 ·
`farms*`→UC-07, `fields*`→UC-08, `crops`→UC-08, `sensor-nodes*`→UC-09 ·
`sensor-readings*`→UC-12/13, ingestion worker→UC-11 ·
`recommendations/irrigation|fertilizer|yield`→UC-14/15/16, `recommendations`(GET)→UC-17 ·
`diseases/detect`→UC-18, `diseases/reports`→UC-19 ·
`assistant/chat|chat/stream`→UC-20, `assistant/sessions*`→UC-21, `assistant/documents`→UC-26 ·
`alerts*`→UC-22 · `reports/summary|export`→UC-23 · `weather/forecast`→UC-29 ·
`admin-api/users|sensor-nodes|documents`→UC-24/25/26 · `api/schema`,`api/docs`→UC-30.

## D. Backend test plan (pytest + pytest-django)

**Unit (services/repositories isolated; ml/rag/ollama mocked):**
- UT-01 create SensorReading valid payload → saved with correct fields
- UT-02 reject payload missing `soil_moisture` → validation error
- UT-03 rolling 7-day soil-moisture feature → correct average
- UT-04 irrigation classifier on sample input → valid class label + confidence in [0,1]
- UT-05 assistant endpoint empty question → 400
- UT-06 JWT-protected endpoint without token → 401
- T-A1 register creates inactive user + pending OTP; T-A2 OTP verify activates + issues JWT;
  T-A3 wrong OTP increments attempts; T-A4 expired OTP rejected; T-A5 max attempts locks;
  T-A6 login bad creds → 401 generic; T-A7 RBAC: farmer cannot hit `/admin-api/*` → 403
- T-S1 dedup on (device_id,ts); T-S2 implausible value dropped; T-S3 unknown device quarantined
- T-R1..R4 irrigation: happy path persists rec; stub fallback flagged; stale-data flag; critical→alert
- T-R5..R8 fertilizer + yield shapes/persistence
- T-D1..D4 disease: valid→report; low-confidence flagged; bad image rejected; healthy path
- T-AS1..AS4 assistant: grounded answer w/ sources; no-context→"don't know"; Ollama down→503; language routing
- T-AL1..AL3 alert raise/cooldown/scope; T-RP1..RP2 report aggregate + export; T-W1..W2 weather cache + fallback
- T-ADM1..ADM4 user mgmt guards + knowledge re-embed

**Integration (live test broker + test DB; Ollama mocked or gated):**
- IT-01 publish telemetry → DB record queryable
- IT-02 frontend/API fetches recommendations → correct JSON
- IT-03 assistant query triggers RAG then Ollama → grounded answer + sources
- IT-04 yield model output persisted as recommendation → visible
- IT-05 disease image upload → CNN endpoint → class returned

**Acceptance (per dissertation Table 16):** AT-1 live soil-moisture dashboard; AT-2 irrigation rec;
AT-3 diagnose leaf from photo; AT-4 ask assistant; AT-5 review yield estimate.

## E. Coverage gates
- CI target ≥ 80% line coverage on `apps/*/services.py` and `apps/*/repositories.py`.
- Every FR row above must have ≥1 passing test before release.
- Every exception flow in `USE_CASES.md` (E1/E2/…) should have a corresponding negative test.
