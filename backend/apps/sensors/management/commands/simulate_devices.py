"""A virtual ESP32 field node.

Posts to the very same HTTP endpoint the real firmware uses, with the same
body shape, and obeys the same command block coming back -- including running
its own pump hysteresis in auto mode. That means a demo with no hardware
exercises the identical code path as a demo with hardware; there is no
simulator-only shortcut in the backend.

    python manage.py simulate_devices                     # seeded dev nodes
    python manage.py simulate_devices --interval 5
    python manage.py simulate_devices --token <tok> --once
"""
from __future__ import annotations

import json
import random
import time
import urllib.error
import urllib.request

from django.core.management.base import BaseCommand, CommandError

DEFAULT_BASE_URL = "http://localhost:8000/api/v1"

# Crop-optimal bands, mirroring the constants flashed onto the board. Sent with
# every reading so the dashboard can flag out-of-band values without hardcoding
# agronomy of its own.
BANDS = {
    "moisture": (40.0, 65.0),
    "temperature": (18.0, 30.0),
    "humidity": (50.0, 80.0),
    "ph": (6.0, 7.0),
    "ec": (0.8, 1.6),
    "nitrogen": (30.0, 60.0),
    "phosphorus": (20.0, 40.0),
    "potassium": (100.0, 160.0),
}


class VirtualNode:
    """One simulated board: drifting sensors plus a pump it actually runs."""

    def __init__(self, token: str, seed: int = 0):
        self.token = token
        self.rng = random.Random(seed)
        self.moisture = self.rng.uniform(30.0, 60.0)
        self.temperature = self.rng.uniform(19.0, 27.0)
        self.humidity = self.rng.uniform(55.0, 75.0)
        self.ph = self.rng.uniform(6.0, 7.0)
        self.ec = self.rng.uniform(0.9, 1.4)
        self.nitrogen = self.rng.uniform(35.0, 55.0)
        self.phosphorus = self.rng.uniform(22.0, 38.0)
        self.potassium = self.rng.uniform(105.0, 150.0)
        # Control state, mirrored from the backend's command block.
        self.pump_on = False
        self.pump_mode = "auto"
        self.dry_level = 40
        self.wet_level = 65

    def tick(self):
        """Advance the physics one interval."""
        # Irrigating raises moisture; otherwise the soil dries out.
        if self.pump_on:
            self.moisture += self.rng.uniform(2.0, 4.0)
        else:
            self.moisture -= self.rng.uniform(0.4, 1.4)
        self.moisture = _clamp(self.moisture, 3.0, 100.0)
        self.temperature = _clamp(self.temperature + self.rng.uniform(-0.4, 0.4), 12.0, 40.0)
        self.humidity = _clamp(self.humidity + self.rng.uniform(-1.5, 1.5), 20.0, 98.0)
        self.ph = _clamp(self.ph + self.rng.uniform(-0.03, 0.03), 4.5, 8.5)
        self.ec = _clamp(self.ec + self.rng.uniform(-0.03, 0.03), 0.2, 3.0)
        self.nitrogen = _clamp(self.nitrogen + self.rng.uniform(-0.8, 0.8), 5.0, 120.0)
        self.phosphorus = _clamp(self.phosphorus + self.rng.uniform(-0.6, 0.6), 3.0, 90.0)
        self.potassium = _clamp(self.potassium + self.rng.uniform(-2.0, 2.0), 20.0, 300.0)
        self._control_pump()

    def _control_pump(self):
        """The firmware's own irrigation logic, reproduced exactly."""
        if self.pump_mode == "manual":
            return  # the backend's override decides; applied in apply_command()
        if self.moisture < self.dry_level:
            self.pump_on = True
        elif self.moisture > self.wet_level:
            self.pump_on = False

    def payload(self) -> dict:
        readings = [
            _reading("moisture", self.moisture),
            _reading("temperature", self.temperature),
            _reading("humidity", self.humidity),
            _reading("ph", self.ph),
            _reading("ec", self.ec),
            _reading("nitrogen", self.nitrogen),
            _reading("phosphorus", self.phosphorus),
            _reading("potassium", self.potassium),
        ]
        return {"token": self.token, "readings": readings, "pump": self.pump_on}

    def apply_command(self, response: dict):
        command = (response or {}).get("command") or {}
        self.pump_mode = command.get("pump_mode", self.pump_mode)
        self.dry_level = int(command.get("dry_level") or self.dry_level)
        self.wet_level = int(command.get("wet_level") or self.wet_level)
        if self.pump_mode == "manual" and command.get("pump_on") is not None:
            self.pump_on = bool(command["pump_on"])


class Command(BaseCommand):
    help = "Stream simulated telemetry to the IoT endpoint, as a real node would."

    def add_arguments(self, parser):
        parser.add_argument(
            "--token",
            action="append",
            dest="tokens",
            help="Device token to post as. Repeatable. Defaults to the seeded nodes.",
        )
        parser.add_argument(
            "--base-url",
            default=DEFAULT_BASE_URL,
            help=f"API root (default {DEFAULT_BASE_URL}).",
        )
        parser.add_argument(
            "--interval", type=float, default=10.0, help="Seconds between posts."
        )
        parser.add_argument(
            "--once", action="store_true", help="Send one round and exit."
        )

    def handle(self, *args, **options):
        tokens = options["tokens"] or self._seeded_tokens()
        if not tokens:
            raise CommandError(
                "No device tokens. Seed demo data (manage.py seed_demo) or pass "
                "--token <tok> for a device you claimed in the app."
            )

        url = options["base_url"].rstrip("/") + "/iot/telemetry/"
        nodes = [VirtualNode(token, seed=i) for i, token in enumerate(tokens)]
        self.stdout.write(
            self.style.SUCCESS(f"Simulating {len(nodes)} node(s) -> {url}")
        )

        while True:
            for node in nodes:
                node.tick()
                self._post(url, node)
            if options["once"]:
                return
            time.sleep(options["interval"])

    @staticmethod
    def _seeded_tokens():
        from apps.farms.models import SensorNode

        return list(
            SensorNode.objects.filter(field__isnull=False)
            .exclude(token__isnull=True)
            .exclude(token="")
            .values_list("token", flat=True)
        )

    def _post(self, url: str, node: VirtualNode):
        body = json.dumps(node.payload()).encode()
        request = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as resp:
                response = json.loads(resp.read() or b"{}")
            node.apply_command(response)
            self.stdout.write(
                f"{node.token[:12]}... moisture={node.moisture:5.1f}% "
                f"pump={'ON ' if node.pump_on else 'OFF'} mode={node.pump_mode}"
            )
        except urllib.error.HTTPError as exc:
            self.stderr.write(
                self.style.ERROR(f"{node.token[:12]}... HTTP {exc.code}: {exc.read()[:200]!r}")
            )
        except OSError as exc:
            self.stderr.write(self.style.ERROR(f"{node.token[:12]}... {exc}"))


def _reading(sensor_type: str, value: float) -> dict:
    low, high = BANDS[sensor_type]
    return {
        "sensor_type": sensor_type,
        "value": round(value, 3),
        "optimal_min": low,
        "optimal_max": high,
    }


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))
