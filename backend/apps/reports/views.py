from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils.dateparse import parse_datetime

from .services import ReportService


def _dt(value):
    return parse_datetime(value) if value else None


class ReportSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("farm", int),
            OpenApiParameter("from", str),
            OpenApiParameter("to", str),
        ]
    )
    def get(self, request):
        p = request.query_params
        data = ReportService().summary(
            request.user,
            farm_id=p.get("farm"),
            date_from=_dt(p.get("from")),
            date_to=_dt(p.get("to")),
        )
        return Response(data)


class ReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("format", str, description="pdf|csv"),
            OpenApiParameter("farm", int),
            OpenApiParameter("from", str),
            OpenApiParameter("to", str),
        ]
    )
    def get(self, request):
        p = request.query_params
        fmt = (p.get("format") or "csv").lower()
        service = ReportService()
        farm_id = p.get("farm")
        date_from = _dt(p.get("from"))
        date_to = _dt(p.get("to"))
        if fmt == "pdf":
            content = service.export_pdf(request.user, farm_id, date_from, date_to)
            resp = HttpResponse(content, content_type="application/pdf")
            resp["Content-Disposition"] = 'attachment; filename="report.pdf"'
            return resp
        csv_text = service.export_csv(request.user, farm_id, date_from, date_to)
        resp = HttpResponse(csv_text, content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="report.csv"'
        return resp
