"""Batch-generate advice for every field with recent sensor readings.

Designed to run on a schedule (e.g. cron) or right after an ingestion cycle so
the ``/recommendations/latest`` endpoint always has fresh, crop- and
location-aware advice to serve without any manual trigger from the client.

Usage::

    python manage.py generate_recommendations [--since-hours 24]

The ``--since-hours`` window controls which fields are considered "active"
(those with at least one reading inside the window).
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.farms.repositories import FieldRepository
from apps.sensors.repositories import SensorReadingRepository
from apps.recommendations.services import RecommendationService


class Command(BaseCommand):
    help = "Generate irrigation/fertilizer/yield advice for fields with recent readings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--since-hours",
            type=int,
            default=24,
            help="Only process fields with a reading in the last N hours (default 24).",
        )

    def handle(self, *args, **options):
        since = timezone.now() - timedelta(hours=options["since_hours"])
        field_repo = FieldRepository()
        reading_repo = SensorReadingRepository()
        service = RecommendationService()

        processed = 0
        skipped = 0
        for field in field_repo.all().select_related("farm", "farm__location", "crop"):
            latest = reading_repo.latest_for_field(field.id)
            if latest is None or latest.recorded_at < since:
                skipped += 1
                continue
            try:
                service.generate_for_field(field)
                processed += 1
            except Exception as exc:  # pragma: no cover - defensive per-field
                self.stderr.write(
                    self.style.WARNING(f"Field {field.id} failed: {exc}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Recommendations generated for {processed} field(s); "
                f"{skipped} skipped (no recent readings)."
            )
        )
