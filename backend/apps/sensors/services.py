"""Sensors business logic and MQTT payload ingestion.

``IngestionService`` is deliberately decoupled from HTTP so both the MQTT
worker (``run_ingestion``) and tests can drive it directly.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from django.db import IntegrityError, transaction
from django.db.models.functions import TruncDay, TruncHour
from django.db.models import Avg, Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from core.exceptions import NotFoundError, ValidationError
from core.services import BaseService

from apps.farms.repositories import SensorNodeRepository

from .models import SensorReading
from .repositories import SensorReadingRepository

logger = logging.getLogger("smartmurima")

LOW_MOISTURE_THRESHOLD = 20.0  # % VWC below which we raise an alert


class SensorQueryService(BaseService):
    def __init__(self, repo: Optional[SensorReadingRepository] = None):
        self.repo = repo or SensorReadingRepository()

    def query(self, user, field_id=None, node_id=None, date_from=None, date_to=None,
              agg: Optional[str] = None):
        qs = self.repo.query(user, field_id, node_id, date_from, date_to)
        if agg in ("hourly", "daily"):
            return self._aggregate(qs, agg)
        return qs

    @staticmethod
    def _aggregate(qs, agg):
        trunc = TruncHour("recorded_at") if agg == "hourly" else TruncDay("recorded_at")
        rows = (
            qs.annotate(bucket=trunc)
            .values("bucket")
            .annotate(
                soil_moisture=Avg("soil_moisture"),
                temperature=Avg("temperature"),
                humidity=Avg("humidity"),
                rainfall=Sum("rainfall"),
            )
            .order_by("bucket")
        )
        return [
            {
                "recorded_at": r["bucket"],
                "soil_moisture": r["soil_moisture"],
                "temperature": r["temperature"],
                "humidity": r["humidity"],
                "rainfall": r["rainfall"],
            }
            for r in rows
        ]

    def latest_for_field(self, user, field_id):
        reading = self.repo.latest_for_field(field_id)
        return reading


class IngestionService(BaseService):
    """Validate + persist telemetry, dedupe, update node, evaluate alert rule."""

    def __init__(
        self,
        reading_repo: Optional[SensorReadingRepository] = None,
        node_repo: Optional[SensorNodeRepository] = None,
    ):
        self.reading_repo = reading_repo or SensorReadingRepository()
        self.node_repo = node_repo or SensorNodeRepository()

    @staticmethod
    def _parse_timestamp(payload: dict) -> datetime:
        # Accept "timestamp", "recorded_at", or the simulator/firmware "ts" key.
        raw = payload.get("timestamp") or payload.get("recorded_at") or payload.get("ts")
        if raw is None:
            return timezone.now()
        if isinstance(raw, (int, float)):
            return datetime.fromtimestamp(float(raw), tz=dt_timezone.utc)
        parsed = parse_datetime(str(raw))
        if parsed is None:
            raise ValidationError(f"Unparseable timestamp: {raw!r}")
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, dt_timezone.utc)
        return parsed

    def validate_payload(self, payload: dict) -> dict:
        if not isinstance(payload, dict):
            raise ValidationError("Payload must be a JSON object.")
        device_id = payload.get("device_id") or payload.get("node")
        if not device_id:
            raise ValidationError("Missing device_id.")
        if payload.get("soil_moisture") is None:
            raise ValidationError("Missing required field: soil_moisture.")
        try:
            soil = float(payload["soil_moisture"])
        except (TypeError, ValueError):
            raise ValidationError("soil_moisture must be numeric.")
        if not (0 <= soil <= 100):
            raise ValidationError("soil_moisture out of range (0-100).")
        return {
            "device_id": str(device_id),
            "soil_moisture": soil,
            "temperature": _to_float(payload.get("temperature")),
            "humidity": _to_float(payload.get("humidity")),
            "rainfall": _to_float(payload.get("rainfall")),
            "recorded_at": self._parse_timestamp(payload),
        }

    @transaction.atomic
    def ingest(self, payload: dict) -> Optional[SensorReading]:
        data = self.validate_payload(payload)
        node = self.node_repo.get_by_device_id(data["device_id"])
        if node is None:
            raise NotFoundError(f"Unknown device_id '{data['device_id']}'.")

        # Dedupe on (node, timestamp).
        if self.reading_repo.exists_for_node_time(node.id, data["recorded_at"]):
            logger.info("Duplicate reading for %s @ %s ignored",
                        node.device_id, data["recorded_at"])
            return None

        try:
            reading = self.reading_repo.create(
                sensor_node=node,
                soil_moisture=data["soil_moisture"],
                temperature=data["temperature"],
                humidity=data["humidity"],
                rainfall=data["rainfall"],
                recorded_at=data["recorded_at"],
            )
        except IntegrityError:
            logger.info("Race on duplicate reading for %s; skipping", node.device_id)
            return None

        # Update node liveness.
        self.node_repo.update(node, last_seen=data["recorded_at"])
        if payload.get("battery") is not None:
            try:
                node.battery = max(0, min(100, int(payload["battery"])))
                node.save(update_fields=["battery"])
            except (TypeError, ValueError):
                pass

        # Low-moisture alert rule.
        self._evaluate_low_moisture(node, reading)
        return reading

    def _evaluate_low_moisture(self, node, reading: SensorReading):
        if reading.soil_moisture >= LOW_MOISTURE_THRESHOLD:
            return
        try:
            from apps.alerts.services import AlertService

            owner = node.field.farm.farmer
            AlertService().raise_low_moisture(
                user=owner,
                field=node.field,
                soil_moisture=reading.soil_moisture,
            )
        except Exception as exc:  # pragma: no cover - alerting must never block ingest
            logger.error("Failed to raise low-moisture alert: %s", exc)


def _to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
