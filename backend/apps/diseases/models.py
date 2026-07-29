"""Diseases ORM: DiseaseReport."""
from django.db import models

from apps.farms.models import Field


class DiseaseReport(models.Model):
    field = models.ForeignKey(
        Field, on_delete=models.CASCADE, related_name="disease_reports"
    )
    image = models.ImageField(upload_to="diseases/%Y/%m/", null=True, blank=True)
    disease = models.CharField(max_length=120)
    confidence = models.FloatField(default=0.0)
    is_healthy = models.BooleanField(default=False)
    treatment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "diseases_report"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["field", "-created_at"])]
        constraints = [
            models.CheckConstraint(
                check=models.Q(confidence__gte=0) & models.Q(confidence__lte=1),
                name="disease_confidence_range",
            ),
        ]

    def __str__(self):
        return f"{self.disease} (field {self.field_id})"

    @property
    def owner_user(self):
        return self.field.farm.farmer
