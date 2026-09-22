"""Sensors business logic and device telemetry ingestion.

``IngestionService`` is deliberately decoupled from HTTP so the IoT endpoints,
the simulator command, and tests can all drive it directly.
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

from core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
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
        # Ignore non-numeric ids (e.g. a stale mock "f1") instead of 500-ing.
        field_id = int(field_id) if field_id and str(field_id).isdigit() else None
        node_id = int(node_id) if node_id and str(node_id).isdigit() else None
        qs = self.repo.query(user, field_id, node_id, date_from, date_to)
        if agg in ("hourly", "daily"):
            return self._aggregate(qs, agg)
        return qs

    # Averaged over the bucket; rainfall is the one channel that accumulates.
    AVG_CHANNELS = (
        "soil_moisture",
        "temperature",
        "humidity",
        "ph",
        "ec",
        "nitrogen",
        "phosphorus",
        "potassium",
    )

    @classmethod
    def _aggregate(cls, qs, agg):
        trunc = TruncHour("recorded_at") if agg == "hourly" else TruncDay("recorded_at")
        aggregates = {name: Avg(name) for name in cls.AVG_CHANNELS}
        aggregates["rainfall"] = Sum("rainfall")
        rows = (
            qs.annotate(bucket=trunc)
            .values("bucket")
            .annotate(**aggregates)
            .order_by("bucket")
        )
        return [
            {"recorded_at": r["bucket"], **{k: r[k] for k in aggregates}}
            for r in rows
        ]

    def latest_for_field(self, user, field_id):
        if not (field_id and str(field_id).isdigit()):
            return None
        reading = self.repo.latest_for_field(int(field_id))
        return reading


# The firmware posts a list of typed readings; map each ``sensor_type`` onto the
# column it lands in. Types we have no column for are ignored, not rejected --
# a newer board must never 400 against an older backend.
SENSOR_TYPE_TO_FIELD = {
    "moisture": "soil_moisture",
    "soil_moisture": "soil_moisture",
    "temperature": "temperature",
    "humidity": "humidity",
    "rainfall": "rainfall",
    "ph": "ph",
    "ec": "ec",
    "nitrogen": "nitrogen",
    "phosphorus": "phosphorus",
    "potassium": "potassium",
}

READING_COLUMNS = (
    "soil_moisture",
    "temperature",
    "humidity",
    "rainfall",
    "ph",
    "ec",
    "nitrogen",
    "phosphorus",
    "potassium",
)


def flatten_readings(payload: dict) -> dict:
    """Fold the firmware's ``readings`` array into flat column values.

    ``{"readings": [{"sensor_type": "moisture", "value": 31.2}, ...]}``
    becomes ``{"soil_moisture": 31.2, ...}``. Flat keys already present in the
    payload win, so the simulator's simpler shape keeps working unchanged.
    """
    flat = {}
    for item in payload.get("readings") or []:
        if not isinstance(item, dict):
            continue
        column = SENSOR_TYPE_TO_FIELD.get(str(item.get("sensor_type", "")).lower())
        if column is None:
            continue
        value = _to_float(item.get("value"))
        if value is not None:
            flat[column] = value
    for column in READING_COLUMNS:
        if payload.get(column) is not None:
            flat[column] = payload[column]
    return flat


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
        values = flatten_readings(payload)
        soil = _to_float(values.get("soil_moisture"))
        if soil is None:
            raise ValidationError("Missing required reading: soil moisture.")
        if not (0 <= soil <= 100):
            raise ValidationError("soil_moisture out of range (0-100).")
        data = {column: _to_float(values.get(column)) for column in READING_COLUMNS}
        data["soil_moisture"] = soil
        data["device_id"] = str(device_id)
        data["recorded_at"] = self._parse_timestamp(payload)
        return data

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
                recorded_at=data["recorded_at"],
                **{column: data[column] for column in READING_COLUMNS},
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

    def ingest_from_device(self, payload: dict) -> dict:
        """Handle one telemetry POST from a field device.

        The device authenticates with its own ``token`` (it has no user
        session), so this resolves the node itself rather than trusting a
        ``device_id`` in the body. Returns the command block the firmware
        applies to its pump on the way out.
        """
        if not isinstance(payload, dict):
            raise ValidationError("Payload must be a JSON object.")
        token = str(payload.get("token") or "").strip()
        if not token:
            raise ValidationError("Missing device token.")
        node = self.node_repo.get_by_token(token)
        if node is None:
            raise PermissionDeniedError("Unrecognised device token.")
        if not node.is_claimed:
            raise PermissionDeniedError(
                "This device is not assigned to a field yet."
            )

        # The device knows itself by token; fill in the id ingest() expects.
        self.ingest({**payload, "device_id": node.device_id})

        # Record what the pump is actually doing, then hand back what it should
        # be doing. Reported state is separate from the commanded state so the
        # dashboard can show a manual override that has not landed yet.
        reported = payload.get("pump")
        if isinstance(reported, bool) and reported != node.pump_state:
            self.node_repo.update(node, pump_state=reported)
        return command_for(node)

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


def command_for(node) -> dict:
    """The control block every telemetry response carries back to the device.

    ``pump_on`` is null in auto mode -- that is the firmware's signal to fall
    back to its own moisture thresholds instead of obeying an override.
    """
    return {
        "command": {
            "pump_mode": node.pump_mode,
            "pump_on": node.pump_on if node.pump_mode == "manual" else None,
            "dry_level": node.dry_level,
            "wet_level": node.wet_level,
        }
    }
