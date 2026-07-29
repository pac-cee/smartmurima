from rest_framework import serializers

from .models import Alert


class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = [
            "id",
            "type",
            "message",
            "severity",
            "is_read",
            "context",
            "created_at",
        ]
        read_only_fields = fields
