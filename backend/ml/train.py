"""Train the SmartMurima recommendation models on a synthetic, agronomically
structured dataset for Bugesera District, Rwanda.

This script is intentionally dependency-light and Django-independent so it can
be run standalone inside the backend container::

    docker exec sm_backend python ml/train.py
    # or, from backend/:  python ml/train.py

It generates a modest synthetic dataset whose feature/label relationships follow
established agronomy for semi-arid Bugesera (sandy-dominant soils, maize / beans
/ Irish potato / cassava), then trains and persists three real models:

  * ``irrigation_clf.joblib`` - RandomForest 3-class classifier
        (no_action / moderate / urgent)                              [UC-14]
  * ``fertilizer.joblib``     - RandomForest regressor, NPK rate kg/ha [UC-15]
  * ``yield_reg.json``        - XGBoost regressor, yield t/ha          [UC-16]

plus ``metadata.json`` capturing the feature order, label/encoder maps, metrics
and library versions so the artifacts are fully self-describing at inference.

Features (order fixed in metadata.json, matches ml.features.FeatureVector):
    0 soil_moisture          current volumetric water content (%)
    1 soil_moisture_3d       rolling 3-day mean (%)
    2 soil_moisture_7d       rolling 7-day mean (%)
    3 temperature            latest air temperature (C)
    4 humidity               relative humidity (%)
    5 rainfall_7d            recent + forecast rainfall over 7 days (mm)
    6 gdd                    growing degree days accumulated
    7 days_since_irrigation  days since last irrigation event
    8 days_since_planting    crop age (days) - growth-stage proxy
    9 crop_code              0 maize, 1 beans, 2 Irish potato, 3 cassava
   10 growth_stage_code      0 germ, 1 veg, 2 flowering, 3 maturity, 4 harvest
   11 soil_code              0 sandy .. 4 clay
"""
from __future__ import annotations

import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

# Django-independent import that works both as `python ml/train.py` (ml/ on the
# path) and `python -m ml.train` (package import).
try:
    from ml.encoders import IRRIGATION_LABELS
except Exception:  # pragma: no cover
    from encoders import IRRIGATION_LABELS  # type: ignore

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"

