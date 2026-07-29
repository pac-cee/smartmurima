"""Categorical encoders shared by training (``train.py``) and inference.

Keeping the crop / growth-stage / soil-class encodings in one place guarantees
that the integer codes a model was trained on are exactly the codes the
inference wrappers feed back in. The maps are also written into
``metadata.json`` so an artifact is fully self-describing.
"""
from __future__ import annotations

# Crops relevant to Bugesera smallholders. Keys are matched case-insensitively
# against substrings of the crop name so "Irish Potato", "irish_potato" and
# "potato" all resolve to the same code.
CROP_CODES = {
    "maize": 0,
    "bean": 1,
    "potato": 2,
    "cassava": 3,
}
CROP_DEFAULT = 0

# Field.growth_stage choices (see apps/farms GrowthStage) plus common synonyms.
GROWTH_STAGE_CODES = {
    "germination": 0,
    "seedling": 0,
    "vegetative": 1,
    "flowering": 2,
    "grain_filling": 3,
    "tuber_bulking": 3,
    "maturity": 3,
    "harvest": 4,
}
GROWTH_STAGE_DEFAULT = 1

# Soil texture classes typical of semi-arid Bugesera (sandy dominant).
SOIL_CODES = {
    "sandy": 0,
    "sandy_loam": 1,
    "loam": 2,
    "clay_loam": 3,
    "clay": 4,
}
SOIL_DEFAULT = 1  # sandy_loam is the Bugesera default assumption


def _encode(value, table, default) -> int:
    if value is None:
        return default
    key = str(value).strip().lower().replace(" ", "_")
    if key in table:
        return table[key]
    # substring match (e.g. "irish_potato" -> "potato")
    for name, code in table.items():
        if name in key:
            return code
    return default


def encode_crop(name) -> int:
    return _encode(name, CROP_CODES, CROP_DEFAULT)


def encode_growth_stage(stage) -> int:
    return _encode(stage, GROWTH_STAGE_CODES, GROWTH_STAGE_DEFAULT)


def encode_soil(soil_class) -> int:
    return _encode(soil_class, SOIL_CODES, SOIL_DEFAULT)


# Irrigation decision labels (3-class, ordered by urgency) — UC-14.
IRRIGATION_LABELS = {0: "no_action", 1: "moderate", 2: "urgent"}

# Crop-specific NPK blend guidance surfaced alongside the regressed rate.
FERTILIZER_BLEND = {
    0: "NPK 17-17-17 (maize)",
    1: "DAP + rhizobia, low N (beans)",
    2: "NPK 17-17-17 + K top-dress (Irish potato)",
    3: "NPK 17-17-17, split (cassava)",
}
