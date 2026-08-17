"""Django admin registrations for the assistant domain.

The pgvector ``embedding`` column is intentionally never exposed in any
editable form or list view -- it is large, opaque, and not human-editable.
"""
from django.contrib import admin

from .models import ChatMessage, ChatSession, KnowledgeDocument


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("title", "user__username", "user__full_name", "user__email")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at",)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "session", "role", "short_content", "created_at")
    list_filter = ("role", "created_at")
    search_fields = ("content", "session__title")
    ordering = ("created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("session",)
    readonly_fields = ("created_at",)

    @admin.display(description="Content")
    def short_content(self, obj):
        text = obj.content or ""
        return text[:80] + ("..." if len(text) > 80 else "")


@admin.register(KnowledgeDocument)
class KnowledgeDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "source", "chunk_index", "created_at")
    list_filter = ("source",)
    search_fields = ("title", "source", "content")
    ordering = ("source", "chunk_index")
    readonly_fields = ("created_at",)
    # Never surface the pgvector embedding in an editable form.
    exclude = ("embedding",)
