"""Alerts repositories."""
from __future__ import annotations

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import Alert


class AlertRepository(BaseRepository[Alert]):
    model = Alert

    def list_for_user(self, user, unread_only: bool = False) -> QuerySet[Alert]:
        qs = self.get_queryset()
        if not (user.is_superuser or user.role == "admin"):
            qs = qs.filter(user=user)
        if unread_only:
            qs = qs.filter(is_read=False)
        return qs

    def mark_read(self, alert: Alert) -> Alert:
        return self.update(alert, is_read=True)

    def recent_of_type(self, user, type: str, since) -> QuerySet[Alert]:
        """Alerts of a given type for a user raised at/after ``since``.

        Field scoping is applied in the service layer (against ``context``) so
        the cooldown check stays database-agnostic (no JSON key lookups).
        """
        return self.get_queryset().filter(
            user=user, type=type, created_at__gte=since
        )
