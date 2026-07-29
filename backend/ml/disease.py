"""Crop-disease CNN (MobileNetV2/Keras) with a deterministic stub.

When TensorFlow/Keras or the trained artifact is unavailable, ``predict``
returns a deterministic pseudo-classification derived from the image bytes so
the endpoint still responds (clearly flagged ``source=stub``, low confidence
per UC-18 A2/E2). When the real ``.keras`` artifact and ``labels.json`` are
present (and TF installed), the trained network is used.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings

from .loader import load_keras_artifact

logger = logging.getLogger("smartmurima")

ARTIFACT = "disease_mobilenetv2.keras"
LABELS_FILE = "labels.json"

# Confidence below which a diagnosis is flagged unreliable (UC-18 E2, BR-D2).
LOW_CONFIDENCE_THRESHOLD = float(getattr(settings, "DISEASE_CONF_THRESHOLD", 0.6))

# Representative label set + management guidance. ``label`` matches the class
# names produced by train_disease.py (folder names in the ImageFolder dataset).
CLASS_GUIDE = {
    "healthy": (True, "No disease detected. Maintain good field hygiene and monitoring."),
    "maize_leaf_blight": (
        False,
        "Remove infected leaves; apply recommended fungicide; rotate with non-host crops.",
    ),
    "bean_rust": (
        False,
        "Apply sulphur-based fungicide; avoid overhead irrigation; use resistant varieties.",
    ),
    "cassava_mosaic": (
        False,
        "Uproot and destroy infected plants; use certified disease-free resistant cuttings; control whiteflies.",
    ),
    "potato_late_blight": (
        False,
        "Apply protective fungicide; improve drainage; remove volunteers and infected haulms.",
    ),
}

# Ordered fallback labels used by the stub when no labels.json is present.
STUB_LABELS = list(CLASS_GUIDE.keys())


def _guide(label: str):
    healthy, treatment = CLASS_GUIDE.get(
        label, (False, "Consult a RAB/MINAGRI extension officer for diagnosis.")
    )
    # Any label containing "healthy" is treated as healthy.
    if "healthy" in label.lower():
        healthy = True
    return healthy, treatment


@dataclass
class DiseasePrediction:
    disease: str
    is_healthy: bool
    confidence: float
    treatment: str
    details: dict


class DiseaseClassifier:
    def __init__(self):
        self._model = load_keras_artifact(ARTIFACT)
        self._labels = self._load_labels()

    @staticmethod
    def _load_labels():
        path = Path(settings.ML_ARTIFACTS_DIR) / LABELS_FILE
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            # Accept either ["a","b"] or {"0":"a","1":"b"}.
            if isinstance(data, dict):
                return [data[k] for k in sorted(data, key=lambda x: int(x))]
            return list(data)
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to read %s (%s).", path.name, exc)
            return None

    @property
    def using_stub(self) -> bool:
        return self._model is None

    def predict(self, image_bytes: bytes) -> DiseasePrediction:
        if self._model is not None and self._labels:
            try:
                return self._predict_model(image_bytes)
            except Exception as exc:  # pragma: no cover - tf optional
                logger.error("Disease model failed (%s); falling back.", exc)
        return self._predict_stub(image_bytes)

    def _predict_model(self, image_bytes: bytes) -> DiseasePrediction:
        import io

        import numpy as np
        from PIL import Image
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224))
        arr = preprocess_input(np.expand_dims(np.array(img, dtype="float32"), 0))
        probs = self._model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(probs))
        label = self._labels[idx % len(self._labels)]
        healthy, treatment = _guide(label)
        confidence = round(float(probs[idx]), 2)
        return DiseasePrediction(
            disease=label,
            is_healthy=healthy,
            confidence=confidence,
            treatment=treatment,
            details={
                "source": "model",
                "stub": False,
                "low_confidence": confidence < LOW_CONFIDENCE_THRESHOLD,
                "threshold": LOW_CONFIDENCE_THRESHOLD,
            },
        )

    def _predict_stub(self, image_bytes: bytes) -> DiseasePrediction:
        labels = self._labels or STUB_LABELS
        digest = hashlib.sha256(image_bytes or b"empty").digest()
        idx = digest[0] % len(labels)
        label = labels[idx]
        healthy, treatment = _guide(label)
        # Stub confidence intentionally capped below the threshold so a stubbed
        # diagnosis is never presented as definitive (BR-D2, UC-18 A2).
        confidence = round(0.35 + (digest[1] % 20) / 100.0, 2)
        return DiseasePrediction(
            disease=label,
            is_healthy=healthy,
            confidence=confidence,
            treatment=treatment,
            details={
                "source": "stub",
                "stub": True,
                "low_confidence": confidence < LOW_CONFIDENCE_THRESHOLD,
                "threshold": LOW_CONFIDENCE_THRESHOLD,
                "note": "CNN artifact unavailable; diagnosis is not definitive.",
            },
        )
