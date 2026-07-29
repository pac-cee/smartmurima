from rest_framework import serializers

from .models import Recommendation


class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Recommendation
        fields = [
            "id",
            "field",
            "type",
            "decision",
            "value",
            "unit",
            "confidence",
            "details",
            "created_at",
        ]
        read_only_fields = fields


class RunRecommendationSerializer(serializers.Serializer):
    field = serializers.IntegerField()
