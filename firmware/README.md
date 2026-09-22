# AgriMind Smart Farm — ESP32 firmware

Firmware that turns an ESP32 + soil-moisture probe + relay/pump into an AgriMind
field node. It reads **real soil moisture**, runs **smart irrigation** (pump ON
when dry, OFF when wet), **simulates** the sensors the NPK probe can't currently
read (NPK, pH, EC, temperature, humidity), and **pushes all readings to the
AgriMind backend every 5 seconds** (configurable) so they appear live on the
farmer's dashboard.

There are two sketches here:

- **`agrimind_smart_farm/`** — **current (v3).** No hard-coded Wi-Fi. Self-provisions
  over a captive-portal setup page, saves **many** Wi-Fi networks, and auto-pairs
  with the backend. **Use this one.**
- `AGRIMIND/` — old (v2). Wi-Fi SSID/password/token hard-coded at the top. Kept
  for reference only.

## Hardware / wiring
| Signal            | ESP32 pin |
|-------------------|-----------|
| Soil moisture (A) | GPIO 34   |
| Relay / pump      | GPIO 23   |
| Green LED         | GPIO 26   |
| Red LED           | GPIO 27   |
| Buzzer            | GPIO 25   |
| LCD 20x4 I²C      | SDA/SCL (0x27) |

> Pump relay is **active-LOW** (`LOW` = pump ON). Irrigation thresholds:
> pump ON when moisture **< 40 %**, OFF when **> 65 %** (hysteresis avoids chatter).

## First run — provision Wi-Fi (v3)
1. Power on. The board raises its own hotspot **`AgriMind-XXXX`** (password
   `agrimind123`) and an LCD shows the setup IP.
2. Join that hotspot from your phone → the setup page opens automatically
   (or browse to `http://192.168.4.1`).
3. **Wi-Fi tab → Scan → pick your network → enter password → Connect.**
   Add as many networks as you like (up to 8) — the board auto-reconnects to
   whichever one it can see. This is how it survives moving between networks.
4. ESP32 is **2.4 GHz only** — pick a 2.4 GHz SSID (e.g. the `-2G` band).

## Pair the device with a farm section (auto-discovery)
A fresh board starts **unpaired**: once online it heartbeats its hardware ID to
the backend. In the app: **Farm Monitor / Devices → claim the discovered
device → choose a section**. The backend hands the token back to the device
automatically — no re-flashing, no copy-paste. (You can still paste a token
manually in the portal's **Settings** tab to skip discovery.)

Backend URL, device token and send-interval are all editable in the portal and
stored in flash — they survive reboots.

## Build & flash (Arduino CLI)
```bash
# one-time deps
arduino-cli core install esp32:esp32
arduino-cli lib install "LiquidCrystal I2C"

# from the repo root, with the ESP32 on USB (find the port with: ls /dev/cu.*)
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/agrimind_smart_farm
arduino-cli upload  -p /dev/cu.usbserial-0001 --fqbn esp32:esp32:esp32 firmware/agrimind_smart_farm

# watch it run
arduino-cli monitor -p /dev/cu.usbserial-0001 --config baudrate=115200
```

Keep `agrimind_smart_farm.ino` and `web_portal.h` together in the same folder.

## Verify data is arriving
- Serial prints `POST telemetry -> 200 OK` every 5 s.
- In the app, the section flips to **live** and its sensor cards start moving.
- The ESP32 serves a live status page/API at `http://<esp32-ip>/` and
  `http://<esp32-ip>/api/status`.

## No SSH — use these instead
The ESP32 isn't a Linux box, so there's no SSH. For access:
- **Serial over USB** (`arduino-cli monitor`, 115200) — full live log.
- **Web portal** `http://192.168.4.1` (hotspot) or `http://<esp32-ip>/` on Wi-Fi —
  live readings, pump state, and config via the `/api/status` JSON API.

## Notes
- Telemetry payload: `{"token": "...", "readings": [{"sensor_type": "...", "value": N, "optimal_min": N, "optimal_max": N}, ...]}`.
- Supported `sensor_type`s: moisture, temperature, humidity, ph, ec, nitrogen,
  phosphorus, potassium, level.
- Crop-optimal bands are tuned for **common beans** (Claudine's field).
