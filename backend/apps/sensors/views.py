"""Sensors controllers. Ingestion is internal (MQTT), so these are read-only."""
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from django.utils.dateparse import parse_datetime

from core.pagination import DefaultPagination

from .serializers import AggregatedReadingSerializer, SensorReadingSerializer
from .services import SensorQueryService


class SensorReadingViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("field", int),
            OpenApiParameter("node", int),
            OpenApiParameter("from", str),
            OpenApiParameter("to", str),
            OpenApiParameter("agg", str, description="hourly|daily"),
        ],
        responses=SensorReadingSerializer(many=True),
    )
    def list(self, request):
        params = request.query_params
        agg = params.get("agg")
        result = SensorQueryService().query(
            request.user,
            field_id=params.get("field"),
            node_id=params.get("node"),
            date_from=_dt(params.get("from")),
            date_to=_dt(params.get("to")),
            agg=agg,
        )
        if agg in ("hourly", "daily"):
            data = AggregatedReadingSerializer(result, many=True).data
            return Response(
                {"count": len(data), "next": None, "previous": None, "results": data}
            )
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(result, request, view=self)
        data = SensorReadingSerializer(page, many=True).data
        return paginator.get_paginated_response(data)

    @extend_schema(
        parameters=[OpenApiParameter("field", int, required=True)],
        responses=SensorReadingSerializer,
    )
    @action(detail=False, methods=["get"])
    def latest(self, request):
        field_id = request.query_params.get("field")
        reading = SensorQueryService().latest_for_field(request.user, field_id)
        if reading is None:
            # No telemetry yet for this field: return an explicit null body so
            # clients can treat "no data" without special-casing an error shape.
            return Response(None)
        return Response(SensorReadingSerializer(reading).data)


def _dt(value):
    return parse_datetime(value) if value else None
