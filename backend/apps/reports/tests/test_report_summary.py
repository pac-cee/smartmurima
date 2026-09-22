"""The report payload must carry everything the charts need.

Regression: the API returned a nested summary while the client parsed a flat
one, so the Reports page failed its schema check and rendered nothing at all.
These assert the exact keys the page reads.
"""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.farms.models import Crop, Farm, Field, SensorNode
from apps.sensors.models import SensorReading


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def farm_with_readings(db):
    user = User.objects.create(
        username="reporter", full_name="Reporter", role="farmer", is_active=True
    )
    farm = Farm.objects.create(farmer=user, name="Report Farm", area_hectares=2)
    crop = Crop.objects.create(name="Maize")
    field = Field.objects.create(farm=farm, name="North", crop=crop, area_hectares=1)
    # A second section with no telemetry: it must still appear, with nulls.
    Field.objects.create(farm=farm, name="Fallow", area_hectares=1)
    node = SensorNode.objects.create(field=field, device_id="SM-REPORT", token="tok-r")

    now = timezone.now()
    # Spread across two days and all four moisture bands.
    for i, moisture in enumerate([10.0, 30.0, 50.0, 80.0]):
        SensorReading.objects.create(
            sensor_node=node,
            soil_moisture=moisture,
            temperature=22.0,
            humidity=60.0,
            rainfall=1.0,
            recorded_at=now - timezone.timedelta(hours=i * 12),
        )
    return user, farm, field


def test_summary_carries_every_chart_series(db, client, farm_with_readings):
    user, farm, _ = farm_with_readings
    client.force_authenticate(user)

    resp = client.get(f"/api/v1/reports/summary?farm={farm.id}")
    assert resp.status_code == 200, resp.content
    data = resp.data

    # Keys the Reports page reads. A missing one blanks the whole screen.
    for key in (
        "series",
        "moisture_distribution",
        "advice_breakdown",
        "health_breakdown",
        "per_field",
        "readings",
        "disease_reports",
        "field_count",
        "generated_at",
        "empty",
    ):
        assert key in data, f"missing '{key}'"

    assert data["empty"] is False
    assert data["field_count"] == 2

    # Daily trend, one point per day, chronological.
    assert len(data["series"]) >= 1
    point = data["series"][0]
    assert set(point) >= {"date", "soil_moisture", "temperature", "humidity", "rainfall"}
    assert [p["date"] for p in data["series"]] == sorted(p["date"] for p in data["series"])

    # Every reading lands in exactly one moisture band.
    bands = {b["label"]: b["count"] for b in data["moisture_distribution"]}
    assert bands == {"dry": 1, "low": 1, "optimal": 1, "wet": 1}
    assert sum(bands.values()) == data["readings"]["reading_count"]


def test_a_section_with_no_telemetry_is_still_listed(db, client, farm_with_readings):
    user, farm, _ = farm_with_readings
    client.force_authenticate(user)
    data = client.get(f"/api/v1/reports/summary?farm={farm.id}").data

    by_name = {f["name"]: f for f in data["per_field"]}
    assert set(by_name) == {"North", "Fallow"}
    assert by_name["North"]["reading_count"] == 4
    assert by_name["North"]["crop"] == "Maize"
    # Reported honestly as "no data", never as a misleading zero.
    assert by_name["Fallow"]["reading_count"] == 0
    assert by_name["Fallow"]["avg_soil_moisture"] is None


def test_a_farm_with_nothing_reports_empty_rather_than_erroring(db, client):
    user = User.objects.create(
        username="fresh", full_name="Fresh", role="farmer", is_active=True
    )
    farm = Farm.objects.create(farmer=user, name="Brand New", area_hectares=1)
    client.force_authenticate(user)

    resp = client.get(f"/api/v1/reports/summary?farm={farm.id}")
    assert resp.status_code == 200, resp.content
    assert resp.data["empty"] is True
    assert resp.data["series"] == []
    assert resp.data["readings"]["reading_count"] == 0


def test_another_farmers_report_is_refused(db, client, farm_with_readings):
    _, farm, _ = farm_with_readings
    intruder = User.objects.create(
        username="nosy", full_name="Nosy", role="farmer", is_active=True
    )
    client.force_authenticate(intruder)
    assert client.get(f"/api/v1/reports/summary?farm={farm.id}").status_code == 403
