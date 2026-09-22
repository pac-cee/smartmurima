# SmartMurima — API Contract (v1)

Base URL: `/api/v1`. Auth: JWT (access + refresh) via `Authorization: Bearer <token>`.
All list endpoints are paginated: `{ count, next, previous, results }`. All timestamps ISO-8601.
Errors: `{ "detail": "...", "code": "...", "errors": { field: [msg] } }`.

## Roles
`farmer` | `coop_admin` | `extension` | `admin` (role-based access control on every endpoint).

## Auth  `/auth`
Sign-up and sign-in are **single-step** — no OTP, no verification screen. The
only one-time code left is the password-reset code.

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{full_name, email?, phone_number?, password, language?, location?}` | Creates an **active** farmer and returns `{user, tokens}` (201). At least one of email/phone required; a duplicate returns 409. |
| POST | `/auth/login` | `{identifier, password}` | `identifier` = username, email, or phone → `{user, tokens}` |
| POST | `/auth/token/refresh` | `{refresh}` | New access token |
| POST | `/auth/password/reset/request` | `{email\|phone_number}` | Issues a reset code; the dev console gateway returns it as `dev_code` |
| POST | `/auth/password/reset/confirm` | `{identifier, code, new_password}` | |
| POST | `/auth/password/change` | `{old_password, new_password}` | Authenticated |
| GET/PATCH | `/auth/me` | profile | Current user |

## Farms  `/farms`, `/fields`, `/crops`, `/sensor-nodes`
- `GET/POST /farms` `{name,sector,latitude,longitude,area_hectares}` (farmer/coop_admin)
- `GET/PATCH/DELETE /farms/{id}`
- `GET/POST /fields` `{farm,name,crop,planting_date,growth_stage,area_hectares}`
- `GET /crops` `{name,base_temp,season}`
- `GET /sensor-nodes?claimed=true|false&field=` — devices; `claimed=false` is the discovery list
- `GET/POST /sensor-nodes` `{field, device_id, status, battery}` → also returns
  `{hardware_id, name, is_claimed, is_online, pump_mode, pump_on, pump_state, dry_level, wet_level}`
  (the device `token` is never exposed to the app)
- `POST /sensor-nodes/{id}/claim` `{field}` — pair a discovered device, mints its token
- `POST /sensor-nodes/{id}/release` — unpair, revoking the token
- `POST /sensor-nodes/{id}/pump` `{pump_mode: auto|manual, pump_on?}` — irrigation override
- `POST /sensor-nodes/{id}/thresholds` `{dry_level, wet_level}` — `dry < wet` enforced

## Sensors  `/sensor-readings`  (read-only)
- `GET /sensor-readings?field=&node=&from=&to=&agg=hourly|daily`
  → `{soil_moisture, temperature, humidity, rainfall, ph, ec, nitrogen,
     phosphorus, potassium, device_id, recorded_at}` (all but `soil_moisture` nullable)
- `GET /sensor-readings/latest?field=` latest per field, or `null` if none
- Writes never come through here — they arrive on `/iot/` below.

## Devices  `/iot`  (device-facing, no JWT)
The only two routes an ESP32 calls. The body's `token` is the credential; see
`docs/IOT_INTEGRATION.md` for the full protocol.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/iot/announce/` | `{hardware_id, name?}` | `{status: pending\|claimed, device_id, token?}` — the token only once a farmer has claimed it |
| POST | `/iot/telemetry/` | `{token, pump?, readings:[{sensor_type, value, optimal_min?, optimal_max?}]}` | `{command:{pump_mode, pump_on, dry_level, wet_level}}` |

`403` = unknown token or unclaimed device. Unknown `sensor_type`s are ignored,
not rejected, so a newer board never breaks against an older backend.

## Recommendations  `/recommendations`
- `GET /recommendations?field=&type=irrigation|fertilizer|yield`
- `POST /recommendations/irrigation` `{field}` → runs ML, returns
  `{type,decision,value,unit,confidence,details,created_at}`
- `POST /recommendations/fertilizer` `{field}`
- `POST /recommendations/yield` `{field}`

## Disease detection  `/diseases`
- `POST /diseases/detect` multipart `{field, image}` →
  `{disease,confidence,is_healthy,treatment,image_url,created_at}`
- `GET /diseases/reports?field=`

## AI Assistant (RAG)  `/assistant`
- `GET /assistant/sessions`, `POST /assistant/sessions`
- `GET /assistant/sessions/{id}/messages`
- `POST /assistant/chat` `{session?, question, language}` →
  `{answer, sources:[{title,ref,snippet}], session}` (streamed variant: `/assistant/chat/stream` SSE)
- `GET/POST /assistant/documents` (admin) — knowledge base management + re-embed

## Alerts  `/alerts`
- `GET /alerts?unread=true`, `POST /alerts/{id}/read`
- Types: `low_moisture` | `disease_risk` | `weather` | `system`

## Reports  `/reports`
- `GET /reports/summary?farm=&from=&to=` aggregate stats
- `GET /reports/export?format=pdf|csv&...`

## Weather  `/weather`
- `GET /weather/forecast?farm=` → `{farm, days:[{date, temp_min, temp_max, humidity, rainfall_mm, summary}], source, stale}`
- `source`: `live` | `cache` | `last_known` | `neutral`. With no provider
  configured the backend still answers, with a neutral estimate and
  `stale: true` — the UI badges it "Estimated" rather than implying a real forecast.

## Admin
Day-to-day administration is the **Django admin at `/admin`** (users, farms,
fields, devices, readings, alerts, recommendations, disease reports, knowledge
documents). A user with `role=admin` is granted staff access automatically.

A JSON mirror exists for programmatic use:
- `GET/POST/PATCH/DELETE /admin-api/users`, `/admin-api/sensor-nodes`, `/admin-api/documents`

### Frontend fetch conventions
- Central typed API client (`lib/api.ts`) with token refresh interceptor.
- TanStack Query for server state. Zod schemas mirror these payloads.
- Env: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.
