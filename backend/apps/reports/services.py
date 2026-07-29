"""Reporting: aggregate stats and CSV/PDF export.

Reads through existing repositories (no direct ORM here beyond aggregation
helpers delegated to those repositories).
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Optional

from django.db.models import Avg, Count, Max, Min

from core.exceptions import NotFoundError, PermissionDeniedError
from core.services import BaseService

from apps.diseases.repositories import DiseaseReportRepository
from apps.farms.repositories import FarmRepository, FieldRepository
from apps.recommendations.repositories import RecommendationRepository
from apps.sensors.repositories import SensorReadingRepository


class ReportService(BaseService):
    def __init__(
        self,
        farm_repo: Optional[FarmRepository] = None,
        field_repo: Optional[FieldRepository] = None,
        reading_repo: Optional[SensorReadingRepository] = None,
        rec_repo: Optional[RecommendationRepository] = None,
        disease_repo: Optional[DiseaseReportRepository] = None,
    ):
        self.farm_repo = farm_repo or FarmRepository()
        self.field_repo = field_repo or FieldRepository()
        self.reading_repo = reading_repo or SensorReadingRepository()
        self.rec_repo = rec_repo or RecommendationRepository()
        self.disease_repo = disease_repo or DiseaseReportRepository()

    def _get_farm(self, user, farm_id):
        farm = self.farm_repo.get_by_id(farm_id)
        if farm is None:
            raise NotFoundError("Farm not found.")
        if not (
            user.is_superuser
            or user.role in ("admin", "extension", "coop_admin")
            or farm.farmer_id == user.id
        ):
            raise PermissionDeniedError("You do not own this farm.")
        return farm

    def summary(self, user, farm_id=None, date_from=None, date_to=None) -> dict:
        readings = self.reading_repo.base_for_user(user)
        fields = self.field_repo.list_for_user(user)
        recs = self.rec_repo.list_for_user(user)
        diseases = self.disease_repo.list_for_user(user)

        if farm_id:
            self._get_farm(user, farm_id)
            readings = readings.filter(sensor_node__field__farm_id=farm_id)
            fields = fields.filter(farm_id=farm_id)
            recs = recs.filter(field__farm_id=farm_id)
            diseases = diseases.filter(field__farm_id=farm_id)
        if date_from:
            readings = readings.filter(recorded_at__gte=date_from)
            recs = recs.filter(created_at__gte=date_from)
            diseases = diseases.filter(created_at__gte=date_from)
        if date_to:
            readings = readings.filter(recorded_at__lte=date_to)
            recs = recs.filter(created_at__lte=date_to)
            diseases = diseases.filter(created_at__lte=date_to)

        agg = readings.aggregate(
            avg_soil_moisture=Avg("soil_moisture"),
            avg_temperature=Avg("temperature"),
            avg_humidity=Avg("humidity"),
            min_soil_moisture=Min("soil_moisture"),
            max_soil_moisture=Max("soil_moisture"),
            reading_count=Count("id"),
        )

        rec_by_type = {
            row["type"]: row["n"]
            for row in recs.values("type").annotate(n=Count("id"))
        }

        return {
            "farm": farm_id,
            "field_count": fields.count(),
            "recommendation_count": recs.count(),
            "recommendations_by_type": rec_by_type,
            "readings": {k: _round(v) for k, v in agg.items()},
            "disease_reports": {
                "total": diseases.count(),
                "unhealthy": diseases.filter(is_healthy=False).count(),
            },
            "yield": self._latest_yield(recs),
            "empty": (agg["reading_count"] or 0) == 0
            and recs.count() == 0
            and diseases.count() == 0,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }

    @staticmethod
    def _latest_yield(recs) -> Optional[dict]:
        latest = recs.filter(type="yield").order_by("-created_at").first()
        if latest is None:
            return None
        return {
            "decision": latest.decision,
            "value": latest.value,
            "unit": latest.unit,
            "confidence": _round(latest.confidence),
            "created_at": latest.created_at.isoformat(),
        }

    def export_csv(self, user, farm_id=None, date_from=None, date_to=None) -> str:
        readings = self.reading_repo.base_for_user(user)
        if farm_id:
            self._get_farm(user, farm_id)
            readings = readings.filter(sensor_node__field__farm_id=farm_id)
        if date_from:
            readings = readings.filter(recorded_at__gte=date_from)
        if date_to:
            readings = readings.filter(recorded_at__lte=date_to)

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["recorded_at", "device_id", "soil_moisture", "temperature",
             "humidity", "rainfall"]
        )
        # Header row is always emitted, so an empty range yields a valid,
        # header-only CSV rather than an error.
        for r in readings.order_by("recorded_at")[:10000]:
            writer.writerow(
                [
                    r.recorded_at.isoformat(),
                    r.sensor_node.device_id,
                    r.soil_moisture,
                    r.temperature,
                    r.humidity,
                    r.rainfall,
                ]
            )
        return buf.getvalue()

    def export_pdf(self, user, farm_id=None, date_from=None, date_to=None) -> bytes:
        summary = self.summary(user, farm_id, date_from, date_to)
        return _render_pdf(summary)


def _round(value):
    return round(value, 2) if isinstance(value, float) else value


def _render_pdf(summary: dict) -> bytes:
    """Render a simple summary PDF. Falls back to plain text if reportlab
    is unavailable so the endpoint never hard-fails."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        pdf = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        y = height - 60
        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(50, y, "SmartMurima Farm Report")
        y -= 30
        pdf.setFont("Helvetica", 11)
        for line in _summary_lines(summary):
            pdf.drawString(50, y, line)
            y -= 18
            if y < 60:
                pdf.showPage()
                pdf.setFont("Helvetica", 11)
                y = height - 60
        pdf.showPage()
        pdf.save()
        return buf.getvalue()
    except Exception:  # pragma: no cover - reportlab optional
        text = "SmartMurima Farm Report\n" + "\n".join(_summary_lines(summary))
        return text.encode("utf-8")


def _summary_lines(summary: dict) -> list[str]:
    lines = [
        f"Generated: {summary.get('generated_at')}",
        f"Farm: {summary.get('farm')}",
        f"Fields: {summary.get('field_count')}",
        f"Recommendations: {summary.get('recommendation_count')}",
    ]
    for rtype, n in (summary.get("recommendations_by_type") or {}).items():
        lines.append(f"  - {rtype}: {n}")

    diseases = summary.get("disease_reports") or {}
    lines.append(
        f"Disease reports: {diseases.get('total', 0)} "
        f"(unhealthy: {diseases.get('unhealthy', 0)})"
    )

    yld = summary.get("yield")
    if yld:
        lines.append(
            f"Latest yield estimate: {yld.get('value')} {yld.get('unit')} "
            f"(confidence {yld.get('confidence')})"
        )
    else:
        lines.append("Latest yield estimate: none")

    lines.append("")
    if summary.get("empty"):
        lines.append("No sensor, recommendation, or disease data in this range.")
    lines.append("Sensor readings:")
    for k, v in summary.get("readings", {}).items():
        lines.append(f"  {k}: {v}")
    return lines
