"""Diseases repositories."""
from __future__ import annotations

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import DiseaseReport


class DiseaseReportRepository(BaseRepository[DiseaseReport]):
    model = DiseaseReport

    def list_for_user(self, user, field_id=None) -> QuerySet[DiseaseReport]:
        qs = self.get_queryset().select_related("field", "field__farm")
        if not (user.is_superuser or user.role in ("admin", "extension", "coop_admin")):
            qs = qs.filter(field__farm__farmer=user)
        if field_id:
            qs = qs.filter(field_id=field_id)
        return qs
