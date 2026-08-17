from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils.dateparse import parse_datetime

from .services import ReportService


def _dt(value):
    return parse_datetime(value) if value else None


def _int(value):
    """Safely coerce an id query param; None for missing/non-numeric (e.g. a
    stale mock 'f1'), so a bad id never 500s the endpoint."""
    return int(value) if value and str(value).isdigit() else None


class IgnoreFormatNegotiation(BaseContentNegotiation):
    """Content negotiation that ignores the ``format`` query parameter.

    The export endpoint uses ``?format=csv|pdf`` as a *business* parameter, but
    DRF's default negotiation treats ``format`` as a renderer selector and
    raises 404 when no renderer named "csv"/"pdf" exists. This negotiator just
    returns the first configured renderer (the view writes a raw HttpResponse,
    so the renderer is never actually used for the file body)."""

    def select_parser(self, request, parsers):
        return parsers[0] if parsers else None

    def select_renderer(self, request, renderers, format_suffix=None):
        return (renderers[0], renderers[0].media_type)


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
            farm_id=_int(p.get("farm")),
            date_from=_dt(p.get("from")),
            date_to=_dt(p.get("to")),
        )
        return Response(data)


class ReportExportView(APIView):
    permission_classes = [IsAuthenticated]
    content_negotiation_class = IgnoreFormatNegotiation

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
        farm_id = _int(p.get("farm"))
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
