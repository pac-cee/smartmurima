"""Assistant ORM: ChatSession, ChatMessage, KnowledgeDocument (pgvector).

The ``embedding`` column is a pgvector VECTOR(EMBED_DIM). An HNSW index for
cosine distance is added in the migration.
"""
from django.conf import settings
from django.db import models
from pgvector.django import VectorField

EMBED_DIM = int(getattr(settings, "EMBED_DIM", 768))


class ChatSession(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=255, blank=True, default="New conversation")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_chat_session"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Session<{self.id}:{self.user_id}>"

    @property
    def owner_user(self):
        return self.user


class MessageRole(models.TextChoices):
    USER = "user", "User"
    ASSISTANT = "assistant", "Assistant"


class ChatMessage(models.Model):
    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=12, choices=MessageRole.choices)
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_chat_message"
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(role__in=[c[0] for c in MessageRole.choices]),
                name="message_role_valid",
            ),
        ]

    def __str__(self):
        return f"Msg<{self.role}:{self.session_id}>"


class KnowledgeDocument(models.Model):
    """A single embedded chunk of a source document (RAB/MINAGRI, etc.)."""

    title = models.CharField(max_length=255)
    source = models.CharField(max_length=255, blank=True, default="")
    content = models.TextField()
    chunk_index = models.PositiveIntegerField(default=0)
    embedding = VectorField(dimensions=EMBED_DIM, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assistant_knowledge_document"
        ordering = ["source", "chunk_index"]
        indexes = [
            models.Index(fields=["source", "chunk_index"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["source", "chunk_index"],
                name="knowledge_source_chunk_unique",
            ),
        ]

    def __str__(self):
        return f"{self.title} [chunk {self.chunk_index}]"
