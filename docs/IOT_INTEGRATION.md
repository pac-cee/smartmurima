# SmartMurima — IoT Integration (ESP32 → HTTP → DB → REST → Frontend)

How a field node gets paired, how a reading travels from the soil to the
dashboard, and how a farmer's pump command travels back.

There is **no message broker**. A device speaks plain HTTP JSON to two
endpoints, which is all an ESP32 needs and one less service to run, secure and
explain. The firmware in `firmware/agrimind_smart_farm/` is the reference
client; `manage.py simulate_devices` is a software node that speaks the exact
same protocol.

## 1. The full path

```
 ESP32 node / simulator                 Django backend                     Browser (Next.js)
┌────────────────────────┐  HTTPS  ┌──────────────────────────┐   REST  ┌────────────────────────┐
│ RS485 soil probe:      │ ──────▶ │ POST /iot/telemetry/     │         │ TanStack Query polls   │
│ moisture, temp, pH,    │  every  │  → token → SensorNode    │         │  every ~6-8s           │
│ EC, N, P, K            │  5-60s  │  → SensorReading (DB)    │ ◀────── │  dashboard · sensors   │
│ + pump state           │         │  → node.last_seen        │  GET    │  devices · gauges      │
│                        │ ◀────── │  → low-moisture alert    │  JSON   │                        │
│ applies {command}      │  200 OK │  ← {command} pump block  │         │ POST pump override ───▶│
└────────────────────────┘         └──────────────────────────┘         └────────────────────────┘
```

"Live" in the browser means **short-interval polling of the REST API**, reading
rows the telemetry endpoint is continuously writing. The browser never talks to
a device directly.

## 2. Pairing: a board nobody configured

A fresh board has no token. It cannot post readings, and that is the point — an
unauthenticated device must not be able to write into a farmer's field.

```
1. Board boots, joins Wi-Fi via its own captive portal (no hard-coded SSID).
2. Board  ──▶ POST /iot/announce/   {"hardware_id": "ESP32-A1B2C3", "name": "AgriMind-C3"}
   Backend ◀──                      {"status": "pending", "device_id": "SM-A1B2C3"}
   It now appears under Devices → Discovered in the app. No token issued yet.

3. Farmer ──▶ POST /sensor-nodes/{id}/claim   {"field": 11}
   Backend mints a random token and attaches the device to that field.

4. Board  ──▶ POST /iot/announce/   (same body, next heartbeat)
   Backend ◀──                      {"status": "claimed", "token": "uU_N9S-..."}
   The board saves the token to flash and starts sending telemetry.
```

No re-flashing, no copy-pasted secrets. Unpairing (`POST
/sensor-nodes/{id}/release`) revokes the token and returns the board to the
discovery list.

## 3. Telemetry

`POST /api/v1/iot/telemetry/` — no auth header; the body's `token` is the
credential.

```json
{
  "token": "uU_N9S-I45m46BrZF6cTTJdifAu0K3ggJCL-6Zt72pc",
  "pump": false,
  "readings": [
    {"sensor_type": "moisture",   "value": 31.2,  "optimal_min": 40.0, "optimal_max": 65.0},
    {"sensor_type": "temperature","value": 24.6,  "optimal_min": 18.0, "optimal_max": 30.0},
    {"sensor_type": "ph",         "value": 6.41,  "optimal_min": 6.0,  "optimal_max": 7.0},
    {"sensor_type": "ec",         "value": 1.204, "optimal_min": 0.8,  "optimal_max": 1.6},
    {"sensor_type": "nitrogen",   "value": 47,    "optimal_min": 30.0, "optimal_max": 60.0},
    {"sensor_type": "phosphorus", "value": 29,    "optimal_min": 20.0, "optimal_max": 40.0},
    {"sensor_type": "potassium",  "value": 131,   "optimal_min": 100.0,"optimal_max": 160.0}
  ]
}
```

Recognised `sensor_type` values map to `SensorReading` columns:

| `sensor_type` | Column | Unit |
|---|---|---|
| `moisture` (or `soil_moisture`) | `soil_moisture` | % VWC — **required** |
| `temperature` | `temperature` | °C |
| `humidity` | `humidity` | % |
| `rainfall` | `rainfall` | mm |
| `ph` | `ph` | pH |
| `ec` | `ec` | mS/cm |
| `nitrogen` / `phosphorus` / `potassium` | `nitrogen` / `phosphorus` / `potassium` | mg/kg |

