"""Artifact loading helpers.

All loaders are best-effort: if the artifact file or the underlying library is
missing, they return ``None`` and the caller degrades to a heuristic stub.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from django.conf import settings

logger = logging.getLogger("smartmurima")


def artifact_path(filename: str) -> Path:
    return Path(settings.ML_ARTIFACTS_DIR) / filename


def load_sklearn_artifact(filename: str) -> Optional[object]:
    path = artifact_path(filename)
    if not path.exists():
        logger.warning("ML artifact %s not found; using heuristic stub.", path.name)
        return None
    try:
        import joblib

        return joblib.load(path)
    except Exception as exc:  # pragma: no cover - depends on optional deps
        logger.warning("Failed to load %s (%s); using heuristic stub.", path.name, exc)
        return None


def load_xgb_booster(filename: str) -> Optional[object]:
    """Load an XGBoost Booster saved in the native JSON format.

    Native JSON (``booster.save_model('*.json')``) is version-portable across
    xgboost releases, unlike pickled estimators.
    """
    path = artifact_path(filename)
    if not path.exists():
        logger.warning("ML artifact %s not found; using heuristic stub.", path.name)
        return None
    try:
        import xgboost as xgb

        booster = xgb.Booster()
        booster.load_model(str(path))
        return booster
    except Exception as exc:  # pragma: no cover - depends on optional deps
        logger.warning("Failed to load %s (%s); using heuristic stub.", path.name, exc)
        return None


def load_keras_artifact(filename: str) -> Optional[object]:
    path = artifact_path(filename)
    if not path.exists():
        logger.warning("CNN artifact %s not found; using heuristic stub.", path.name)
        return None
    try:
        from tensorflow import keras

        return keras.models.load_model(path)
    except Exception as exc:  # pragma: no cover - tf is optional
        logger.warning("Failed to load %s (%s); using heuristic stub.", path.name, exc)
        return None
