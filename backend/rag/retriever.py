"""Retriever: embed a query and fetch the nearest knowledge chunks."""
from __future__ import annotations

from typing import Optional

from django.conf import settings

from .embeddings import EmbeddingService
from .store import PgVectorStore


class Retriever:
    def __init__(
        self,
        embedder: Optional[EmbeddingService] = None,
        store: Optional[PgVectorStore] = None,
    ):
        self.embedder = embedder or EmbeddingService()
        self.store = store or PgVectorStore()

    def similarity_search(self, query: str, k: Optional[int] = None) -> list[dict]:
        k = k or int(getattr(settings, "RAG_TOP_K", 4))
        embedding = self.embedder.embed(query)
        docs = self.store.similarity_search(embedding, k=k)
        results = []
        for i, doc in enumerate(docs, start=1):
            snippet = doc.content[:500]
            results.append(
                {
                    "n": i,
                    "title": doc.title,
                    "ref": f"{doc.source}#{doc.chunk_index}",
                    "snippet": snippet,
                    "content": doc.content,
                }
            )
        return results
