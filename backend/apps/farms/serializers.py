"""Farms serializers."""
from rest_framework import serializers

from .models import Crop, Farm, Field, SensorNode


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = ["id", "name", "base_temp", "season"]


class FarmSerializer(serializers.ModelSerializer):
    field_count = serializers.IntegerField(source="fields.count", read_only=True)
    location_name = serializers.CharField(
        source="location.name", read_only=True, default=None
    )

    class Meta:
        model = Farm
        fields = [
            "id",
            "farmer",
            "name",
            "sector",
            "location",
            "location_name",
            "latitude",
            "longitude",
            "area_hectares",
            "field_count",
            "created_at",
        ]
        read_only_fields = ["id", "farmer", "created_at", "field_count", "location_name"]


class FieldSerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    # Farmers type the crop name freely (crops are open-ended); we get-or-create
    # the Crop record from it. `crop` (id) is still accepted for compatibility.
    crop_input = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Field
        fields = [
            "id",
            "farm",
            "crop",
            "crop_name",
            "crop_input",
            "name",
            "planting_date",
            "growth_stage",
            "area_hectares",
        ]
        read_only_fields = ["id", "crop_name"]
        extra_kwargs = {"crop": {"required": False, "allow_null": True}}

    def validate(self, attrs):
        name = (attrs.pop("crop_input", "") or "").strip()
        if name:
            crop = Crop.objects.filter(name__iexact=name).first()
            if crop is None:
                crop = Crop.objects.create(name=name)
            attrs["crop"] = crop
        return attrs


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
