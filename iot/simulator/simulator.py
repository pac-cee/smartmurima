#!/usr/bin/env python3
"""
SmartMurima — Dockerised IoT telemetry simulator.

Publishes realistic telemetry for the seeded demo sensor nodes to the MQTT
broker so the full ingestion -> recommendation -> alert pipeline can be tested
end-to-end without physical ESP32 hardware.

Topic:    smartmurima/<device_id>/telemetry
Payload:  {"device_id", "soil_moisture"(0-100), "temperature", "humidity",
           "rainfall", "battery", "ts"(iso)}

Configuration is via environment variables (with sane defaults) so the service
can be dropped straight into docker-compose:

    MQTT_HOST     broker host           (default: mqtt)
    MQTT_PORT     broker port           (default: 1883)
    SIM_DEVICES   comma-separated ids   (default: SM-NODE-01,SM-NODE-02)
    SIM_INTERVAL  seconds between ticks (default: 10)

The backend only accepts telemetry for KNOWN device_ids, so SIM_DEVICES must
match seeded SensorNode device_ids (the demo seed creates SM-NODE-01/-02).
"""
import json
import os
import random
import sys
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


def _new_client(client_id: str) -> mqtt.Client:
    """Create a client that works with both paho-mqtt 1.x and 2.x."""
    try:
        # paho-mqtt >= 2.0 requires an explicit callback API version.
        return mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION1,
            client_id=client_id,
        )
    except (AttributeError, TypeError):
        # paho-mqtt 1.x
        return mqtt.Client(client_id=client_id)


class VirtualNode:
    """A single virtual sensor node with slowly-drifting, correlated readings."""

    def __init__(self, device_id: str):
        self.device_id = device_id
        self.soil_moisture = random.uniform(15.0, 45.0)   # % VWC
        self.temperature = random.uniform(18.0, 30.0)      # deg C
        self.humidity = random.uniform(40.0, 80.0)         # %
        self.battery = random.uniform(97.0, 100.0)         # %

    @staticmethod
    def _drift(value: float, delta: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, value + random.uniform(-delta, delta)))

    def step(self) -> dict:
        # Occasional small rain event replenishes soil moisture.
        rained = random.random() < 0.10
        rainfall = round(random.uniform(0.2, 4.0), 2) if rained else 0.0

        self.soil_moisture = self._drift(self.soil_moisture, 1.5, 15.0, 45.0)
        if rainfall:
            self.soil_moisture = min(45.0, self.soil_moisture + rainfall * 0.8)

        self.temperature = self._drift(self.temperature, 0.8, 18.0, 30.0)
        self.humidity = self._drift(self.humidity, 3.0, 40.0, 80.0)
        # Battery slowly drains and never climbs back up.
        self.battery = max(0.0, self.battery - random.uniform(0.01, 0.05))

        return {
            "device_id": self.device_id,
            "soil_moisture": round(self.soil_moisture, 1),
            "temperature": round(self.temperature, 1),
            "humidity": round(self.humidity, 1),
            "rainfall": rainfall,
            "battery": round(self.battery, 1),
            "ts": datetime.now(timezone.utc).isoformat(),
        }


def connect_with_retry(client: mqtt.Client, host: str, port: int) -> None:
    """Block until the broker accepts a connection (it may still be starting)."""
    attempt = 0
    while True:
        attempt += 1
        try:
            client.connect(host, port, keepalive=60)
            print(f"[simulator] connected to mqtt://{host}:{port}", flush=True)
            return
        except Exception as exc:  # broker not ready / DNS not resolvable yet
            delay = min(30, 2 * attempt)
            print(
                f"[simulator] broker not ready ({exc!r}); "
                f"retry {attempt} in {delay}s",
                flush=True,
            )
            time.sleep(delay)


def main() -> None:
    host = os.getenv("MQTT_HOST", "mqtt")
    port = int(os.getenv("MQTT_PORT", "1883"))
    interval = float(os.getenv("SIM_INTERVAL", "10"))
    devices = [
        d.strip()
        for d in os.getenv("SIM_DEVICES", "SM-NODE-01,SM-NODE-02").split(",")
        if d.strip()
    ]

    if not devices:
        print("[simulator] no SIM_DEVICES configured; nothing to do", flush=True)
        sys.exit(1)

    nodes = [VirtualNode(d) for d in devices]

    client = _new_client("smartmurima-simulator")
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    connect_with_retry(client, host, port)
    client.loop_start()

    print(
        f"[simulator] publishing every {interval}s for "
        f"{len(nodes)} node(s): {', '.join(devices)}",
        flush=True,
    )

    try:
        while True:
            for node in nodes:
                payload = node.step()
                topic = f"smartmurima/{node.device_id}/telemetry"
                result = client.publish(topic, json.dumps(payload), qos=0)
                status = "ok" if result.rc == mqtt.MQTT_ERR_SUCCESS else f"rc={result.rc}"
                print(f"[simulator] -> {topic} {payload} ({status})", flush=True)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[simulator] stopping", flush=True)
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
