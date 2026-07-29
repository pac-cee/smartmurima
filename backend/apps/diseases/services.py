"""Diseases business logic: CNN inference + persistence + risk alerting."""
from __future__ import annotations

from typing import Optional

from core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from core.services import BaseService

from apps.farms.repositories import FieldRepository

from ml.disease import DiseaseClassifier

from .repositories import DiseaseReportRepository


class DiseaseService(BaseService):
    def __init__(
        self,
        repo: Optional[DiseaseReportRepository] = None,
        field_repo: Optional[FieldRepository] = None,
        classifier: Optional[DiseaseClassifier] = None,
    ):
        self.repo = repo or DiseaseReportRepository()
        self.field_repo = field_repo or FieldRepository()
        self._classifier = classifier

    def list_for_user(self, user, field_id=None):
        return self.repo.list_for_user(user, field_id=field_id)

    def detect(self, user, field_id, image_file) -> "DiseaseReport":
        if image_file is None:
            raise ValidationError("An image file is required.")
        field = self.field_repo.get_by_id(field_id)
        if field is None:
            raise NotFoundError("Field not found.")
        owner = field.farm.farmer
        if not (
            user.is_superuser
            or user.role in ("admin", "extension", "coop_admin")
            or owner == user
        ):
            raise PermissionDeniedError("You do not own this field.")

        image_bytes = image_file.read()
        try:
            image_file.seek(0)
        except Exception:  # pragma: no cover
            pass

        classifier = self._classifier or DiseaseClassifier()
        pred = classifier.predict(image_bytes)

        report = self.repo.create(
            field=field,
            image=image_file,
            disease=pred.disease,
            confidence=pred.confidence,
            is_healthy=pred.is_healthy,
            treatment=pred.treatment,
        )

        if not pred.is_healthy and pred.confidence >= 0.6:
            self._alert_disease(field, pred)
        return report

    def _alert_disease(self, field, pred):
        try:
            from apps.alerts.services import AlertService

            AlertService().raise_disease_risk(
                user=field.farm.farmer,
                field=field,
                disease=pred.disease,
                confidence=pred.confidence,
            )
        except Exception as exc:  # pragma: no cover
            self.logger.error("Failed to raise disease alert: %s", exc)
