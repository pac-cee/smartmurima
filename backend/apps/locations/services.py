"""Locations business logic."""
from __future__ import annotations

from typing import Optional

from core.services import BaseService

from .repositories import LocationRepository


class LocationService(BaseService):
    def __init__(self, repo: Optional[LocationRepository] = None):
        self.repo = repo or LocationRepository()

    def list(self, level=None, parent_id=None, search=None):
        return self.repo.query(level=level, parent_id=parent_id, search=search)
