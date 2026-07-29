from __future__ import annotations

from core.repositories import BaseRepository

from .models import WeatherRecord


class WeatherRecordRepository(BaseRepository[WeatherRecord]):
    model = WeatherRecord

    def for_farm(self, farm_id):
        return self.get_queryset().filter(farm_id=farm_id)

    def upsert(self, farm, forecast_date, defaults: dict) -> WeatherRecord:
        obj, _ = self.model.objects.update_or_create(
            farm=farm, forecast_date=forecast_date, defaults=defaults
        )
        return obj
