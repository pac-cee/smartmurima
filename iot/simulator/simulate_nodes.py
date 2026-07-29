#!/usr/bin/env python3
"""
SmartMurima — IoT telemetry simulator.

Publishes realistic soil-moisture / temperature / humidity / rainfall readings
for one or more virtual ESP32 nodes to the MQTT broker, so the full ingestion ->
recommendation -> alert pipeline can be demonstrated without physical hardware.

Usage:
    pip install paho-mqtt
    python simulate_nodes.py --host localhost --port 1883 --nodes 3 --interval 5

Each node walks a semi-arid Bugesera-like daily cycle (drying soil, warm days,
occasional rain) so the dashboards and irrigation model see plausible variation.
"""
import argparse
import json
import math
import random
import time
from datetime import datetime

import paho.mqtt.client as mqtt


class VirtualNode:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.soil = random.uniform(28, 55)     # % volumetric water content
        self.base_temp = random.uniform(24, 29)
        self.tick = random.randint(0, 1000)

    def step(self) -> dict:
        self.tick += 1
        # Diurnal temperature curve
        phase = math.sin(self.tick / 60.0)
        temperature = self.base_temp + 6 * phase + random.uniform(-0.6, 0.6)
        humidity = max(15, min(95, 70 - 25 * phase + random.uniform(-3, 3)))

        # Soil slowly dries; random rain events replenish it
        rained = random.random() < 0.04
        rainfall = round(random.uniform(3, 20), 2) if rained else 0.0
        self.soil += (rainfall * 0.8) - 0.4 - max(0, phase) * 0.3
        self.soil = max(6, min(95, self.soil))

        return {
            "device_id": self.device_id,
            "soil_moisture": round(self.soil, 2),
            "temperature": round(temperature, 1),
            "humidity": round(humidity, 1),
            "rainfall": rainfall,
            "ts": datetime.utcnow().isoformat() + "Z",
        }


def main():
    ap = argparse.ArgumentParser(description="SmartMurima MQTT telemetry simulator")
    ap.add_argument("--host", default="localhost")
    ap.add_argument("--port", type=int, default=1883)
    ap.add_argument("--nodes", type=int, default=3)
    ap.add_argument("--interval", type=float, default=5.0, help="seconds between readings")
    ap.add_argument("--prefix", default="node-bugesera")
    args = ap.parse_args()

    client = mqtt.Client(client_id="smartmurima-simulator")
    client.connect(args.host, args.port, 60)
    client.loop_start()

    nodes = [VirtualNode(f"{args.prefix}-{i:02d}") for i in range(1, args.nodes + 1)]
    print(f"Simulating {len(nodes)} node(s) -> mqtt://{args.host}:{args.port}  (Ctrl+C to stop)")

    try:
        while True:
            for node in nodes:
                payload = node.step()
                topic = f"smartmurima/{node.device_id}/telemetry"
                client.publish(topic, json.dumps(payload))
                print(f"{topic}: {payload}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopping simulator.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
