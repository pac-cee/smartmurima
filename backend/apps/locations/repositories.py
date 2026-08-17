"""Locations repositories -- the only place touching the locations ORM."""
from __future__ import annotations

from typing import Optional

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import Location


class LocationRepository(BaseRepository[Location]):
    model = Location

    def query(
        self,
        level: Optional[str] = None,
        parent_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> QuerySet[Location]:
        qs = self.get_queryset().select_related("parent")
        if level:
            qs = qs.filter(level=level)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs
