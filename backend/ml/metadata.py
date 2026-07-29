"""Loader for the training ``metadata.json`` artifact.

``metadata.json`` records the exact feature order, label maps and metrics that
the trained models were built with. Inference wrappers use it to assemble the
feature vector in the right order and to translate class indices back into
human-readable decisions. Missing/absent metadata degrades gracefully.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Optional

from django.conf import settings

logger = logging.getLogger("smartmurima")

METADATA_FILE = "metadata.json"

# The canonical model feature order. Kept in sync with train.py and used as the
# fallback when metadata.json is absent so the model input contract is stable.
DEFAULT_FEATURE_ORDER = [
    "soil_moisture",
    "soil_moisture_3d",
    "soil_moisture_7d",
    "temperature",
    "humidity",
    "rainfall_7d",
    "gdd",
    "days_since_irrigation",
    "days_since_planting",
    "crop_code",
    "growth_stage_code",
    "soil_code",
]


@lru_cache(maxsize=1)
def load_metadata() -> Optional[dict]:
    from pathlib import Path

    path = Path(settings.ML_ARTIFACTS_DIR) / METADATA_FILE
    if not path.exists():
        logger.warning("ML metadata %s not found; using default feature order.", path.name)
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to read %s (%s).", path.name, exc)
        return None


def feature_order() -> list[str]:
    meta = load_metadata()
    if meta and isinstance(meta.get("feature_order"), list):
        return meta["feature_order"]
    return list(DEFAULT_FEATURE_ORDER)


def clear_cache() -> None:
    """Drop the cached metadata (useful right after (re)training in-process)."""
    load_metadata.cache_clear()
