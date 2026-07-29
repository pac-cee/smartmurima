"""Sensors repositories."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import SensorReading


class SensorReadingRepository(BaseRepository[SensorReading]):
    model = SensorReading

    def base_for_user(self, user) -> QuerySet[SensorReading]:
        qs = self.get_queryset().select_related(
            "sensor_node", "sensor_node__field", "sensor_node__field__farm"
        )
        if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
            return qs
        return qs.filter(sensor_node__field__farm__farmer=user)

    def query(
        self,
        user,
        field_id=None,
        node_id=None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> QuerySet[SensorReading]:
        qs = self.base_for_user(user)
        if field_id:
            qs = qs.filter(sensor_node__field_id=field_id)
        if node_id:
            qs = qs.filter(sensor_node_id=node_id)
        if date_from:
            qs = qs.filter(recorded_at__gte=date_from)
        if date_to:
            qs = qs.filter(recorded_at__lte=date_to)
        return qs

    def latest_for_field(self, field_id) -> Optional[SensorReading]:
        return (
            self.get_queryset()
            .filter(sensor_node__field_id=field_id)
            .order_by("-recorded_at")
            .first()
        )

    def recent_for_field(self, field_id, since: datetime) -> QuerySet[SensorReading]:
        return (
            self.get_queryset()
            .filter(sensor_node__field_id=field_id, recorded_at__gte=since)
            .order_by("recorded_at")
        )

    def exists_for_node_time(self, node_id, recorded_at) -> bool:
        return self.exists(sensor_node_id=node_id, recorded_at=recorded_at)
