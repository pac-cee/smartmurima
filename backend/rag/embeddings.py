"""Embedding service wrapping the Ollama embed endpoint.

Provides a deterministic fallback embedding (hash-based) so ingestion and
similarity search remain functional in tests / when Ollama is offline. The
fallback is clearly not semantic -- it only keeps the pipeline runnable.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Optional

from django.conf import settings

from .client import OllamaClient

logger = logging.getLogger("smartmurima")


class EmbeddingService:
    def __init__(self, client: Optional[OllamaClient] = None, dim: Optional[int] = None):
        self.client = client or OllamaClient()
        self.dim = dim or int(getattr(settings, "EMBED_DIM", 768))

    def embed(self, text: str) -> list[float]:
        vec = self.client.embed(text)
        if vec is not None and len(vec) == self.dim:
            return vec
        if vec is not None and len(vec) != self.dim:
            logger.warning(
                "Embedding dim mismatch (%s != %s); using fallback.",
                len(vec),
                self.dim,
            )
        return self._fallback(text)

    def _fallback(self, text: str) -> list[float]:
        """Deterministic pseudo-embedding derived from token hashes."""
        vec = [0.0] * self.dim
        for token in text.lower().split():
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dim
            vec[idx] += 1.0
        norm = sum(v * v for v in vec) ** 0.5
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec
