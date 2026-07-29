"""Weather business logic with DB-backed caching.

Serving strategy (UC-29):

1. ``cache``      — fresh records already stored for this farm (< TTL old).
2. ``live``       — a successful external API call; records upserted.
3. ``last_known`` — external API unset/unreachable but we still hold a real
                    (non-neutral) forecast for upcoming dates; serve it, flagged
                    ``stale``.
4. ``neutral``    — no real data available; serve the synthetic neutral outlook,
                    flagged ``stale`` (recommendations degrade confidence).
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from django.conf import settings
from django.utils import timezone

from core.exceptions import NotFoundError, PermissionDeniedError
from core.services import BaseService

from apps.farms.repositories import FarmRepository

from . import client as client_module
from .client import WeatherClient
from .repositories import WeatherRecordRepository

_NEUTRAL_SOURCES = {"neutral", "fallback"}


class WeatherService(BaseService):
    def __init__(
        self,
        repo: Optional[WeatherRecordRepository] = None,
        farm_repo: Optional[FarmRepository] = None,
        client: Optional[WeatherClient] = None,
    ):
        self.repo = repo or WeatherRecordRepository()
        self.farm_repo = farm_repo or FarmRepository()
        self.client = client or WeatherClient()

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

    def forecast(self, user, farm_id) -> dict:
        farm = self._get_farm(user, farm_id)

        cache_seconds = int(getattr(settings, "WEATHER_CACHE_SECONDS", 1800))
        existing = list(
            self.repo.for_farm(farm.id).filter(forecast_date__gte=date.today())
        )

        # 1. Serve from a fresh cache.
        if existing:
            newest = max(r.fetched_at for r in existing)
            if (timezone.now() - newest).total_seconds() < cache_seconds:
                return self._result(existing, source="cache", stale=False)

        data, source = self.client.fetch(farm.latitude, farm.longitude)

        # 3. External data unavailable: prefer last-known-good real records
        #    before persisting/serving a synthetic neutral outlook.
        if source == client_module.NEUTRAL:
            real = [r for r in existing if not self._is_neutral(r)]
            if real:
                return self._result(real, source="last_known", stale=True)
            records = self._persist(farm, data)
            return self._result(records, source="neutral", stale=True)

        # 2. Live data.
        records = self._persist(farm, data)
        return self._result(records, source="live", stale=False)

    def _persist(self, farm, data) -> list:
        records = []
        for item in data:
            records.append(
                self.repo.upsert(
                    farm=farm,
                    forecast_date=item["forecast_date"],
                    defaults={
                        "temperature_min": item.get("temperature_min"),
                        "temperature_max": item.get("temperature_max"),
                        "humidity": item.get("humidity"),
                        "rainfall_mm": item.get("rainfall_mm"),
                        "summary": item.get("summary", "") or "",
                        "raw": item.get("raw", {}),
                    },
                )
            )
        return records

    @staticmethod
    def _is_neutral(record) -> bool:
        return (record.raw or {}).get("source") in _NEUTRAL_SOURCES

    def _result(self, records, source: str, stale: bool) -> dict:
        return {
            "forecast": [self._serialize(r) for r in records],
            "source": source,
            "stale": stale,
        }

    @staticmethod
    def _serialize(r) -> dict:
        fd = r.forecast_date
        # update_or_create keeps the raw kwarg on the instance, so a neutral/
        # fallback forecast_date may still be a string rather than a date.
        fd = fd.isoformat() if hasattr(fd, "isoformat") else str(fd)
        return {
            "forecast_date": fd,
            "temperature_min": r.temperature_min,
            "temperature_max": r.temperature_max,
            "humidity": r.humidity,
            "rainfall_mm": r.rainfall_mm,
            "summary": r.summary,
        }
