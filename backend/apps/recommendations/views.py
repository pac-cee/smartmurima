from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import ListModelMixin

from .models import Recommendation
from .serializers import RecommendationSerializer, RunRecommendationSerializer
from .services import RecommendationService


class RecommendationViewSet(ListModelMixin, GenericViewSet):
    serializer_class = RecommendationSerializer
    permission_classes = [IsAuthenticated]
    queryset = Recommendation.objects.none()

    def get_queryset(self):
        params = self.request.query_params
        return RecommendationService().list_for_user(
            self.request.user,
            field_id=params.get("field"),
            type=params.get("type"),
        )

    @extend_schema(
        parameters=[OpenApiParameter("field", int), OpenApiParameter("type", str)]
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def _run(self, request, method_name):
        serializer = RunRecommendationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        method = getattr(RecommendationService(), method_name)
        rec = method(request.user, serializer.validated_data["field"])
        return Response(
            RecommendationSerializer(rec).data, status=status.HTTP_201_CREATED
        )

    @extend_schema(request=RunRecommendationSerializer, responses=RecommendationSerializer)
    @action(detail=False, methods=["post"])
    def irrigation(self, request):
        return self._run(request, "irrigation")

    @extend_schema(request=RunRecommendationSerializer, responses=RecommendationSerializer)
    @action(detail=False, methods=["post"])
    def fertilizer(self, request):
        return self._run(request, "fertilizer")

    @extend_schema(request=RunRecommendationSerializer, responses=RecommendationSerializer)
    @action(detail=False, methods=["post"], url_path="yield")
    def yield_estimate(self, request):
        return self._run(request, "yield_estimate")
