from rest_framework import serializers

from .models import DiseaseReport


class DiseaseReportSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = DiseaseReport
        fields = [
            "id",
            "field",
            "disease",
            "confidence",
            "is_healthy",
            "treatment",
            "image_url",
            "created_at",
        ]
        read_only_fields = fields

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class DiseaseDetectSerializer(serializers.Serializer):
    field = serializers.IntegerField()
    image = serializers.ImageField()
