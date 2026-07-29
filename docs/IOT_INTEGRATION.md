# SmartMurima — IoT Integration (ESP32 → MQTT → DB → REST → Frontend)

This document describes the end-to-end live telemetry path: how a field sensor
node publishes a reading, how the backend ingests and stores it, how the REST
API exposes it, and how the browser renders it live.

## 1. The full path

```
 ESP32 node / simulator                Broker            Django backend                 Browser (Next.js)
┌───────────────────────┐   MQTT   ┌───────────┐   sub  ┌────────────────────────┐  REST  ┌──────────────────────┐
│ soil / temp / humidity │ ───────▶ │ Mosquitto │ ─────▶ │ run_ingestion worker   │        │ TanStack Query polls │
│ rainfall sensors       │  publish │  :1883    │ topic  │  → IngestionService    │        │  every ~8s           │
│ publish every 5–60s    │          │           │ +/tel. │  → SensorReading (DB)  │ ◀────  │  dashboard + field   │
└───────────────────────┘          └───────────┘        │  → node.last_seen      │  GET   │  KPIs / gauges /     │
                                                         │  → low-moisture alert  │  JSON  │  trend + live badge  │
                                                         └────────────────────────┘        └──────────────────────┘
```

Nothing in the browser speaks MQTT. The browser only calls the REST API; the
MQTT→DB half is a server-side background worker. "Live" on the frontend means
**short-interval polling of the REST API**, which reads the rows the ingestion
worker is continuously writing.

## 2. MQTT topic & payload

- **Broker:** Mosquitto, `mqtt://<host>:1883` (docker-compose service `mqtt`).
- **Topic:** `smartmurima/<device_id>/telemetry`
- **Worker subscription:** `smartmurima/+/telemetry` (`MQTT_TOPIC`, wildcard over all devices).
- **Payload (JSON):**

```json
{
  "device_id": "node-bugesera-01",
  "soil_moisture": 34.2,
  "temperature": 27.4,
  "humidity": 61.0,
  "rainfall": 0.0,
  "ts": "2026-07-29T09:15:00Z"
}
```

Field notes:
- `device_id` — required. If omitted from the body, the worker falls back to the
  device id embedded in the topic (`smartmurima/<device_id>/telemetry`).
- `soil_moisture` — required, `0–100` (% VWC). Out-of-range or missing → payload rejected.
- `temperature`, `humidity`, `rainfall` — optional (nullable in the DB).
- `ts` — optional ISO-8601 timestamp. Also accepts `timestamp` / `recorded_at`.
  If absent, the server uses receive time. Dedup key is `(device_id, timestamp)`.

## 3. Sources: firmware & simulator

Both live in `iot/`.

- **Firmware — `iot/firmware/smartmurima_node/smartmurima_node.ino`**
  Arduino sketch for an **ESP32-WROOM-32**: capacitive soil-moisture sensor
  (GPIO34), DHT22 temperature/humidity (GPIO4), optional rain sensor (GPIO35).
  Set Wi-Fi SSID/password, the broker IP, and a unique `DEVICE_ID`
  (`node-bugesera-01`…), calibrate `SOIL_DRY_RAW`/`SOIL_WET_RAW`, and flash via
  the Arduino IDE (libraries: PubSubClient, DHT sensor library + Adafruit
  Unified Sensor, ArduinoJson). Publishes to `smartmurima/<DEVICE_ID>/telemetry`
  every 60 s.

- **Simulator — `iot/simulator/simulate_nodes.py`** (no hardware needed)
  Publishes realistic Bugesera-like readings for N virtual nodes named
  `node-bugesera-01..0N`:

  ```bash
  pip install paho-mqtt
  python iot/simulator/simulate_nodes.py --host localhost --port 1883 --nodes 3 --interval 5
  ```

## 4. Device → field mapping (seed)

A `SensorNode.device_id` is the join key between the physical/simulated device
and a farmer's field. The demo seed (`backend/apps/farms/management/commands/seed_demo.py`)
registers three nodes whose ids **match the simulator/firmware exactly**:

| device_id          | Field       | Farm                | Crop  |
|--------------------|-------------|---------------------|-------|
| `node-bugesera-01` | North Plot  | Bugesera Demo Farm  | Maize |
| `node-bugesera-02` | South Plot  | Bugesera Demo Farm  | Beans |
| `node-bugesera-03` | East Plot   | Bugesera Demo Farm  | Maize |

All three belong to the demo `farmer` (`farmer@smartmurima.rw`, password
`Demo1234!`). Register more nodes at runtime via `POST /api/v1/sensor-nodes`
`{field, device_id, status, battery}` — unknown device ids are logged and
skipped by the ingestion worker until a node exists.

## 5. Backend ingestion

- **Worker:** `python manage.py run_ingestion`
  (`backend/apps/sensors/management/commands/run_ingestion.py`, docker service
  `ingestion`). Subscribes to `MQTT_TOPIC` and drives `IngestionService`.
- **Subscriber:** `backend/iot/mqtt_subscriber.py` — decodes JSON, injects the
  topic's device id when needed, and never lets a bad message kill the loop
  (malformed JSON is logged and dropped).
