"""The device-facing IoT contract: announce -> claim -> telemetry -> command.

These exercise the exact HTTP shapes firmware/agrimind_smart_farm sends, so a
change that would silently break a board in the field fails here first.
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.farms.models import Farm, Field, SensorNode
from apps.sensors.models import SensorReading

ANNOUNCE = "/api/v1/iot/announce/"
TELEMETRY = "/api/v1/iot/telemetry/"
HARDWARE_ID = "ESP32-TEST01"


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def farmer(db):
    return User.objects.create(
        username="claudine", full_name="Claudine U", role="farmer", is_active=True
    )


@pytest.fixture
def field(db, farmer):
    farm = Farm.objects.create(farmer=farmer, name="Farm", area_hectares=1)
    return Field.objects.create(farm=farm, name="Plot", area_hectares=1)


def firmware_body(token, moisture=31.2, pump=False):
    """The payload the ESP32 actually builds, including its optimal bands."""
    return {
        "token": token,
        "readings": [
            {"sensor_type": "moisture", "value": moisture, "optimal_min": 40.0, "optimal_max": 65.0},
            {"sensor_type": "temperature", "value": 24.6, "optimal_min": 18.0, "optimal_max": 30.0},
            {"sensor_type": "ph", "value": 6.41, "optimal_min": 6.0, "optimal_max": 7.0},
            {"sensor_type": "ec", "value": 1.204, "optimal_min": 0.8, "optimal_max": 1.6},
            {"sensor_type": "nitrogen", "value": 47, "optimal_min": 30.0, "optimal_max": 60.0},
            {"sensor_type": "phosphorus", "value": 29, "optimal_min": 20.0, "optimal_max": 40.0},
            {"sensor_type": "potassium", "value": 131, "optimal_min": 100.0, "optimal_max": 160.0},
        ],
        "pump": pump,
    }


def test_announce_registers_an_unclaimed_device(db, client):
    resp = client.post(
        ANNOUNCE, {"hardware_id": HARDWARE_ID, "name": "AgriMind-01"}, format="json"
    )
    assert resp.status_code == 200, resp.content
    assert resp.data["status"] == "pending"
    # No token before a farmer claims it -- an unclaimed board cannot post data.
    assert "token" not in resp.data

    node = SensorNode.objects.get(hardware_id=HARDWARE_ID)
    assert node.field is None
    assert node.token is None
    assert node.last_seen is not None


def test_announce_is_idempotent(db, client):
    client.post(ANNOUNCE, {"hardware_id": HARDWARE_ID}, format="json")
    client.post(ANNOUNCE, {"hardware_id": HARDWARE_ID}, format="json")
    assert SensorNode.objects.filter(hardware_id=HARDWARE_ID).count() == 1


def test_claiming_hands_the_token_back_on_the_next_announce(db, client, farmer, field):
    """The pairing story: no re-flash, no copy-pasted token."""
    client.post(ANNOUNCE, {"hardware_id": HARDWARE_ID}, format="json")
    node = SensorNode.objects.get(hardware_id=HARDWARE_ID)

    client.force_authenticate(farmer)
    claim = client.post(
        f"/api/v1/sensor-nodes/{node.id}/claim", {"field": field.id}, format="json"
    )
    assert claim.status_code == 200, claim.content
    assert claim.data["is_claimed"] is True
    client.force_authenticate(None)

    again = client.post(ANNOUNCE, {"hardware_id": HARDWARE_ID}, format="json")
    assert again.data["status"] == "claimed"
    node.refresh_from_db()
    assert again.data["token"] == node.token


def test_telemetry_stores_every_channel_and_returns_a_command(db, client, farmer, field):
    node = SensorNode.objects.create(
        field=field, device_id="SM-TEST01", hardware_id=HARDWARE_ID, token="tok-123"
    )

    resp = client.post(TELEMETRY, firmware_body(node.token), format="json")
    assert resp.status_code == 200, resp.content

    # The command block the firmware parses on every response.
    command = resp.data["command"]
    assert command == {
        "pump_mode": "auto",
        "pump_on": None,  # null in auto mode: the board uses its own thresholds
        "dry_level": node.dry_level,
        "wet_level": node.wet_level,
    }

    reading = SensorReading.objects.get(sensor_node=node)
    assert reading.soil_moisture == 31.2
    assert reading.temperature == 24.6
    assert reading.ph == 6.41
    assert reading.ec == 1.204
    assert (reading.nitrogen, reading.phosphorus, reading.potassium) == (47, 29, 131)
    # The RS485 probe has no air-humidity channel; it must stay null, not 0.
    assert reading.humidity is None


def test_telemetry_rejects_an_unknown_token(db, client):
    resp = client.post(TELEMETRY, firmware_body("not-a-real-token"), format="json")
    assert resp.status_code == 403
    assert SensorReading.objects.count() == 0


def test_telemetry_rejects_a_device_that_is_not_claimed(db, client):
    SensorNode.objects.create(device_id="SM-LOOSE", hardware_id="HW-LOOSE", token="tok-loose")
    resp = client.post(TELEMETRY, firmware_body("tok-loose"), format="json")
    assert resp.status_code == 403


def test_pump_override_reaches_the_device(db, client, farmer, field):
    """Farmer taps 'force on' -> the device sees it on its very next POST."""
    node = SensorNode.objects.create(
        field=field, device_id="SM-TEST02", hardware_id="HW-2", token="tok-2"
    )

    client.force_authenticate(farmer)
    resp = client.post(
        f"/api/v1/sensor-nodes/{node.id}/pump",
        {"pump_mode": "manual", "pump_on": True},
        format="json",
    )
    assert resp.status_code == 200, resp.content
    client.force_authenticate(None)

    telemetry = client.post(TELEMETRY, firmware_body("tok-2", pump=True), format="json")
    assert telemetry.data["command"]["pump_mode"] == "manual"
    assert telemetry.data["command"]["pump_on"] is True

    # What the pump reported is tracked separately from what we commanded.
    node.refresh_from_db()
    assert node.pump_state is True


def test_returning_to_auto_clears_the_override(db, client, farmer, field):
    node = SensorNode.objects.create(
        field=field, device_id="SM-TEST03", hardware_id="HW-3", token="tok-3",
        pump_mode="manual", pump_on=True,
    )
    client.force_authenticate(farmer)
    client.post(f"/api/v1/sensor-nodes/{node.id}/pump", {"pump_mode": "auto"}, format="json")

    node.refresh_from_db()
    assert node.pump_mode == "auto"
    assert node.pump_on is None


def test_thresholds_must_keep_dry_below_wet(db, client, farmer, field):
    node = SensorNode.objects.create(
        field=field, device_id="SM-TEST04", hardware_id="HW-4", token="tok-4"
    )
    client.force_authenticate(farmer)
    bad = client.post(
        f"/api/v1/sensor-nodes/{node.id}/thresholds",
        {"dry_level": 70, "wet_level": 50},
        format="json",
    )
    assert bad.status_code == 400

    good = client.post(
        f"/api/v1/sensor-nodes/{node.id}/thresholds",
        {"dry_level": 35, "wet_level": 60},
        format="json",
    )
    assert good.status_code == 200
    node.refresh_from_db()
    assert (node.dry_level, node.wet_level) == (35, 60)


def test_a_farmer_cannot_claim_a_device_onto_someone_elses_field(db, client, field):
    other = User.objects.create(
        username="intruder", full_name="Intruder", role="farmer", is_active=True
    )
    node = SensorNode.objects.create(device_id="SM-TEST05", hardware_id="HW-5")

    client.force_authenticate(other)
    resp = client.post(
        f"/api/v1/sensor-nodes/{node.id}/claim", {"field": field.id}, format="json"
    )
    assert resp.status_code == 403
    node.refresh_from_db()
    assert node.field is None
