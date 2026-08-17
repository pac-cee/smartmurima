"""Seed demo data so the whole system demos end-to-end.

Creates a set of crops, one active demo farmer with a Farmer profile, a farm,
three fields, and exactly two sensor nodes (``SM-NODE-01`` / ``SM-NODE-02`` --
the fixed device-id contract an external simulator publishes to), plus ~48h of
historical readings per node and a sample alert.

Idempotent: safe to run repeatedly. Readings are generated only when a node has
none yet, so re-running never duplicates telemetry.
"""
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.accounts.models import Farmer
from apps.alerts.models import Alert, AlertType, Severity
from apps.farms.models import Crop, Farm, Field, SensorNode
from apps.sensors.models import SensorReading

User = get_user_model()

FARMER_EMAIL = "farmer@smartmurima.rw"
FARMER_PHONE = "+250780000001"
FARMER_PASSWORD = "farmer12345"

CROPS = [
    ("Maize", 10.0, "Season A"),
    ("Beans", 8.0, "Season B"),
    ("Irish Potato", 7.0, "Season A"),
    ("Cassava", 12.0, "Season B"),
]

# Fixed device-id contract: an external simulator publishes to these ids.
NODE_A_DEVICE_ID = "SM-NODE-01"
NODE_B_DEVICE_ID = "SM-NODE-02"


class Command(BaseCommand):
    help = "Seed demo crops, a farmer, a farm, fields, sensor nodes, and readings."

    def handle(self, *args, **options):
        # -- crops --------------------------------------------------------
        crops = {}
        for name, base_temp, season in CROPS:
            crop, _ = Crop.objects.get_or_create(
                name=name, defaults={"base_temp": base_temp, "season": season}
            )
            crops[name] = crop
        self.stdout.write(self.style.SUCCESS(f"Crops ready ({len(crops)})."))

        # -- demo farmer --------------------------------------------------
        farmer, created = User.objects.get_or_create(
            username="farmer_demo",
            defaults={
                "email": FARMER_EMAIL,
                "phone_number": FARMER_PHONE,
                "role": "farmer",
                "full_name": "Jean Uwimana",
                "is_active": True,
                "is_staff": False,
                "is_superuser": False,
            },
        )
        # Always guarantee the documented dev password + active state, even when
        # the account already exists from an earlier seed.
        farmer.set_password(FARMER_PASSWORD)
        farmer.is_active = True
        if not farmer.email:
            farmer.email = FARMER_EMAIL
        farmer.save()
        Farmer.objects.get_or_create(
            user=farmer, defaults={"cooperative_name": "Bugesera Coop"}
        )
        self.stdout.write(self.style.SUCCESS(f"Demo farmer ready ({FARMER_EMAIL})."))

        # -- farm ---------------------------------------------------------
        farm, _ = Farm.objects.get_or_create(
            farmer=farmer,
            name="Bugesera Demo Farm",
            defaults={
                "sector": "Nyamata",
                "latitude": -2.1497,
                "longitude": 30.0935,
                "area_hectares": 2.5,
            },
        )

        # -- fields -------------------------------------------------------
        field_a, _ = Field.objects.get_or_create(
            farm=farm,
            name="North Plot",
            defaults={
                "crop": crops["Maize"],
                "planting_date": timezone.now().date() - timedelta(days=40),
                "growth_stage": "vegetative",
                "area_hectares": 1.0,
            },
        )
        field_b, _ = Field.objects.get_or_create(
            farm=farm,
            name="South Plot",
            defaults={
                "crop": crops["Beans"],
                "planting_date": timezone.now().date() - timedelta(days=20),
                "growth_stage": "flowering",
                "area_hectares": 1.5,
            },
        )
        Field.objects.get_or_create(
            farm=farm,
            name="East Plot",
            defaults={
                "crop": crops["Irish Potato"],
                "planting_date": timezone.now().date() - timedelta(days=30),
                "growth_stage": "vegetative",
                "area_hectares": 1.2,
            },
        )

        # -- sensor nodes (fixed device-id contract) ----------------------
        node_a, _ = SensorNode.objects.get_or_create(
            device_id=NODE_A_DEVICE_ID,
            defaults={"field": field_a, "status": "active", "battery": 92},
        )
        node_b, _ = SensorNode.objects.get_or_create(
            device_id=NODE_B_DEVICE_ID,
            defaults={"field": field_b, "status": "active", "battery": 78},
        )

        # -- ~48h of historical readings per node -------------------------
        rng = random.Random(42)
        now = timezone.now()
        made = 0
        node_base = {node_a.id: 24, node_b.id: 30}
        for node in (node_a, node_b):
            if SensorReading.objects.filter(sensor_node=node).exists():
                continue  # idempotent: don't duplicate telemetry
            base = node_base[node.id]
            rows = []
            # 48 hours at 30-minute intervals.
            for i in range(96):
                ts = now - timedelta(minutes=30 * i)
                soil = max(5.0, min(100.0, base + rng.uniform(-10, 8)))
                rows.append(
                    SensorReading(
                        sensor_node=node,
                        soil_moisture=round(soil, 1),
                        temperature=round(20 + rng.uniform(-3, 8), 1),
                        humidity=round(60 + rng.uniform(-10, 15), 1),
                        rainfall=round(max(0.0, rng.uniform(-2, 4)), 1),
                        recorded_at=ts,
                    )
                )
            SensorReading.objects.bulk_create(rows, ignore_conflicts=True)
            node.last_seen = now
            node.save(update_fields=["last_seen"])
            made += len(rows)

        # -- sample alert -------------------------------------------------
        Alert.objects.get_or_create(
            user=farmer,
            type=AlertType.LOW_MOISTURE,
            message=(
                f"Low soil moisture detected in field '{field_a.name}'. "
                "Consider irrigating."
            ),
            defaults={
                "severity": Severity.WARNING,
                "context": {"field_id": field_a.id, "soil_moisture": 18.0},
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded farm '{farm.name}', 3 fields, 2 nodes "
                f"({NODE_A_DEVICE_ID}/{NODE_B_DEVICE_ID}), {made} readings, 1 alert."
            )
        )
        self.stdout.write(
            self.style.NOTICE(
                f"Demo farmer login: {FARMER_EMAIL} / {FARMER_PASSWORD}"
            )
        )
