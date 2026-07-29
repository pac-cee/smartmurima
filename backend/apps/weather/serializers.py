from rest_framework import serializers


class WeatherForecastSerializer(serializers.Serializer):
    forecast_date = serializers.CharField()
    temperature_min = serializers.FloatField(allow_null=True)
    temperature_max = serializers.FloatField(allow_null=True)
    humidity = serializers.FloatField(allow_null=True)
    rainfall_mm = serializers.FloatField(allow_null=True)
    summary = serializers.CharField(allow_blank=True)
