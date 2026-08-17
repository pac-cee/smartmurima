"""Locations serializers."""
from rest_framework import serializers

from .models import Location


class LocationSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default=None)

    class Meta:
        model = Location
        fields = ["id", "name", "level", "parent", "parent_name"]
        read_only_fields = fields
