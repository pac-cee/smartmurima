"""Fertilizer recommender (RandomForest regressor) with a heuristic stub.

Regresses an NPK application rate (kg/ha) from the feature vector and pairs it
with a crop-specific blend label (see ``ml.encoders.FERTILIZER_BLEND``). The
real model is loaded from ``fertilizer.joblib``; when absent a transparent
agronomic heuristic is used (flagged ``source=stub``).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from .encoders import FERTILIZER_BLEND, encode_crop
from .features import FeatureVector
from .loader import load_sklearn_artifact
from .metadata import feature_order

logger = logging.getLogger("smartmurima")

ARTIFACT = "fertilizer.joblib"


@dataclass
class FertilizerPrediction:
    decision: str  # e.g. "apply NPK 17-17-17 (maize)"
    value: float  # kg/ha
    unit: str
    confidence: float
    details: dict


def _blend_for(features: FeatureVector, crop_name: str) -> str:
    code = encode_crop(crop_name) if crop_name else int(features.crop_code)
    return FERTILIZER_BLEND.get(code, "NPK 17-17-17")


class FertilizerRecommender:
    def __init__(self):
        self._model = load_sklearn_artifact(ARTIFACT)

    @property
    def using_stub(self) -> bool:
        return self._model is None

    def predict(self, features: FeatureVector, crop_name: str = "") -> FertilizerPrediction:
        if self._model is not None:
            try:
                import numpy as np

                X = np.array([features.to_model_vector(feature_order())])
                rate = float(self._model.predict(X)[0])
                blend = _blend_for(features, crop_name)
                return FertilizerPrediction(
                    decision=f"apply {blend}",
                    value=round(max(0.0, rate), 1),
                    unit="kg/ha",
                    confidence=0.8,
                    details={"source": "model", "stub": False, "crop": crop_name,
                             "blend": blend},
                )
            except Exception as exc:  # pragma: no cover
                logger.error("Fertilizer model failed (%s); falling back.", exc)
        return self._predict_stub(features, crop_name)

    def _predict_stub(self, features: FeatureVector, crop_name: str) -> FertilizerPrediction:
        # Base NPK by growth stage (proxied via days_since_planting), adjusted by
        # recent rainfall (leaching) and GDD (crop demand).
        base = 60.0
        if features.days_since_planting and features.days_since_planting > 45:
            base = 90.0
        if features.rainfall_7d > 40:
            base += 15.0  # replace leached nutrients
        demand_factor = 1.0 + min(0.3, features.gdd / 500.0)
        rate = round(base * demand_factor, 1)
        blend = _blend_for(features, crop_name)
        return FertilizerPrediction(
            decision=f"apply {blend}",
            value=rate,
            unit="kg/ha",
            confidence=0.65,
            details={
                "source": "stub",
                "stub": True,
                "crop": crop_name,
                "blend": blend,
                "base_rate": base,
                "rule": "NPK base by stage, +15 if rainfall_7d>40mm, scaled by GDD",
            },
        )
