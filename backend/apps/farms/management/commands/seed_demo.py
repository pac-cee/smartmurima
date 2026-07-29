"""Seed demo data so the whole system demos end-to-end.

Creates one active user per role, a couple of farms/fields, sensor nodes, and a
week of synthetic sensor readings (some below the low-moisture threshold to
trigger alerts). Idempotent: safe to run repeatedly.
"""
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.farms.models import Crop, Farm, Field, SensorNode
from apps.sensors.services import IngestionService

User = get_user_model()

DEMO_PASSWORD = "Demo1234!"

DEMO_USERS = [
    ("farmer_demo", "farmer@smartmurima.rw", "+250780000001", "farmer", "Jean Uwimana"),
    ("coop_demo", "coop@smartmurima.rw", "+250780000002", "coop_admin", "Marie Coop"),
    ("extension_demo", "ext@smartmurima.rw", "+250780000003", "extension", "Eric Ext"),
    ("admin_demo", "admin@smartmurima.rw", "+250780000004", "admin", "Admin User"),
]


class Command(BaseCommand):
    help = "Seed demo users, farms, fields, sensor nodes, and readings."

    def handle(self, *args, **options):
        users = {}
        for username, email, phone, role, full_name in DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "phone_number": phone,
                    "role": role,
                    "full_name": full_name,
                    "is_active": True,
                    "is_staff": role == "admin",
                    "is_superuser": role == "admin",
                },
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
            users[role] = user
        self.stdout.write(self.style.SUCCESS(f"Users ready ({len(users)} roles)."))

        maize, _ = Crop.objects.get_or_create(
            name="Maize", defaults={"base_temp": 10.0, "season": "Season A"}
        )
        beans, _ = Crop.objects.get_or_create(
            name="Beans", defaults={"base_temp": 8.0, "season": "Season B"}
        )

        farmer = users["farmer"]
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

        field_a, _ = Field.objects.get_or_create(
            farm=farm,
            name="North Plot",
            defaults={
                "crop": maize,
                "planting_date": timezone.now().date() - timedelta(days=40),
                "growth_stage": "vegetative",
                "area_hectares": 1.0,
            },
        )
        field_b, _ = Field.objects.get_or_create(
            farm=farm,
            name="South Plot",
            defaults={
                "crop": beans,
                "planting_date": timezone.now().date() - timedelta(days=20),
                "growth_stage": "flowering",
                "area_hectares": 1.5,
            },
        )
        field_c, _ = Field.objects.get_or_create(
            farm=farm,
            name="East Plot",
            defaults={
                "crop": maize,
                "planting_date": timezone.now().date() - timedelta(days=30),
                "growth_stage": "vegetative",
                "area_hectares": 1.2,
            },
        )

        # Device IDs match the IoT simulator (iot/simulator/simulate_nodes.py)
        # and firmware, so live telemetry lands on these demo fields out of the
        # box: smartmurima/<device_id>/telemetry -> ingestion -> field.
        node_a, _ = SensorNode.objects.get_or_create(
            device_id="node-bugesera-01",
            defaults={"field": field_a, "status": "active", "battery": 92},
        )
        node_b, _ = SensorNode.objects.get_or_create(
            device_id="node-bugesera-02",
            defaults={"field": field_b, "status": "active", "battery": 78},
        )
        node_c, _ = SensorNode.objects.get_or_create(
            device_id="node-bugesera-03",
            defaults={"field": field_c, "status": "active", "battery": 85},
        )

        # Generate a week of readings through the IngestionService so that the
        # alert rule fires exactly as it would in production.
        ingestion = IngestionService()
        rng = random.Random(42)
        now = timezone.now()
        made = 0
        node_base = {node_a.id: 22, node_b.id: 30, node_c.id: 26}
        for node in (node_a, node_b, node_c):
            for h in range(0, 7 * 24, 6):  # every 6h for 7 days
                ts = now - timedelta(hours=(7 * 24 - h))
                # Occasionally dip below the low-moisture threshold (20%).
                base = node_base[node.id]
                soil = max(5.0, base + rng.uniform(-10, 8))
                payload = {
                    "device_id": node.device_id,
                    "soil_moisture": round(soil, 1),
                    "temperature": round(20 + rng.uniform(-3, 8), 1),
                    "humidity": round(60 + rng.uniform(-10, 15), 1),
                    "rainfall": round(max(0.0, rng.uniform(-2, 4)), 1),
                    "timestamp": ts.isoformat(),
                    "battery": node.battery,
                }
                try:
                    if ingestion.ingest(payload) is not None:
                        made += 1
                except Exception as exc:  # pragma: no cover
                    self.stderr.write(f"reading skipped: {exc}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded farm '{farm.name}', 3 fields, 3 nodes "
                f"(node-bugesera-01/02/03), {made} readings."
            )
        )
        self.stdout.write(
            self.style.NOTICE(
                f"Demo login password for all demo users: {DEMO_PASSWORD}"
            )
        )
