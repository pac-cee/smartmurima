"""Alerts business logic + a small rules engine.

Rules engine (FR-08 / UC-22):

* Four alert types are raised: ``low_moisture``, ``disease_risk``, ``weather``,
  ``system``.
* Every rule honours a per-``(field, type)`` cooldown (BR-AL1) so repeated
  triggers within ``ALERT_COOLDOWN_SECONDS`` (env, default 3600s) are
  suppressed instead of spamming the user. ``system`` alerts with no field are
  de-duplicated per ``(user, type)`` only.
* Alerts are always scoped to the owning/served user (BR-AL2).

``evaluate_low_moisture`` is the importable entry point for the sensors
ingestion pipeline (UC-11 step 4). ``apps.sensors`` must not import ORM/service
internals beyond this function.
"""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.utils import timezone

from core.exceptions import NotFoundError, PermissionDeniedError
from core.services import BaseService

from .models import Alert, AlertType, Severity
from .repositories import AlertRepository


def _cooldown_seconds() -> int:
    return int(getattr(settings, "ALERT_COOLDOWN_SECONDS", 3600))


class AlertService(BaseService):
    def __init__(self, repo: Optional[AlertRepository] = None):
        self.repo = repo or AlertRepository()

    def list_for_user(self, user, unread_only: bool = False):
        return self.repo.list_for_user(user, unread_only=unread_only)

    def create(
        self,
        user,
        type: str,
        message: str,
        severity: str = Severity.INFO,
        context: Optional[dict] = None,
    ) -> Alert:
        return self.repo.create(
            user=user,
            type=type,
            message=message,
            severity=severity,
            context=context or {},
        )

    def mark_read(self, user, alert_id) -> Alert:
        alert = self.repo.get_by_id(alert_id)
        if alert is None:
            raise NotFoundError("Alert not found.")
        if alert.user_id != user.id and not (
            user.is_superuser or user.role == "admin"
        ):
            raise PermissionDeniedError("Not your alert.")
        return self.repo.mark_read(alert)

    # -- cooldown ---------------------------------------------------------
    def _within_cooldown(self, user, type: str, field_id, cooldown: int) -> bool:
        if cooldown <= 0:
            return False
        since = timezone.now() - timedelta(seconds=cooldown)
        for alert in self.repo.recent_of_type(user, type, since):
            existing_field = (alert.context or {}).get("field_id")
            if field_id is None or existing_field == field_id:
                return True
        return False

    def _raise(
        self,
        user,
        type: str,
        message: str,
        severity: str,
        field_id=None,
        context: Optional[dict] = None,
        cooldown: Optional[int] = None,
    ) -> Optional[Alert]:
        """Create an alert unless an equivalent one is within cooldown.

        Returns the new ``Alert`` or ``None`` when suppressed.
        """
        cd = _cooldown_seconds() if cooldown is None else cooldown
        if self._within_cooldown(user, type, field_id, cd):
            return None
        ctx = dict(context or {})
        if field_id is not None:
            ctx.setdefault("field_id", field_id)
        return self.create(
            user=user, type=type, message=message, severity=severity, context=ctx
        )

    # -- rules engine -----------------------------------------------------
    def raise_low_moisture(self, user, field, soil_moisture: float) -> Optional[Alert]:
        message = (
            f"Low soil moisture ({soil_moisture:.1f}%) detected in field "
            f"'{field.name}'. Consider irrigating."
        )
        return self._raise(
            user=user,
            type=AlertType.LOW_MOISTURE,
            message=message,
            severity=Severity.WARNING,
            field_id=field.id,
            context={"soil_moisture": soil_moisture},
        )

    def raise_disease_risk(
        self, user, field, disease: str, confidence: float
    ) -> Optional[Alert]:
        message = (
            f"Possible {disease} detected in field '{field.name}' "
            f"(confidence {confidence:.0%})."
        )
        return self._raise(
            user=user,
            type=AlertType.DISEASE_RISK,
            message=message,
            severity=Severity.CRITICAL,
            field_id=field.id,
            context={"disease": disease, "confidence": confidence},
        )

    def raise_weather(
        self,
        user,
        field=None,
        summary: str = "",
        severity: str = Severity.WARNING,
        context: Optional[dict] = None,
    ) -> Optional[Alert]:
        where = f" for field '{field.name}'" if field is not None else ""
        message = summary or f"Adverse weather expected{where}."
        return self._raise(
            user=user,
            type=AlertType.WEATHER,
            message=message,
            severity=severity,
            field_id=getattr(field, "id", None),
            context=context,
        )

    def raise_system(
        self,
        user,
        message: str,
        severity: str = Severity.INFO,
        context: Optional[dict] = None,
    ) -> Optional[Alert]:
        return self._raise(
            user=user,
            type=AlertType.SYSTEM,
            message=message,
            severity=severity,
            field_id=None,
            context=context,
        )


# ---------------------------------------------------------------------------
# Importable rule entry points (for other apps' pipelines)
# ---------------------------------------------------------------------------
def evaluate_low_moisture(
    user, field, soil_moisture, threshold: Optional[float] = None
) -> Optional[Alert]:
    """Low-moisture rule for the sensors ingestion worker (UC-11 → UC-22).

    Import this from ``apps.sensors`` instead of reaching into ORM/service
    internals::

        from apps.alerts.services import evaluate_low_moisture
        evaluate_low_moisture(node.field.farm.farmer, node.field, reading.soil_moisture)

    Returns the raised ``Alert``, or ``None`` if moisture is above threshold or
    the alert is within its per-(field, type) cooldown.
    """
    thr = (
        threshold
        if threshold is not None
        else float(getattr(settings, "LOW_MOISTURE_ALERT_THRESHOLD", 20.0))
    )
    if soil_moisture is None or soil_moisture >= thr:
        return None
    return AlertService().raise_low_moisture(user, field, soil_moisture)
