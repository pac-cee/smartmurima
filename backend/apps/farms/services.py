"""Farms business logic."""
from __future__ import annotations

from typing import Optional

from core.exceptions import NotFoundError, PermissionDeniedError
from core.services import BaseService

from .repositories import (
    CropRepository,
    FarmRepository,
    FieldRepository,
    SensorNodeRepository,
)


class FarmService(BaseService):
    def __init__(self, repo: Optional[FarmRepository] = None):
        self.repo = repo or FarmRepository()

    def list_for_user(self, user):
        return self.repo.list_for_user(user)

    def create_for_user(self, user, data: dict):
        return self.repo.create(farmer=user, **data)

    def get_owned(self, user, pk):
        farm = self.repo.get_by_id(pk)
        if farm is None:
            raise NotFoundError("Farm not found.")
        _ensure_access(user, farm.farmer)
        return farm


class FieldService(BaseService):
    def __init__(
        self,
        repo: Optional[FieldRepository] = None,
        farm_repo: Optional[FarmRepository] = None,
    ):
        self.repo = repo or FieldRepository()
        self.farm_repo = farm_repo or FarmRepository()

    def list_for_user(self, user, farm_id=None):
        qs = self.repo.list_for_user(user)
        if farm_id:
            # A specific-but-invalid id (e.g. a stale mock "f1") must yield an
            # empty result, never a 500 from int-casting a non-numeric id.
            if not str(farm_id).isdigit():
                return qs.none()
            qs = qs.filter(farm_id=int(farm_id))
        return qs

    def create_for_user(self, user, data: dict):
        farm = data.get("farm")
        if farm is None:
            raise NotFoundError("Farm is required.")
        _ensure_access(user, farm.farmer)
        return self.repo.create(**data)

    def get_owned(self, user, pk):
        field = self.repo.get_by_id(pk)
        if field is None:
            raise NotFoundError("Field not found.")
        _ensure_access(user, field.farm.farmer)
        return field


class CropService(BaseService):
    def __init__(self, repo: Optional[CropRepository] = None):
        self.repo = repo or CropRepository()

    def all(self):
        return self.repo.all()


class SensorNodeService(BaseService):
    def __init__(self, repo: Optional[SensorNodeRepository] = None):
        self.repo = repo or SensorNodeRepository()

    def list_for_user(self, user):
        return self.repo.list_for_user(user)

    def create(self, data: dict):
        return self.repo.create(**data)

    def create_for_user(self, user, data: dict):
        field = data.get("field")
        if field is None:
            raise NotFoundError("Field is required.")
        _ensure_access(user, field.farm.farmer)
        return self.repo.create(**data)


def _ensure_access(user, owner):
    if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
        return
    if owner != user:
        raise PermissionDeniedError("You do not own this resource.")
