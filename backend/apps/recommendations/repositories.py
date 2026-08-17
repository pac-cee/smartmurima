"""Recommendations repositories."""
from __future__ import annotations

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import Recommendation, RecommendationType


class RecommendationRepository(BaseRepository[Recommendation]):
    model = Recommendation

    def newest_for_field_by_type(self, field_id) -> dict:
        """Map each recommendation type -> its newest row for a field."""
        result = {}
        for rec_type in RecommendationType.values:
            rec = (
                self.get_queryset()
                .filter(field_id=field_id, type=rec_type)
                .order_by("-created_at")
                .first()
            )
            if rec is not None:
                result[rec_type] = rec
        return result

    def list_for_user(self, user, field_id=None, type=None) -> QuerySet[Recommendation]:
        qs = self.get_queryset().select_related("field", "field__farm")
        if not (user.is_superuser or user.role in ("admin", "extension", "coop_admin")):
            qs = qs.filter(field__farm__farmer=user)
        if field_id:
            qs = qs.filter(field_id=field_id)
        if type:
            qs = qs.filter(type=type)
        return qs
