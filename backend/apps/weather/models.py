"""Weather ORM: cached forecast records keyed by farm."""
from django.db import models

from apps.farms.models import Farm


class WeatherRecord(models.Model):
    farm = models.ForeignKey(
        Farm, on_delete=models.CASCADE, related_name="weather_records"
    )
    forecast_date = models.DateField()
    temperature_min = models.FloatField(null=True, blank=True)
    temperature_max = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    rainfall_mm = models.FloatField(null=True, blank=True)
    summary = models.CharField(max_length=255, blank=True, default="")
    raw = models.JSONField(default=dict, blank=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "weather_record"
        ordering = ["forecast_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["farm", "forecast_date"], name="weather_farm_date_unique"
            ),
        ]

    def __str__(self):
        return f"Weather<{self.farm_id}:{self.forecast_date}>"