FEATURE_ORDER = [
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

N_SAMPLES = 1500
SEED = 42

# Crop agronomy priors (indexed by crop_code).
CROP_YIELD_POTENTIAL = {0: 5.5, 1: 2.8, 2: 22.0, 3: 18.0}  # t/ha
CROP_NPK_BASE = {0: 100.0, 1: 60.0, 2: 120.0, 3: 80.0}     # kg/ha
# Soil drainage factor: sandy soils dry fastest -> higher irrigation need.
SOIL_DRAIN = {0: 1.3, 1: 1.0, 2: 0.8, 3: 0.7, 4: 0.6}
# Crop water sensitivity by growth stage code.
STAGE_WATER_SENS = {0: 0.6, 1: 1.0, 2: 1.5, 3: 1.2, 4: 0.4}
# Fertilizer demand by growth stage code (top-dress in veg/flowering).
STAGE_FERT_FACTOR = {0: 0.4, 1: 1.0, 2: 0.8, 3: 0.2, 4: 0.0}


def generate_dataset(n: int = N_SAMPLES, seed: int = SEED):
    """Return (X, y_irrigation, y_fertilizer, y_yield) numpy arrays."""
    rng = np.random.default_rng(seed)

    crop = rng.integers(0, 4, n)
    stage = rng.integers(0, 5, n)
    soil = rng.integers(0, 5, n)

    # Current soil moisture (%) - semi-arid Bugesera skews dry.
    soil_moisture = np.clip(rng.normal(24, 9, n), 3, 48)
    # Rolling averages track current moisture with smoothing + slow drift.
    soil_moisture_3d = np.clip(soil_moisture + rng.normal(1.5, 3, n), 3, 50)
    soil_moisture_7d = np.clip(soil_moisture_3d + rng.normal(2.5, 4, n), 3, 52)

    temperature = np.clip(rng.normal(25, 3.2, n), 16, 34)  # Bugesera range
    humidity = np.clip(rng.normal(62, 14, n), 25, 95)
    rainfall_7d = np.clip(rng.gamma(1.4, 9, n), 0, 70)      # often low, right-skewed

    days_since_planting = rng.integers(0, 145, n).astype(float)
    days_since_irrigation = np.clip(rng.gamma(2.0, 2.2, n), 0, 18)

    # GDD accumulates with crop age and mean temperature above base (~10C).
    gdd = np.clip((temperature - 10.0) * (days_since_planting * 0.85)
                  + rng.normal(0, 30, n), 0, 2600)

    X = np.column_stack([
        soil_moisture, soil_moisture_3d, soil_moisture_7d, temperature, humidity,
        rainfall_7d, gdd, days_since_irrigation, days_since_planting,
        crop.astype(float), stage.astype(float), soil.astype(float),
    ])

    # ---- Irrigation label (3-class) --------------------------------------
    eff_moist = 0.5 * soil_moisture + 0.3 * soil_moisture_3d + 0.2 * soil_moisture_7d
    drain = np.array([SOIL_DRAIN[s] for s in soil])
    sens = np.array([STAGE_WATER_SENS[s] for s in stage])
    stress = (
        (28.0 - eff_moist) * drain
        + 0.45 * (temperature - 24.0)
        + 3.0 * sens
        - 0.55 * rainfall_7d
        + 0.6 * days_since_irrigation
        - 0.06 * humidity
        + rng.normal(0, 2.5, n)  # realism / label noise
    )
    y_irr = np.where(stress >= 9.0, 2, np.where(stress >= 1.5, 1, 0))

    # ---- Fertilizer rate (kg/ha NPK) -------------------------------------
    base = np.array([CROP_NPK_BASE[c] for c in crop])
    stage_f = np.array([STAGE_FERT_FACTOR[s] for s in stage])
    soil_f = np.array([SOIL_DRAIN[s] * 0.5 + 0.6 for s in soil])  # sandy needs more
    leach = np.where(rainfall_7d > 40, 15.0, 0.0)
    y_fert = np.clip(base * stage_f * soil_f + leach + rng.normal(0, 6, n), 0, 220)

    # ---- Yield (t/ha) ----------------------------------------------------
    potential = np.array([CROP_YIELD_POTENTIAL[c] for c in crop])
    moisture_adequacy = np.clip(soil_moisture_7d / 30.0, 0.4, 1.15)
    maturity = np.clip(days_since_planting / 120.0, 0.3, 1.0)
    gdd_factor = np.clip(gdd / 1600.0, 0.4, 1.1)
    fert_boost = 1.0 + np.clip(y_fert / 400.0, 0, 0.25)
    y_yield = np.clip(
        potential * moisture_adequacy * maturity * gdd_factor * fert_boost
        + rng.normal(0, 0.4, n),
        0.1, 32.0,
    )

    return X, y_irr.astype(int), y_fert, y_yield


def _metrics_clf(y_true, y_pred):
    from sklearn.metrics import accuracy_score, f1_score

    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro")), 4),
    }


