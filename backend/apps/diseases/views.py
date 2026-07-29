from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.pagination import DefaultPagination

from .serializers import DiseaseDetectSerializer, DiseaseReportSerializer
from .services import DiseaseService


class DiseaseDetectView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(request=DiseaseDetectSerializer, responses=DiseaseReportSerializer)
    def post(self, request):
        serializer = DiseaseDetectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = DiseaseService().detect(
            request.user,
            serializer.validated_data["field"],
            serializer.validated_data["image"],
        )
        return Response(
            DiseaseReportSerializer(report, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class DiseaseReportListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("field", int)],
        responses=DiseaseReportSerializer(many=True),
    )
    def get(self, request):
        field_id = request.query_params.get("field")
        qs = DiseaseService().list_for_user(request.user, field_id=field_id)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        data = DiseaseReportSerializer(
            page, many=True, context={"request": request}
        ).data
        return paginator.get_paginated_response(data)
