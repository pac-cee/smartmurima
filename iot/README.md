# SmartMurima — IoT Layer

Low-cost ESP32 sensor nodes stream field telemetry over MQTT to the backend ingestion worker.

## Payload
Published to `smartmurima/<device_id>/telemetry`:
```json
{ "device_id": "node-bugesera-01", "soil_moisture": 34.2,
  "temperature": 27.4, "humidity": 61.0, "rainfall": 0.0 }
```

## Hardware node (`firmware/`)
`smartmurima_node.ino` — Arduino sketch for **ESP32-WROOM-32** with a capacitive
soil-moisture sensor (GPIO34), a DHT22 temperature/humidity sensor (GPIO4), and an optional
rain sensor (GPIO35). Set your Wi-Fi + broker IP + a unique `DEVICE_ID`, calibrate
`SOIL_DRY_RAW`/`SOIL_WET_RAW`, flash via Arduino IDE. Publishes every 60 s.

Libraries: PubSubClient, DHT sensor library (+ Adafruit Unified Sensor), ArduinoJson.

## Simulator (`simulator/`) — no hardware needed
```bash
pip install paho-mqtt
python simulator/simulate_nodes.py --host localhost --port 1883 --nodes 3 --interval 5
```
Register matching sensor nodes in the app (device_id `node-bugesera-01..03`) and watch the
dashboards, irrigation recommendations, and low-moisture alerts populate live.
