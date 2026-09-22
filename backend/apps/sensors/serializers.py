"""Sensors serializers."""
from rest_framework import serializers

from .models import SensorReading

# Every numeric channel a reading can carry, in dashboard display order.
READING_FIELDS = [
    "soil_moisture",
    "temperature",
    "humidity",
    "rainfall",
    "ph",
    "ec",
    "nitrogen",
    "phosphorus",
    "potassium",
]


class SensorReadingSerializer(serializers.ModelSerializer):
    device_id = serializers.CharField(source="sensor_node.device_id", read_only=True)

    class Meta:
        model = SensorReading
        fields = ["id", "sensor_node", "device_id", *READING_FIELDS, "recorded_at"]
        read_only_fields = fields


class AggregatedReadingSerializer(serializers.Serializer):
    recorded_at = serializers.DateTimeField()
    soil_moisture = serializers.FloatField(allow_null=True)
    temperature = serializers.FloatField(allow_null=True)
    humidity = serializers.FloatField(allow_null=True)
    rainfall = serializers.FloatField(allow_null=True)
    ph = serializers.FloatField(allow_null=True)
    ec = serializers.FloatField(allow_null=True)
    nitrogen = serializers.FloatField(allow_null=True)
    phosphorus = serializers.FloatField(allow_null=True)
    potassium = serializers.FloatField(allow_null=True)
