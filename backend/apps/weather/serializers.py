from rest_framework import serializers


class WeatherDaySerializer(serializers.Serializer):
    """One forecast day, in the field names the client renders."""

    date = serializers.CharField()
    temp_min = serializers.FloatField(allow_null=True)
    temp_max = serializers.FloatField(allow_null=True)
    humidity = serializers.FloatField(allow_null=True)
    rainfall_mm = serializers.FloatField(allow_null=True)
    summary = serializers.CharField(allow_blank=True)


class WeatherForecastSerializer(serializers.Serializer):
    farm = serializers.IntegerField()
    days = WeatherDaySerializer(many=True)
    # Provenance, so the UI can say "estimated" instead of implying a real
    # forecast: cache | live | last_known | neutral.
    source = serializers.CharField()
    stale = serializers.BooleanField()
