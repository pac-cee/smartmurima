"""Vector store abstraction.

The concrete persistence lives in ``apps.assistant.repositories`` (the only
ORM-touching layer). ``PgVectorStore`` adapts that repository to the retriever
so ``rag/`` stays independent of Django app internals at import time.
"""
from __future__ import annotations

from typing import Optional, Protocol


class VectorStore(Protocol):
    def similarity_search(self, embedding, k: int) -> list: ...


class PgVectorStore:
    def __init__(self, repository=None):
        if repository is None:
            from apps.assistant.repositories import KnowledgeDocumentRepository

            repository = KnowledgeDocumentRepository()
        self.repository = repository

    def similarity_search(self, embedding, k: int = 4) -> list:
        return self.repository.similarity_search(embedding, k=k)
