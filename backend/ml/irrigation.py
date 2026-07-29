"""Irrigation classifier (RandomForest/XGBoost) with a heuristic stub.

Predicts a 3-class irrigation decision (``no_action`` / ``moderate`` /
``urgent``) per UC-14, plus a recommended water depth (mm). The real model is
loaded from ``irrigation_clf.joblib``; when absent a transparent agronomic
heuristic is used so the API always answers (flagged ``source=stub``).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from .encoders import IRRIGATION_LABELS
from .features import FeatureVector
from .loader import load_sklearn_artifact
from .metadata import feature_order, load_metadata

logger = logging.getLogger("smartmurima")

ARTIFACT = "irrigation_clf.joblib"


@dataclass
class IrrigationPrediction:
    decision: str  # "no_action" | "moderate" | "urgent"
    value: float  # recommended water depth (mm), 0 when no action
    unit: str
    confidence: float
    details: dict


class IrrigationClassifier:
    """Predicts whether/how much to irrigate.

    Loads a trained scikit-learn/XGBoost classifier from artifacts. When absent,
    a transparent agronomic heuristic is used so the API always answers.
    """

    def __init__(self):
        self._model = load_sklearn_artifact(ARTIFACT)
        self._labels = self._load_labels()

    @staticmethod
    def _load_labels() -> dict:
        meta = load_metadata() or {}
        raw = (meta.get("irrigation") or {}).get("labels")
        if isinstance(raw, dict) and raw:
            return {int(k): v for k, v in raw.items()}
        return dict(IRRIGATION_LABELS)

    @property
    def using_stub(self) -> bool:
        return self._model is None

    def predict(self, features: FeatureVector) -> IrrigationPrediction:
        if self._model is not None:
            try:
                return self._predict_model(features)
            except Exception as exc:  # pragma: no cover - defensive
                logger.error("Irrigation model failed (%s); falling back.", exc)
        return self._predict_stub(features)

    def _predict_model(self, features: FeatureVector) -> IrrigationPrediction:
        import numpy as np

        X = np.array([features.to_model_vector(feature_order())])
        proba = None
        if hasattr(self._model, "predict_proba"):
            proba = float(self._model.predict_proba(X)[0].max())
        pred = int(self._model.predict(X)[0])
        decision = self._labels.get(pred, "no_action")
        irrigate = decision != "no_action"
        return IrrigationPrediction(
            decision=decision,
            value=round(_water_depth(features, decision), 1) if irrigate else 0.0,
            unit="mm",
            confidence=round(proba if proba is not None else 0.8, 2),
            details={"source": "model", "stub": False, "class": pred},
        )

    def _predict_stub(self, features: FeatureVector) -> IrrigationPrediction:
        # Heuristic water-stress score from the 3-day soil moisture average and
        # the expected rainfall over the coming week.
        sm = features.soil_moisture_3d or features.soil_moisture
        if sm < 18.0 and features.rainfall_7d < 10.0:
            decision = "urgent"
        elif sm < 27.0 and features.rainfall_7d < 20.0:
            decision = "moderate"
        else:
            decision = "no_action"
        irrigate = decision != "no_action"
        confidence = 0.6 + min(0.3, abs(25.0 - sm) / 100.0)
        return IrrigationPrediction(
            decision=decision,
            value=round(_water_depth(features, decision), 1) if irrigate else 0.0,
            unit="mm",
            confidence=round(min(confidence, 0.95), 2),
            details={
                "source": "stub",
                "stub": True,
                "soil_moisture_3d": round(sm, 1),
                "rainfall_7d": round(features.rainfall_7d, 1),
                "rule": (
                    "urgent if sm<18% & rainfall_7d<10mm; "
                    "moderate if sm<27% & rainfall_7d<20mm; else no_action"
                ),
            },
        )


def _water_depth(features: FeatureVector, decision: str) -> float:
    """Required water depth (mm) to move moisture back toward field capacity."""
    deficit = max(0.0, 30.0 - (features.soil_moisture_3d or features.soil_moisture))
    depth = max(5.0, deficit * 0.6)
    if decision == "urgent":
        depth = max(depth, 20.0)
    return min(depth, 35.0)
