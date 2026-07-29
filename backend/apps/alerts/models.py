"""Alerts ORM."""
from django.conf import settings
from django.db import models


class AlertType(models.TextChoices):
    LOW_MOISTURE = "low_moisture", "Low soil moisture"
    DISEASE_RISK = "disease_risk", "Disease risk"
    WEATHER = "weather", "Weather"
    SYSTEM = "system", "System"


class Severity(models.TextChoices):
    INFO = "info", "Info"
    WARNING = "warning", "Warning"
    CRITICAL = "critical", "Critical"


class Alert(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alerts"
    )
    type = models.CharField(max_length=20, choices=AlertType.choices)
    message = models.TextField()
    severity = models.CharField(
        max_length=10, choices=Severity.choices, default=Severity.INFO
    )
    is_read = models.BooleanField(default=False)
    context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "alerts_alert"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read"])]
        constraints = [
            models.CheckConstraint(
                check=models.Q(type__in=[c[0] for c in AlertType.choices]),
                name="alert_type_valid",
            ),
            models.CheckConstraint(
                check=models.Q(severity__in=[c[0] for c in Severity.choices]),
                name="alert_severity_valid",
            ),
        ]

    def __str__(self):
        return f"Alert<{self.type}:{self.user_id}>"

    @property
    def owner_user(self):
        return self.user
