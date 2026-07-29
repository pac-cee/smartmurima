"""Base service class.

Services hold business logic and orchestration. They depend on repositories,
ml/, rag/, iot/ helpers -- never on the HTTP layer. Fully unit-testable.
"""
from __future__ import annotations

import logging


class BaseService:
    """Common conveniences for domain services."""

    logger = logging.getLogger("smartmurima")
