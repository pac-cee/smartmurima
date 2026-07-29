"""Assistant controllers, including the SSE streaming endpoint."""
from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import DefaultPagination
from core.permissions import IsAdmin

from .models import ChatSession, KnowledgeDocument
from .serializers import (
    ChatMessageSerializer,
    ChatRequestSerializer,
    ChatResponseSerializer,
    ChatSessionSerializer,
    KnowledgeDocumentSerializer,
    KnowledgeIngestSerializer,
)
from .services import AssistantService, KnowledgeService


class ChatSessionViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSessionSerializer
    permission_classes = [IsAuthenticated]
    queryset = ChatSession.objects.none()  # schema placeholder; see get_queryset
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        return AssistantService().list_sessions(self.request.user)

    def perform_create(self, serializer):
        session = AssistantService().create_session(
            self.request.user, title=serializer.validated_data.get("title", "")
        )
        serializer.instance = session

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        qs = AssistantService().list_messages(request.user, pk)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        data = ChatMessageSerializer(page, many=True).data
        return paginator.get_paginated_response(data)


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChatRequestSerializer, responses=ChatResponseSerializer)
    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = AssistantService().answer(
            request.user,
            question=data["question"],
            session_id=data.get("session"),
            language=data.get("language", ""),
        )
        return Response(result)


class ChatStreamView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=ChatRequestSerializer)
    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        stream = AssistantService().stream_answer(
            request.user,
            question=data["question"],
            session_id=data.get("session"),
            language=data.get("language", ""),
        )
        response = StreamingHttpResponse(stream, content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class DocumentViewSet(viewsets.ModelViewSet):
    """Knowledge base management (admin). Mounted at /assistant/documents and
    also under /admin-api/documents.
    """

    serializer_class = KnowledgeDocumentSerializer
    permission_classes = [IsAdmin]
    queryset = KnowledgeDocument.objects.all()

    def create(self, request, *args, **kwargs):
        serializer = KnowledgeIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        count = KnowledgeService().ingest_document(
            title=serializer.validated_data["title"],
            source=serializer.validated_data.get("source", ""),
            content=serializer.validated_data["content"],
        )
        return Response(
            {"detail": f"Ingested {count} chunks.", "chunks": count},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="reembed")
    def reembed(self, request):
        count = KnowledgeService().reembed_all()
        return Response({"detail": f"Re-embedded {count} chunks.", "chunks": count})
