"""Reusable view mixins for the thin controller layer."""
from __future__ import annotations


class ServiceContextMixin:
    """Provides the acting user to service calls from a DRF view."""

    def acting_user(self):
        return getattr(self.request, "user", None)
