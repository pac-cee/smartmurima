"""Assistant routes, mounted under /api/v1/assistant/."""
from django.urls import path

from .views import (
    ChatSessionViewSet,
    ChatStreamView,
    ChatView,
    DocumentViewSet,
)

app_name = "assistant"

sessions_list = ChatSessionViewSet.as_view({"get": "list", "post": "create"})
sessions_detail = ChatSessionViewSet.as_view({"get": "retrieve", "delete": "destroy"})
sessions_messages = ChatSessionViewSet.as_view({"get": "messages"})
documents_list = DocumentViewSet.as_view({"get": "list", "post": "create"})
documents_detail = DocumentViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
documents_reembed = DocumentViewSet.as_view({"post": "reembed"})

urlpatterns = [
    path("sessions", sessions_list, name="sessions"),
    path("sessions/<int:pk>", sessions_detail, name="session-detail"),
    path("sessions/<int:pk>/messages", sessions_messages, name="session-messages"),
    path("chat", ChatView.as_view(), name="chat"),
    path("chat/stream", ChatStreamView.as_view(), name="chat-stream"),
    path("documents", documents_list, name="documents"),
    path("documents/reembed", documents_reembed, name="documents-reembed"),
    path("documents/<int:pk>", documents_detail, name="document-detail"),
]
