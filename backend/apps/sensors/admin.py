"""Django admin registration for sensor telemetry."""
from django.contrib import admin

from .models import SensorReading


@admin.register(SensorReading)
class SensorReadingAdmin(admin.ModelAdmin):
    list_display = ("sensor_node", "soil_moisture", "temperature", "humidity",
                    "rainfall", "recorded_at")
    list_filter = ("sensor_node",)
    search_fields = ("sensor_node__device_id",)
    ordering = ("-recorded_at",)
    date_hierarchy = "recorded_at"
    autocomplete_fields = ("sensor_node",)
    readonly_fields = ("created_at",)
