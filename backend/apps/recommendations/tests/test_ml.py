"""UT-03: rolling-average feature; UT-04: irrigation prediction shape.

IT-04: irrigation recommendation endpoint returns the contract shape using the
deterministic ML stub (no artifacts present).
"""
from datetime import datetime, timedelta, timezone

import pytest
from django.utils import timezone as dj_tz

from apps.accounts.models import User
from apps.farms.models import Crop, Farm, Field, SensorNode
from apps.recommendations.services import RecommendationService
from apps.sensors.models import SensorReading
from ml.features import FeatureBuilder
from ml.irrigation import IrrigationClassifier, IrrigationPrediction


def test_rolling_average_feature():
    # UT-03: 3-day and 7-day rolling soil-moisture averages.
    now = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)
    readings = [
        {"soil_moisture": 10, "temperature": 20, "recorded_at": now - timedelta(days=6)},
        {"soil_moisture": 20, "temperature": 22, "recorded_at": now - timedelta(days=2)},
        {"soil_moisture": 30, "temperature": 24, "recorded_at": now - timedelta(hours=1)},
    ]
    fv = FeatureBuilder.build(readings, now=now, base_temp=10.0)
    # 3-day window includes the last two readings (20, 30) -> 25.
    assert fv.soil_moisture_3d == pytest.approx(25.0)
    # 7-day window includes all three (10, 20, 30) -> 20.
    assert fv.soil_moisture_7d == pytest.approx(20.0)
    assert len(fv.as_list()) == 9


def test_irrigation_prediction_shape():
    # UT-04: prediction has the expected fields and value ranges (stub path).
    fv = FeatureBuilder.build(
        [{"soil_moisture": 15, "temperature": 25,
          "recorded_at": datetime.now(timezone.utc)}],
        now=datetime.now(timezone.utc),
    )
    pred = IrrigationClassifier().predict(fv)
    assert isinstance(pred, IrrigationPrediction)
    assert pred.decision in ("no_action", "moderate", "urgent")
    assert 0.0 <= pred.confidence <= 1.0
    assert pred.unit == "mm"
    assert pred.value >= 0.0
    assert pred.details.get("source") in ("model", "stub")


@pytest.fixture
def field(db):
    user = User.objects.create(username="f", full_name="F", role="farmer",
                               is_active=True)
    farm = Farm.objects.create(farmer=user, name="Farm", area_hectares=1)
    crop = Crop.objects.create(name="Maize", base_temp=10)
    field = Field.objects.create(farm=farm, crop=crop, name="Plot", area_hectares=1)
    node = SensorNode.objects.create(field=field, device_id="d1")
    SensorReading.objects.create(
        sensor_node=node, soil_moisture=15, temperature=25, humidity=55,
        rainfall=0, recorded_at=dj_tz.now(),
    )
    return field, user


def test_irrigation_endpoint_persists_and_returns(db, field):
    field_obj, user = field
    rec = RecommendationService().irrigation(user, field_obj.id)
    assert rec.type == "irrigation"
    assert rec.field_id == field_obj.id
    assert 0.0 <= rec.confidence <= 1.0
    assert rec.details.get("source") in ("stub", "model")
