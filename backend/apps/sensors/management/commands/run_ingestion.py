"""MQTT -> DB ingestion worker.

Runs in its own container (see docker-compose service ``ingestion``). Subscribes
to ``MQTT_TOPIC`` and persists validated telemetry via ``IngestionService``.
"""
import logging

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.sensors.services import IngestionService
from core.exceptions import NotFoundError, ValidationError
from iot.mqtt_subscriber import MqttIngestionSubscriber

logger = logging.getLogger("smartmurima")


class Command(BaseCommand):
    help = "Subscribe to the MQTT telemetry topic and ingest sensor readings."

    def add_arguments(self, parser):
        parser.add_argument("--host", default=settings.MQTT_HOST)
        parser.add_argument("--port", type=int, default=settings.MQTT_PORT)
        parser.add_argument("--topic", default=settings.MQTT_TOPIC)

    def handle(self, *args, **options):
        service = IngestionService()

        def on_payload(payload: dict):
            # Ingestion must never crash the long-running worker: unknown
            # devices and malformed payloads are logged and skipped.
            try:
                reading = service.ingest(payload)
            except NotFoundError as exc:
                logger.warning("Skipping telemetry from unknown device: %s", exc)
                return
            except ValidationError as exc:
                logger.warning("Skipping invalid telemetry payload: %s", exc)
                return
            except Exception as exc:  # pragma: no cover - defensive catch-all
                logger.error("Unexpected ingestion error: %s", exc)
                return
            if reading is not None:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Ingested reading node={reading.sensor_node_id} "
                        f"soil={reading.soil_moisture}"
                    )
                )

        subscriber = MqttIngestionSubscriber(
            host=options["host"],
            port=options["port"],
            topic=options["topic"],
            on_payload=on_payload,
        )
        self.stdout.write(
            self.style.NOTICE(
                f"Starting MQTT ingestion on {options['host']}:{options['port']} "
                f"topic={options['topic']}"
            )
        )
        try:
            subscriber.run_forever()
        except KeyboardInterrupt:
            self.stdout.write("Shutting down ingestion worker.")
            subscriber.stop()
