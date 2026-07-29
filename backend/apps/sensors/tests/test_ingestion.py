"""UT-01/UT-02 and IT-03: SensorReading ingestion via the MQTT service path."""
import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.alerts.models import Alert
from apps.farms.models import Farm, Field, SensorNode
from apps.sensors.models import SensorReading
from apps.sensors.services import IngestionService
from core.exceptions import NotFoundError, ValidationError


@pytest.fixture
def node(db):
    user = User.objects.create(username="farmer1", full_name="F1", role="farmer",
                               is_active=True)
    farm = Farm.objects.create(farmer=user, name="Farm", area_hectares=1)
    field = Field.objects.create(farm=farm, name="Plot", area_hectares=1)
    return SensorNode.objects.create(field=field, device_id="dev-1", status="active")


def _payload(node, **overrides):
    data = {
        "device_id": node.device_id,
        "soil_moisture": 30.0,
        "temperature": 22.0,
        "humidity": 60.0,
        "rainfall": 0.0,
        "timestamp": timezone.now().isoformat(),
    }
    data.update(overrides)
    return data


def test_ingest_creates_reading(db, node):
    # UT-01 / IT-03: valid payload persists a SensorReading and updates the node.
    reading = IngestionService().ingest(_payload(node))
    assert isinstance(reading, SensorReading)
    assert SensorReading.objects.count() == 1
    node.refresh_from_db()
    assert node.last_seen is not None


def test_missing_soil_moisture_rejected(db, node):
    # UT-02: missing soil_moisture must raise a validation error.
    payload = _payload(node)
    payload.pop("soil_moisture")
    with pytest.raises(ValidationError):
        IngestionService().ingest(payload)
    assert SensorReading.objects.count() == 0


def test_soil_moisture_out_of_range_rejected(db, node):
    with pytest.raises(ValidationError):
        IngestionService().ingest(_payload(node, soil_moisture=150))


def test_unknown_device_rejected(db, node):
    with pytest.raises(NotFoundError):
        IngestionService().ingest(_payload(node, device_id="ghost"))


def test_duplicate_reading_deduped(db, node):
    ts = timezone.now().isoformat()
    IngestionService().ingest(_payload(node, timestamp=ts))
    second = IngestionService().ingest(_payload(node, timestamp=ts))
    assert second is None
    assert SensorReading.objects.count() == 1


def test_low_moisture_raises_alert(db, node):
    IngestionService().ingest(_payload(node, soil_moisture=12.0))
    assert Alert.objects.filter(type="low_moisture").count() == 1
