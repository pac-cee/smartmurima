"""Seed the Rwanda administrative hierarchy (country -> province -> district
-> sector) from the bundled official dataset.

Idempotent: uses ``get_or_create`` keyed on (parent, name, level), so running
it repeatedly never duplicates nodes. Loads the full 5 provinces / 30 districts
/ 416 sectors from ``apps/locations/rwanda_admin.json``. Falls back to a small
embedded set (Kigali + Bugesera) if that file is missing.
"""
import json
from pathlib import Path

import apps.locations
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.locations.models import Location, LocationLevel

COUNTRY = "Rwanda"
DATA_FILE = Path(apps.locations.__file__).resolve().parent / "rwanda_admin.json"

# Minimal fallback if the dataset file is absent.
FALLBACK = {
    "Kigali City": {"Gasabo": [], "Kicukiro": [], "Nyarugenge": []},
    "Eastern": {
        "Bugesera": [
            "Gashora", "Juru", "Kamabuye", "Mareba", "Mayange", "Musenyi",
            "Mwogo", "Ngeruka", "Ntarama", "Nyamata", "Nyarugenge", "Rilima",
            "Ruhuha", "Rweru", "Shyara",
        ]
    },
}


class Command(BaseCommand):
    help = "Seed Rwanda provinces, districts and sectors from the bundled dataset (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        if DATA_FILE.exists():
            data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        else:
            self.stdout.write(self.style.WARNING(f"{DATA_FILE.name} missing; using fallback set."))
            data = FALLBACK

        created = 0
        country, made = Location.objects.get_or_create(
            parent=None, name=COUNTRY, level=LocationLevel.COUNTRY
        )
        created += int(made)

        for province_name, districts in data.items():
            province, made = Location.objects.get_or_create(
                parent=country, name=province_name, level=LocationLevel.PROVINCE
            )
            created += int(made)
            for district_name, sectors in districts.items():
                district, made = Location.objects.get_or_create(
                    parent=province, name=district_name, level=LocationLevel.DISTRICT
                )
                created += int(made)
                for sector_name in sectors:
                    _, made = Location.objects.get_or_create(
                        parent=district, name=sector_name, level=LocationLevel.SECTOR
                    )
                    created += int(made)

        total = Location.objects.count()
        by = {
            lvl: Location.objects.filter(level=lvl).count()
            for lvl in ("country", "province", "district", "sector")
        }
        self.stdout.write(
            self.style.SUCCESS(
                f"Locations seeded: {created} new, {total} total "
                f"(provinces={by['province']}, districts={by['district']}, sectors={by['sector']})."
            )
        )
