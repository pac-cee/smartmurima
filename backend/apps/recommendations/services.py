"""Recommendation orchestration: gather features -> ML -> persist -> alert."""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from django.utils import timezone

from core.exceptions import NotFoundError, PermissionDeniedError
from core.services import BaseService

from apps.farms.repositories import FieldRepository
from apps.sensors.repositories import SensorReadingRepository

from ml.features import FeatureBuilder
from ml.fertilizer import FertilizerRecommender
from ml.irrigation import IrrigationClassifier
from ml.yield_model import YieldRegressor

from .models import RecommendationType
from .repositories import RecommendationRepository

IRRIGATION_ALERT_THRESHOLD = 0.7  # confidence above which a critical need alerts
STALENESS_HOURS = 48  # BR-R2: flag recommendations built on data older than this


class RecommendationService(BaseService):
    def __init__(
        self,
        repo: Optional[RecommendationRepository] = None,
        field_repo: Optional[FieldRepository] = None,
        reading_repo: Optional[SensorReadingRepository] = None,
        irrigation_model: Optional[IrrigationClassifier] = None,
        fertilizer_model: Optional[FertilizerRecommender] = None,
        yield_model: Optional[YieldRegressor] = None,
    ):
        self.repo = repo or RecommendationRepository()
        self.field_repo = field_repo or FieldRepository()
        self.reading_repo = reading_repo or SensorReadingRepository()
        # ML wrappers are lazy so imports never break app startup.
        self._irrigation_model = irrigation_model
        self._fertilizer_model = fertilizer_model
        self._yield_model = yield_model

    # -- helpers ----------------------------------------------------------
    def list_for_user(self, user, field_id=None, type=None):
        return self.repo.list_for_user(user, field_id=field_id, type=type)

    def _get_field(self, user, field_id):
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
        return field

    def _build_features(self, field):
        now = timezone.now()
        since = now - timedelta(days=7)
        readings = list(self.reading_repo.recent_for_field(field.id, since))
        base_temp = float(field.crop.base_temp) if field.crop else 10.0
        features = FeatureBuilder.build(
            readings,
            now=now,
            base_temp=base_temp,
            planting_date=field.planting_date,
            crop_name=field.crop.name if field.crop else None,
            growth_stage=getattr(field, "growth_stage", None),
            soil_class=None,  # farms model has no soil class yet; encoder defaults
        )
        # Data-freshness provenance (UC-14 E1 / BR-R2): flag stale or missing data
        # so downstream never issues a confident recommendation on old readings.
        latest = self.reading_repo.latest_for_field(field.id)
        if latest is None:
            features.extras["data_status"] = "missing"
        else:
            age_h = (now - latest.recorded_at).total_seconds() / 3600.0
            features.extras["data_status"] = (
                "stale" if age_h > STALENESS_HOURS else "fresh"
            )
            features.extras["reading_age_hours"] = round(age_h, 1)
        return features

    @staticmethod
    def _apply_provenance(pred, features):
        """Merge data-freshness provenance into a prediction's details and, when
        data is stale/missing, damp the reported confidence (BR-R1/BR-R2)."""
        status = features.extras.get("data_status", "unknown")
        pred.details["data_status"] = status
        if "reading_age_hours" in features.extras:
            pred.details["reading_age_hours"] = features.extras["reading_age_hours"]
        if status in ("stale", "missing"):
            pred.details["confidence_note"] = (
                "Confidence reduced: readings stale or missing."
            )
            pred.confidence = round(pred.confidence * 0.7, 2)
        return pred

    # -- public API -------------------------------------------------------
    def irrigation(self, user, field_id):
        field = self._get_field(user, field_id)
        features = self._build_features(field)
        model = self._irrigation_model or IrrigationClassifier()
        pred = self._apply_provenance(model.predict(features), features)
        rec = self.repo.create(
            field=field,
            type=RecommendationType.IRRIGATION,
            decision=pred.decision,
            value=pred.value,
            unit=pred.unit,
            confidence=pred.confidence,
            details=pred.details,
        )
        if pred.decision == "urgent" and pred.confidence >= IRRIGATION_ALERT_THRESHOLD:
            self._maybe_alert_low_moisture(field, features)
        return rec

    def fertilizer(self, user, field_id):
        field = self._get_field(user, field_id)
        features = self._build_features(field)
        crop_name = field.crop.name if field.crop else ""
        model = self._fertilizer_model or FertilizerRecommender()
        pred = self._apply_provenance(
            model.predict(features, crop_name=crop_name), features
        )
        return self.repo.create(
            field=field,
            type=RecommendationType.FERTILIZER,
            decision=pred.decision,
            value=pred.value,
            unit=pred.unit,
            confidence=pred.confidence,
            details=pred.details,
        )

    def yield_estimate(self, user, field_id):
        field = self._get_field(user, field_id)
        features = self._build_features(field)
        crop_name = field.crop.name if field.crop else ""
        model = self._yield_model or YieldRegressor()
        pred = self._apply_provenance(
            model.predict(features, crop_name=crop_name), features
        )
        return self.repo.create(
            field=field,
            type=RecommendationType.YIELD,
            decision=pred.decision,
            value=pred.value,
            unit=pred.unit,
            confidence=pred.confidence,
            details=pred.details,
        )

    def _maybe_alert_low_moisture(self, field, features):
        try:
            from apps.alerts.services import AlertService

            AlertService().raise_low_moisture(
                user=field.farm.farmer,
                field=field,
                soil_moisture=features.soil_moisture_3d or features.soil_moisture,
            )
        except Exception as exc:  # pragma: no cover
            self.logger.error("Failed to raise irrigation alert: %s", exc)
