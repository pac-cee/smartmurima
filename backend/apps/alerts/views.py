from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import ListModelMixin

from .models import Alert
from .serializers import AlertSerializer
from .services import AlertService


class AlertViewSet(ListModelMixin, GenericViewSet):
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    queryset = Alert.objects.none()

    def get_queryset(self):
        unread = self.request.query_params.get("unread") in ("true", "1", "yes")
        return AlertService().list_for_user(self.request.user, unread_only=unread)

    @extend_schema(parameters=[OpenApiParameter("unread", bool)])
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        alert = AlertService().mark_read(request.user, pk)
        return Response(AlertSerializer(alert).data)
