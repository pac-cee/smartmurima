"""Feature engineering for the ML models.

``FeatureBuilder`` turns raw sensor/weather/field context into the numeric
feature vector the models expect: rolling soil-moisture averages, growing
degree days (GDD), days since irrigation, etc. Pure functions -> unit-testable.
"""
from __future__ import annotations

from dataclasses import dataclass, field as dc_field
from datetime import date, datetime
from typing import Optional, Sequence


@dataclass
class FeatureVector:
    soil_moisture: float = 0.0
    soil_moisture_3d: float = 0.0
    soil_moisture_7d: float = 0.0
    temperature: float = 0.0
    humidity: float = 0.0
    rainfall_7d: float = 0.0
    gdd: float = 0.0
    days_since_irrigation: float = 0.0
    days_since_planting: float = 0.0
    # Categorical context, integer-encoded (see ml.encoders). Defaults keep the
    # vector usable even when crop/soil metadata is unknown.
    crop_code: int = 0
    growth_stage_code: int = 1
    soil_code: int = 1
    extras: dict = dc_field(default_factory=dict)

    def as_list(self) -> list[float]:
        """The 9 sensor-derived numeric features (stable public contract)."""
        return [
            self.soil_moisture,
            self.soil_moisture_3d,
            self.soil_moisture_7d,
            self.temperature,
            self.humidity,
            self.rainfall_7d,
            self.gdd,
            self.days_since_irrigation,
            self.days_since_planting,
        ]

    def to_model_vector(self, feature_order: Sequence[str]) -> list[float]:
        """Assemble the exact feature vector a trained model expects.

        ``feature_order`` comes from ``metadata.json`` so ordering can never
        drift between training and inference.
        """
        return [float(getattr(self, name, 0.0) or 0.0) for name in feature_order]


class FeatureBuilder:
    """Builds a :class:`FeatureVector` from readings + context.

    ``readings`` is a sequence of objects/dicts each exposing ``soil_moisture``,
    ``temperature``, ``humidity``, ``rainfall``, and ``recorded_at``.
    """

    @staticmethod
    def _val(reading, key):
        if isinstance(reading, dict):
            return reading.get(key)
        return getattr(reading, key, None)

    @classmethod
    def _rolling_avg(cls, readings, key, days: int, now: datetime) -> float:
        cutoff = now.timestamp() - days * 86400
        vals = []
        for r in readings:
            ts = cls._val(r, "recorded_at")
            if ts is None:
                continue
            if isinstance(ts, datetime) and ts.timestamp() < cutoff:
                continue
            v = cls._val(r, key)
            if v is not None:
                vals.append(float(v))
        return sum(vals) / len(vals) if vals else 0.0

    @classmethod
    def _sum(cls, readings, key, days: int, now: datetime) -> float:
        cutoff = now.timestamp() - days * 86400
        total = 0.0
        for r in readings:
            ts = cls._val(r, "recorded_at")
            if isinstance(ts, datetime) and ts.timestamp() < cutoff:
                continue
            v = cls._val(r, key)
            if v is not None:
                total += float(v)
        return total

    @classmethod
    def build(
        cls,
        readings: Sequence,
        now: Optional[datetime] = None,
        base_temp: float = 10.0,
        planting_date: Optional[date] = None,
        last_irrigation: Optional[datetime] = None,
        weather: Optional[dict] = None,
        crop_name: Optional[str] = None,
        growth_stage: Optional[str] = None,
        soil_class: Optional[str] = None,
    ) -> FeatureVector:
        now = now or datetime.utcnow()
        readings = list(readings)
        latest = readings[-1] if readings else None

        soil = float(cls._val(latest, "soil_moisture") or 0.0) if latest else 0.0
        temp = float(cls._val(latest, "temperature") or 0.0) if latest else 0.0
        hum = float(cls._val(latest, "humidity") or 0.0) if latest else 0.0

        avg_temp_7d = cls._rolling_avg(readings, "temperature", 7, now)
        gdd = max(0.0, (avg_temp_7d - base_temp)) * 7 if avg_temp_7d else 0.0

        days_since_planting = 0.0
        if planting_date is not None:
            days_since_planting = max(
                0.0, (now.date() - planting_date).days
            )

        days_since_irrigation = 0.0
        if last_irrigation is not None:
            days_since_irrigation = max(
                0.0, (now - last_irrigation).total_seconds() / 86400
            )

        rainfall_7d = cls._sum(readings, "rainfall", 7, now)
        if weather:
            rainfall_7d += float(weather.get("rainfall_forecast_mm", 0) or 0)

        from .encoders import encode_crop, encode_growth_stage, encode_soil

        return FeatureVector(
            soil_moisture=soil,
            soil_moisture_3d=cls._rolling_avg(readings, "soil_moisture", 3, now),
            soil_moisture_7d=cls._rolling_avg(readings, "soil_moisture", 7, now),
            temperature=temp,
            humidity=hum,
            rainfall_7d=rainfall_7d,
            gdd=gdd,
            days_since_irrigation=days_since_irrigation,
            days_since_planting=days_since_planting,
            crop_code=encode_crop(crop_name),
            growth_stage_code=encode_growth_stage(growth_stage),
            soil_code=encode_soil(soil_class),
        )
