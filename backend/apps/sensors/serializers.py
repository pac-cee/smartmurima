"""Sensors serializers."""
from rest_framework import serializers

from .models import SensorReading


class SensorReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorReading
        fields = [
            "id",
            "sensor_node",
            "soil_moisture",
            "temperature",
            "humidity",
            "rainfall",
            "recorded_at",
        ]
        read_only_fields = fields


class AggregatedReadingSerializer(serializers.Serializer):
    recorded_at = serializers.DateTimeField()
    soil_moisture = serializers.FloatField(allow_null=True)
    temperature = serializers.FloatField(allow_null=True)
    humidity = serializers.FloatField(allow_null=True)
    rainfall = serializers.FloatField(allow_null=True)