An unknown `sensor_type` is **ignored, not rejected** — a newer board must never
fail against an older backend. Every channel except soil moisture is optional
and stored as `NULL` when absent (the RS485 probe has no air-humidity channel,
so `humidity` stays null rather than a fake `0`).

Readings are de-duplicated on `(sensor_node, recorded_at)`, so a retry after a
flaky connection cannot double-count.

### Responses

| Status | Meaning |
|---|---|
| `200` | Stored. Body carries the `command` block below. |
| `400` | Malformed body, or soil moisture missing/out of 0–100. |
| `403` | Unknown token, or the device is not claimed to a field. |

## 4. The command block — control flowing back

Every telemetry response carries the device's current orders. This is how a tap
in the app reaches a pump in a field, without the backend ever needing to
connect *to* the device (which sits behind a home router with no public IP).

```json
{"command": {"pump_mode": "auto", "pump_on": null, "dry_level": 40, "wet_level": 65}}
```

| Field | Meaning |
|---|---|
| `pump_mode` | `auto` — the device decides from soil moisture; `manual` — obey `pump_on`. |
| `pump_on` | `true`/`false` in manual mode. **`null` in auto mode**: the device's signal to fall back to its own thresholds. |
| `dry_level` | Turn the pump **on** below this soil moisture %. |
| `wet_level` | Turn the pump **off** above it. The gap is hysteresis — it stops the relay chattering around one setpoint. |

Latency is one telemetry interval (5 s on the reference firmware). The app
therefore tracks two separate things: `pump_mode`/`pump_on` (what we
**commanded**) and `pump_state` (what the device last **reported**), so an
override that has not landed yet is visible rather than silently assumed.

Farmer-facing control endpoints (JWT-authenticated, owner-scoped):

| Endpoint | Purpose |
|---|---|
| `POST /sensor-nodes/{id}/claim` `{field}` | Pair a discovered device to a section. |
| `POST /sensor-nodes/{id}/release` | Unpair; revokes the token. |
| `POST /sensor-nodes/{id}/pump` `{pump_mode, pump_on?}` | Force on/off, or hand control back to auto. |
| `POST /sensor-nodes/{id}/thresholds` `{dry_level, wet_level}` | Re-tune the irrigation band (`dry < wet` enforced). |
| `GET /sensor-nodes?claimed=false` | The discovery list. |

## 5. Running without hardware

`simulate_devices` is a real client, not a backend shortcut: it POSTs to the
same public endpoint, parses the same command block, and runs the same pump
hysteresis. Whatever it exercises, a real board exercises identically.

```bash
# Alongside the stack (uses the seeded dev tokens):
docker compose --profile iot up -d simulator
docker compose logs -f simulator

# Or one-off / against a device you claimed yourself:
docker compose exec backend python manage.py simulate_devices --once
docker compose exec backend python manage.py simulate_devices --token <tok> --interval 5
```

The seeded nodes `SM-NODE-01` / `SM-NODE-02` ship with fixed dev tokens
(`dev-token-sm-node-01` / `-02`) purely so this works on a fresh database. Real
boards always get a random token minted at claim time.

## 6. Storage & side effects

Each accepted reading:

1. Inserts a `SensorReading` row (deduped on node + timestamp).
2. Updates `SensorNode.last_seen`, which drives the live/offline badge
   (`is_online` = reported within 60 s).
3. Records `pump_state` when the device's reported state changed.
4. Raises a **low-moisture alert** when soil moisture drops below 20 % — and a
   failure here is logged, never allowed to reject the reading.

## 7. Reading it back

| Endpoint | Purpose |
|---|---|
| `GET /sensor-readings/latest?field=` | Newest reading, or `null` if the field has none. |
| `GET /sensor-readings?field=&from=&to=` | Paginated history. |
| `GET /sensor-readings?field=&agg=hourly\|daily` | Bucketed averages (rainfall is summed). |

## 8. Troubleshooting

| Symptom | Cause |
|---|---|
| Device never appears under Discovered | Wrong backend URL. `localhost` in the firmware means the ESP32 itself — use the LAN IP of the Docker host. |
| Serial shows `announce -> HTTP 000` | Not on Wi-Fi, or the host's port 8000 is firewalled. |
| Announce returns `pending` forever | Nobody has claimed it yet. Devices → Discovered → pick a section → Pair. |
| Telemetry returns `403` | Token revoked by an unpair, or the device was never claimed. It re-pairs automatically on the next announce. |
| Readings land but the section looks empty | The device is claimed to a *different* section than the one selected in the top bar. |
| ESP32 will not join the Wi-Fi | It is 2.4 GHz only — pick the `-2G` SSID. |
