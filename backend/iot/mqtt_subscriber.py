"""MQTT subscriber that feeds telemetry into the IngestionService.

Kept import-light at module load: ``paho-mqtt`` is only imported when the
subscriber actually runs, so the web process can import this module freely.
"""
from __future__ import annotations

import json
import logging
from typing import Callable, Optional

logger = logging.getLogger("smartmurima")


class MqttIngestionSubscriber:
    def __init__(
        self,
        host: str,
        port: int,
        topic: str,
        on_payload: Callable[[dict], None],
        client_id: str = "smartmurima-ingestion",
    ):
        self.host = host
        self.port = port
        self.topic = topic
        self.on_payload = on_payload
        self.client_id = client_id
        self._client = None

    def _build_client(self):
        import paho.mqtt.client as mqtt

        try:
            client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2, client_id=self.client_id
            )
        except (AttributeError, TypeError):  # paho < 2.0 fallback
            client = mqtt.Client(client_id=self.client_id)
        client.on_connect = self._on_connect
        client.on_message = self._on_message
        return client

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        logger.info("MQTT connected (rc=%s); subscribing to %s", reason_code, self.topic)
        client.subscribe(self.topic)

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            logger.warning("Discarding malformed MQTT message on %s: %s", msg.topic, exc)
            return
        # Allow the topic to carry the device id: smartmurima/<device_id>/telemetry
        if "device_id" not in payload and "node" not in payload:
            parts = msg.topic.split("/")
            if len(parts) >= 2:
                payload["device_id"] = parts[1]
        try:
            self.on_payload(payload)
        except Exception as exc:  # pragma: no cover - never kill the loop
            logger.error("Ingestion error for %s: %s", msg.topic, exc)

    def run_forever(self):
        self._client = self._build_client()
        logger.info("Connecting to MQTT %s:%s", self.host, self.port)
        self._client.connect(self.host, self.port, keepalive=60)
        self._client.loop_forever()

    def stop(self):  # pragma: no cover - lifecycle helper
        if self._client is not None:
            self._client.disconnect()
