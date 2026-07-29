"""Assistant repositories, including the pgvector similarity search."""
from __future__ import annotations

from typing import Optional

from django.db.models import QuerySet

from core.repositories import BaseRepository

from .models import ChatMessage, ChatSession, KnowledgeDocument


class ChatSessionRepository(BaseRepository[ChatSession]):
    model = ChatSession

    def list_for_user(self, user) -> QuerySet[ChatSession]:
        return self.get_queryset().filter(user=user)


class ChatMessageRepository(BaseRepository[ChatMessage]):
    model = ChatMessage

    def for_session(self, session_id) -> QuerySet[ChatMessage]:
        return self.get_queryset().filter(session_id=session_id)


class KnowledgeDocumentRepository(BaseRepository[KnowledgeDocument]):
    model = KnowledgeDocument

    def similarity_search(self, embedding, k: int = 4) -> list[KnowledgeDocument]:
        """Return the k nearest chunks by cosine distance (pgvector ``<=>``)."""
        if embedding is None:
            return list(self.get_queryset()[:k])
        from pgvector.django import CosineDistance

        return list(
            self.get_queryset()
            .exclude(embedding__isnull=True)
            .annotate(distance=CosineDistance("embedding", embedding))
            .order_by("distance")[:k]
        )

    def upsert_chunk(
        self,
        title: str,
        source: str,
        content: str,
        chunk_index: int,
        embedding,
    ) -> KnowledgeDocument:
        obj, _created = self.model.objects.update_or_create(
            source=source,
            chunk_index=chunk_index,
            defaults={
                "title": title,
                "content": content,
                "embedding": embedding,
            },
        )
        return obj

    def clear_source(self, source: str) -> int:
        return self.get_queryset().filter(source=source).delete()[0]
