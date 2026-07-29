"""Farms serializers."""
from rest_framework import serializers

from .models import Crop, Farm, Field, SensorNode


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = ["id", "name", "base_temp", "season"]


class FarmSerializer(serializers.ModelSerializer):
    field_count = serializers.IntegerField(source="fields.count", read_only=True)

    class Meta:
        model = Farm
        fields = [
            "id",
            "farmer",
            "name",
            "sector",
            "latitude",
            "longitude",
            "area_hectares",
            "field_count",
            "created_at",
        ]
        read_only_fields = ["id", "farmer", "created_at", "field_count"]


class FieldSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)

    class Meta:
        model = Field
        fields = [
            "id",
            "farm",
            "crop",
            "crop_name",
            "name",
            "planting_date",
            "growth_stage",
            "area_hectares",
        ]
        read_only_fields = ["id", "crop_name"]


class SensorNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SensorNode
        fields = [
            "id",
            "field",
            "device_id",
            "status",
            "battery",
            "last_seen",
        ]
        read_only_fields = ["id"]
