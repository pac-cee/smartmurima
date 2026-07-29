"""Sensors ORM: SensorReading time-series telemetry."""
from django.db import models

from apps.farms.models import SensorNode


class SensorReading(models.Model):
    sensor_node = models.ForeignKey(
        SensorNode, on_delete=models.CASCADE, related_name="readings"
    )
    soil_moisture = models.FloatField(help_text="Volumetric water content (%).")
    temperature = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    rainfall = models.FloatField(null=True, blank=True)
    recorded_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sensors_reading"
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(
                fields=["sensor_node", "-recorded_at"], name="reading_node_time_idx"
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["sensor_node", "recorded_at"],
                name="reading_node_time_unique",
            ),
            models.CheckConstraint(
                check=models.Q(soil_moisture__gte=0) & models.Q(soil_moisture__lte=100),
                name="reading_soil_moisture_range",
            ),
        ]

    def __str__(self):
        return f"{self.sensor_node_id}@{self.recorded_at:%Y-%m-%d %H:%M}"
