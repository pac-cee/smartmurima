"""Farms repositories."""
from __future__ import annotations

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import Crop, Farm, Field, SensorNode


class CropRepository(BaseRepository[Crop]):
    model = Crop


class FarmRepository(BaseRepository[Farm]):
    model = Farm

    def list_for_user(self, user) -> QuerySet[Farm]:
        qs = self.get_queryset().select_related("farmer")
        if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
            return qs
        return qs.filter(farmer=user)


class FieldRepository(BaseRepository[Field]):
    model = Field

    def list_for_user(self, user) -> QuerySet[Field]:
        qs = self.get_queryset().select_related("farm", "farm__farmer", "crop")
        if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
            return qs
        return qs.filter(farm__farmer=user)

    def for_farm(self, farm_id) -> QuerySet[Field]:
        return self.get_queryset().filter(farm_id=farm_id)


class SensorNodeRepository(BaseRepository[SensorNode]):
    model = SensorNode

    def list_for_user(self, user) -> QuerySet[SensorNode]:
        qs = self.get_queryset().select_related("field", "field__farm")
        if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
            return qs
        return qs.filter(field__farm__farmer=user)

    def get_by_device_id(self, device_id: str):
        return self.get_or_none(device_id=device_id)
