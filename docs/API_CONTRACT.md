# SmartMurima — API Contract (v1)

Base URL: `/api/v1`. Auth: JWT (access + refresh) via `Authorization: Bearer <token>`.
All list endpoints are paginated: `{ count, next, previous, results }`. All timestamps ISO-8601.
Errors: `{ "detail": "...", "code": "...", "errors": { field: [msg] } }`.

## Roles
`farmer` | `coop_admin` | `extension` | `admin` (role-based access control on every endpoint).

## Auth & OTP  `/auth`
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{full_name,email,phone_number,password,role,language}` | Creates inactive user, sends OTP |
| POST | `/auth/otp/verify` | `{phone_number\|email, code}` | Activates account, returns tokens |
| POST | `/auth/otp/resend` | `{phone_number\|email, purpose}` | purpose: `register`\|`login`\|`reset` |
| POST | `/auth/login` | `{identifier, password}` | May trigger OTP step (2FA) |
| POST | `/auth/token/refresh` | `{refresh}` | New access token |
| POST | `/auth/password/reset/request` | `{email\|phone_number}` | OTP-based reset |
| POST | `/auth/password/reset/confirm` | `{identifier, code, new_password}` | |
| GET/PATCH | `/auth/me` | profile | Current user |

## Farms  `/farms`, `/fields`, `/crops`, `/sensor-nodes`
- `GET/POST /farms` `{name,sector,latitude,longitude,area_hectares}` (farmer/coop_admin)
- `GET/PATCH/DELETE /farms/{id}`
- `GET/POST /fields` `{farm,name,crop,planting_date,growth_stage,area_hectares}`
- `GET /crops` `{name,base_temp,season}`
- `GET/POST /sensor-nodes` `{field,device_id,status,battery,last_seen}`

## Sensors  `/sensor-readings`
- `GET /sensor-readings?field=&node=&from=&to=&agg=hourly|daily`
  → `{soil_moisture,temperature,humidity,rainfall,recorded_at}`
- `GET /sensor-readings/latest?field=` latest per field
- Ingestion is internal (MQTT subscriber → DB), not a public POST.

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
- `GET /weather/forecast?farm=` (backend proxies external API, cached)

## Admin  `/admin-api`
- `GET/POST/PATCH/DELETE /admin-api/users`, `/admin-api/sensor-nodes`, `/admin-api/documents`

### Frontend fetch conventions
- Central typed API client (`lib/api.ts`) with token refresh interceptor.
- TanStack Query for server state. Zod schemas mirror these payloads.
- Env: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.
