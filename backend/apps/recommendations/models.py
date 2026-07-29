"""Recommendations ORM."""
from django.db import models

from apps.farms.models import Field


class RecommendationType(models.TextChoices):
    IRRIGATION = "irrigation", "Irrigation"
    FERTILIZER = "fertilizer", "Fertilizer"
    YIELD = "yield", "Yield"


class Recommendation(models.Model):
    field = models.ForeignKey(
        Field, on_delete=models.CASCADE, related_name="recommendations"
    )
    type = models.CharField(max_length=20, choices=RecommendationType.choices)
    decision = models.CharField(max_length=120)
    value = models.FloatField(null=True, blank=True)
    unit = models.CharField(max_length=20, blank=True, default="")
    confidence = models.FloatField(default=0.0)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recommendations_recommendation"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["field", "type", "-created_at"])]
        constraints = [
            models.CheckConstraint(
                check=models.Q(type__in=[c[0] for c in RecommendationType.choices]),
                name="recommendation_type_valid",
            ),
            models.CheckConstraint(
                check=models.Q(confidence__gte=0) & models.Q(confidence__lte=1),
                name="recommendation_confidence_range",
            ),
        ]

    def __str__(self):
        return f"{self.type}:{self.decision} (field {self.field_id})"

    @property
    def owner_user(self):
        return self.field.farm.farmer
