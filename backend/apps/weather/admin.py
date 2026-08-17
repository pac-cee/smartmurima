"""Django admin registration for cached weather records."""
from django.contrib import admin

from .models import WeatherRecord


@admin.register(WeatherRecord)
class WeatherRecordAdmin(admin.ModelAdmin):
    list_display = ("farm", "forecast_date", "temperature_min", "temperature_max",
                    "rainfall_mm", "summary")
    list_filter = ("forecast_date",)
    search_fields = ("farm__name", "summary")
    ordering = ("forecast_date",)
    date_hierarchy = "forecast_date"
    autocomplete_fields = ("farm",)
    readonly_fields = ("fetched_at",)