def _metrics_reg(y_true, y_pred):
    from sklearn.metrics import mean_absolute_error, r2_score

    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def main():
    import joblib
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.model_selection import train_test_split

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Generating synthetic Bugesera dataset (n={N_SAMPLES}) ...")
    X, y_irr, y_fert, y_yield = generate_dataset()

    # Single, consistent split so features and every target stay row-aligned.
    idx = np.arange(len(X))
    tr, te = train_test_split(
        idx, test_size=0.2, random_state=SEED, stratify=y_irr
    )
    Xtr, Xte = X[tr], X[te]
    irr_tr, irr_te = y_irr[tr], y_irr[te]
    fert_tr, fert_te = y_fert[tr], y_fert[te]
    yld_tr, yld_te = y_yield[tr], y_yield[te]

    # ---- Irrigation classifier (RandomForest) ----------------------------
    print("Training irrigation classifier (RandomForest, 3-class) ...")
    irr_clf = RandomForestClassifier(
        n_estimators=80, max_depth=10, min_samples_leaf=4,
        class_weight="balanced", random_state=SEED, n_jobs=-1,
    )
    irr_clf.fit(Xtr, irr_tr)
    irr_metrics = _metrics_clf(irr_te, irr_clf.predict(Xte))
    joblib.dump(irr_clf, ARTIFACTS_DIR / "irrigation_clf.joblib", compress=3)
    print(f"  irrigation metrics: {irr_metrics}")

    # ---- Fertilizer regressor (RandomForest) -----------------------------
    print("Training fertilizer regressor (RandomForest) ...")
    fert_reg = RandomForestRegressor(
        n_estimators=80, max_depth=12, min_samples_leaf=4,
        random_state=SEED, n_jobs=-1,
    )
    fert_reg.fit(Xtr, fert_tr)
    fert_metrics = _metrics_reg(fert_te, fert_reg.predict(Xte))
    joblib.dump(fert_reg, ARTIFACTS_DIR / "fertilizer.joblib", compress=3)
    print(f"  fertilizer metrics: {fert_metrics}")

    # ---- Yield regressor (XGBoost, native JSON) --------------------------
    print("Training yield regressor (XGBoost) ...")
    import xgboost as xgb

    dtrain = xgb.DMatrix(Xtr, label=yld_tr)
    dtest = xgb.DMatrix(Xte, label=yld_te)
    params = {
        "objective": "reg:squarederror",
        "max_depth": 5,
        "eta": 0.1,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "seed": SEED,
    }
    booster = xgb.train(params, dtrain, num_boost_round=120,
                        evals=[(dtest, "test")], verbose_eval=False)
    yld_metrics = _metrics_reg(yld_te, booster.predict(dtest))
    booster.save_model(str(ARTIFACTS_DIR / "yield_reg.json"))
    print(f"  yield metrics: {yld_metrics}")

    # ---- Metadata --------------------------------------------------------
    versions = {"numpy": np.__version__}
    try:
        import sklearn
        versions["scikit-learn"] = sklearn.__version__
    except Exception:
        pass
    versions["xgboost"] = xgb.__version__

    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
        "versions": versions,
        "n_samples": N_SAMPLES,
        "seed": SEED,
        "feature_order": FEATURE_ORDER,
        "encoders": {
            "crop": {"maize": 0, "beans": 1, "irish_potato": 2, "cassava": 3},
            "growth_stage": {
                "germination": 0, "vegetative": 1, "flowering": 2,
                "maturity": 3, "harvest": 4,
            },
            "soil": {"sandy": 0, "sandy_loam": 1, "loam": 2, "clay_loam": 3, "clay": 4},
        },
        "irrigation": {
            "model": "RandomForestClassifier",
            "artifact": "irrigation_clf.joblib",
            "labels": {str(k): v for k, v in IRRIGATION_LABELS.items()},
            "metrics": irr_metrics,
        },
        "fertilizer": {
            "model": "RandomForestRegressor",
            "artifact": "fertilizer.joblib",
            "unit": "kg/ha",
            "metrics": fert_metrics,
        },
        "yield": {
            "model": "XGBoostRegressor",
            "artifact": "yield_reg.json",
            "unit": "t/ha",
            "metrics": yld_metrics,
        },
    }
    with open(ARTIFACTS_DIR / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2)

    print("\nArtifacts written to", ARTIFACTS_DIR)
    for f in ["irrigation_clf.joblib", "fertilizer.joblib", "yield_reg.json",
              "metadata.json"]:
        p = ARTIFACTS_DIR / f
        if p.exists():
            print(f"  {f}: {p.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
