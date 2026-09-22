"""Farms business logic."""
from __future__ import annotations

import secrets
from typing import Optional

from django.db import transaction
from django.utils import timezone

from core.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
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
    """Field devices: discovery, claiming, and irrigation control."""

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

    # -- device pairing ---------------------------------------------------
    @staticmethod
    def _mint_token() -> str:
        return secrets.token_urlsafe(32)[:48]

    def _unique_device_id(self, hardware_id: str) -> str:
        """A short, human-readable id derived from the hardware id."""
        base = f"SM-{hardware_id[-6:].upper()}" if hardware_id else "SM-NODE"
        candidate, i = base, 0
        while self.repo.exists(device_id=candidate):
            i += 1
            candidate = f"{base}-{i}"
        return candidate

    @transaction.atomic
    def announce(self, hardware_id: str, name: str = "") -> dict:
        """Heartbeat from an unpaired (or re-booted) board.

        Registers the device on first contact, then answers with its token once
        a farmer has claimed it -- that hand-back is what lets the board start
        sending telemetry without ever being re-flashed.
        """
        hardware_id = (hardware_id or "").strip()
        if not hardware_id:
            raise ValidationError("hardware_id is required.")

        node = self.repo.get_by_hardware_id(hardware_id)
        if node is None:
            node = self.repo.create(
                hardware_id=hardware_id,
                device_id=self._unique_device_id(hardware_id),
                name=(name or "").strip()[:120],
                field=None,
            )
        elif name and node.name != name.strip()[:120]:
            node = self.repo.update(node, name=name.strip()[:120])

        self.repo.update(node, last_seen=timezone.now())

        if node.is_claimed and node.token:
            return {
                "status": "claimed",
                "device_id": node.device_id,
                "token": node.token,
                "detail": "Device paired. Start sending telemetry.",
            }
        return {
            "status": "pending",
            "device_id": node.device_id,
            "detail": "Registered. Claim this device in the app to pair it.",
        }

    @transaction.atomic
    def claim(self, user, node, field):
        """Attach a discovered device to one of the caller's fields."""
        if field is None:
            raise ValidationError("A field is required to claim a device.")
        _ensure_access(user, field.farm.farmer)
        if node.is_claimed and node.field_id != field.id:
            raise ConflictError("This device is already paired to another field.")
        return self.repo.update(
            node,
            field=field,
            token=node.token or self._mint_token(),
            status="active",
        )

    @transaction.atomic
    def release(self, user, node):
        """Unpair a device: it returns to the discovery list, token revoked."""
        self._ensure_node_access(user, node)
        return self.repo.update(node, field=None, token=None, pump_mode="auto",
                                pump_on=None)

    def set_pump(self, user, node, mode: str, on: Optional[bool] = None):
        """Set the irrigation override the device picks up on its next POST."""
        self._ensure_node_access(user, node)
        if mode not in ("auto", "manual"):
            raise ValidationError("pump_mode must be 'auto' or 'manual'.")
        # Leaving auto mode clears the override so the device goes back to
        # deciding from soil moisture.
        return self.repo.update(
            node, pump_mode=mode, pump_on=bool(on) if mode == "manual" else None
        )

    def set_thresholds(self, user, node, dry_level: int, wet_level: int):
        self._ensure_node_access(user, node)
        if not (0 <= dry_level < wet_level <= 100):
            raise ValidationError(
                "Thresholds must satisfy 0 <= dry_level < wet_level <= 100."
            )
        return self.repo.update(node, dry_level=dry_level, wet_level=wet_level)

    @staticmethod
    def _ensure_node_access(user, node):
        if not node.is_claimed:
            raise ValidationError("Claim this device to a field first.")
        _ensure_access(user, node.field.farm.farmer)


def _ensure_access(user, owner):
    if user.is_superuser or user.role in ("admin", "extension", "coop_admin"):
        return
    if owner != user:
        raise PermissionDeniedError("You do not own this resource.")