- **Service:** `backend/apps/sensors/services.py::IngestionService.ingest()`
  1. Validates the payload (required/typed/ranged `soil_moisture`, parsed timestamp).
  2. Looks up `SensorNode` by `device_id`. **Unknown device → logged & skipped.**
  3. **Dedups** on `(sensor_node, recorded_at)` (unique constraint + explicit check).
  4. Persists a `SensorReading` linked to the node's field.
  5. Updates `node.last_seen` (and `battery` if provided).
  6. Fires the **low-moisture alert** rule when `soil_moisture < 20%`.
  The worker catches `NotFoundError` / `ValidationError` / anything else so it
  runs forever.

## 6. REST API (what the browser reads)

Base URL `NEXT_PUBLIC_API_URL` (`http://localhost:8000/api/v1`). JWT auth. All
list endpoints are paginated `{ count, next, previous, results }`.

- `GET /sensor-readings?field=&node=&from=&to=&agg=hourly|daily`
  → paginated `SensorReading`:
  `{ id, sensor_node, soil_moisture, temperature, humidity, rainfall, recorded_at }`
  (with `agg`, buckets are averaged; rainfall summed).
- `GET /sensor-readings/latest?field=<id>` → the newest reading for the field, or
  `null` when the field has no telemetry yet.
- `GET /sensor-nodes` → node roster incl. `status`, `battery`, `last_seen`
  (drives the offline / last-seen UI).

Timestamps are ISO-8601. Integer PKs serialize as JSON numbers and DecimalFields
as strings; the frontend Zod schemas coerce these (`z.coerce`) so the backend
stays the source of truth.

## 7. How the frontend consumes it (live)

- **Client:** `frontend/src/lib/api.ts` — typed fetch client, base
  `NEXT_PUBLIC_API_URL`, JWT + refresh interceptor. Responses are validated with
  Zod schemas (`frontend/src/lib/schemas.ts`).
- **Mocks off by default:** MSW only starts when
  `NEXT_PUBLIC_API_MOCKING === 'enabled'` (`frontend/src/app/providers.tsx`).
  With it `disabled`, every request hits the real backend.
- **Live polling (TanStack Query `refetchInterval`, ~8 s):**
  - `useLatestReading(fieldId)` → dashboard KPI tiles + field-detail gauges.
  - `useSensorReadings(fieldId, agg)` → dashboard & field-detail trend chart.
  So a reading the simulator publishes appears within a few seconds without a
  page reload.
- **Sensor status:** `frontend/src/components/SensorStatus.tsx` shows a live green
  pulse + "Live · Xm ago" when the latest reading is within 3 minutes, otherwise
  "Offline · <last seen>", and "No sensor data" when a field has none.
- **Auth to reach the data:** register → OTP verify → login, against the real
  `/auth/*` endpoints. Login and OTP-verify return `{ user, tokens: {access,
  refresh} }`. **Dev OTP:** with the console SMS gateway the backend returns a
  `dev_code` on register / resend / reset; the frontend forwards it to the verify
  screen and shows it (and prefills the input) in dev, so no server-log reading is
  needed. In production (real SMS gateway) `dev_code` is absent and the code is
  delivered by SMS.

### Short answer: "how does the frontend connect to IoT?"

It doesn't connect to MQTT at all. The ESP32/simulator publish over MQTT to the
broker; a backend worker (`run_ingestion`) subscribes, writes each reading to the
database, and updates the node's `last_seen`. The Next.js app then **polls the
REST API every ~8 seconds** (`GET /sensor-readings/latest` and
`GET /sensor-readings`) and re-renders the KPIs, gauges, trend chart, and
online/last-seen badge — so the browser sees IoT data live via the database and
HTTP, never via a direct device connection.

## 8. Run it

### A) Docker (everything wired)

```bash
# from repo root — starts db, mqtt, backend, ingestion worker, frontend (mocks off)
docker compose up -d --build

# seed the demo farmer/farm/fields + node-bugesera-01/02/03
docker compose exec backend python manage.py seed_demo

# stream live telemetry from the host into the broker
pip install paho-mqtt
python iot/simulator/simulate_nodes.py --host localhost --port 1883 --nodes 3 --interval 5
```

Open http://localhost:3000, sign in as `farmer@smartmurima.rw` / `Demo1234!`
(seeded, already active), and watch the dashboard/field pages update live.

### B) Local (manual processes)

```bash
# 1. broker
docker compose up -d mqtt db

# 2. backend (in backend/, venv with requirements installed)
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000

# 3. ingestion worker (separate shell, same venv)
python manage.py run_ingestion            # subscribes smartmurima/+/telemetry

# 4. frontend (in frontend/) — mocks off so it hits the real API
#    frontend/.env.local: NEXT_PUBLIC_API_MOCKING=disabled
pnpm install && pnpm dev

# 5. telemetry
python ../iot/simulator/simulate_nodes.py --host localhost --port 1883 --nodes 3 --interval 5
```

Verify the pipeline:
- `run_ingestion` logs `Ingested reading node=… soil=…` per accepted message.
- `GET /api/v1/sensor-readings/latest?field=<id>` (with a Bearer token) returns
  the newest values; the numbers climb/drift as the simulator runs.
- The dashboard "Live" badge stays green and KPI/gauge values move every few seconds.
