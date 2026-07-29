"""Yield regressor (XGBoost) with a deterministic heuristic stub.

The real model is an XGBoost booster saved in the version-portable native JSON
format (``yield_reg.json``). When the artifact or xgboost is unavailable, a
transparent agronomic heuristic is used (flagged ``source=stub``).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from .features import FeatureVector
from .loader import load_xgb_booster
from .metadata import feature_order

logger = logging.getLogger("smartmurima")

ARTIFACT = "yield_reg.json"


@dataclass
class YieldPrediction:
    decision: str  # human-readable expectation band
    value: float  # tonnes/ha
    unit: str
    confidence: float
    details: dict


class YieldRegressor:
    def __init__(self):
        self._booster = load_xgb_booster(ARTIFACT)

    @property
    def using_stub(self) -> bool:
        return self._booster is None

    def predict(self, features: FeatureVector, crop_name: str = "") -> YieldPrediction:
        if self._booster is not None:
            try:
                import numpy as np
                import xgboost as xgb

                X = np.array([features.to_model_vector(feature_order())])
                dmatrix = xgb.DMatrix(X)
                yhat = float(self._booster.predict(dmatrix)[0])
                return self._package(
                    round(max(0.0, yhat), 2), 0.8, "model", crop_name, features
                )
            except Exception as exc:  # pragma: no cover
                logger.error("Yield model failed (%s); falling back.", exc)
        return self._predict_stub(features, crop_name)

    def _predict_stub(self, features: FeatureVector, crop_name: str) -> YieldPrediction:
        # Simple growth response: baseline scaled by moisture adequacy and GDD.
        baseline = 3.0  # t/ha
        moisture_factor = min(1.2, max(0.5, (features.soil_moisture_7d or 25) / 30.0))
        gdd_factor = min(1.3, max(0.6, features.gdd / 400.0)) if features.gdd else 0.9
        yhat = baseline * moisture_factor * gdd_factor
        return self._package(round(yhat, 2), 0.6, "stub", crop_name, features)

    @staticmethod
    def _package(value, confidence, source, crop_name, features) -> YieldPrediction:
        band = "high" if value >= 4 else "moderate" if value >= 2.5 else "low"
        return YieldPrediction(
            decision=f"{band}_yield",
            value=value,
            unit="t/ha",
            confidence=confidence,
            details={"source": source, "stub": source == "stub", "crop": crop_name},
        )
