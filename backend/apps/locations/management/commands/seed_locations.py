"""Seed the Rwanda administrative hierarchy (country -> province -> district
-> sector).

Idempotent: uses ``get_or_create`` keyed on (parent, name, level), so running
it repeatedly never duplicates nodes. Seeds the full set of 5 provinces and 30
districts, plus the sectors of Bugesera (the case-study district). More
sectors can be appended by extending ``SECTORS`` below -- no code changes.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.locations.models import Location, LocationLevel

COUNTRY = "Rwanda"

# province -> list of districts
DISTRICTS = {
    "Kigali City": ["Nyarugenge", "Gasabo", "Kicukiro"],
    "Southern": [
        "Nyanza", "Gisagara", "Nyaruguru", "Huye", "Nyamagabe",
        "Ruhango", "Muhanga", "Kamonyi",
    ],
    "Western": [
        "Karongi", "Rutsiro", "Rubavu", "Nyabihu", "Ngororero",
        "Rusizi", "Nyamasheke",
    ],
    "Northern": ["Rulindo", "Gakenke", "Musanze", "Burera", "Gicumbi"],
    "Eastern": [
        "Rwamagana", "Nyagatare", "Gatsibo", "Kayonza", "Kirehe",
        "Ngoma", "Bugesera",
    ],
}

# district -> list of sectors. Only Bugesera (case study) is fully enumerated
# here; append other districts' sectors from an official dataset later.
SECTORS = {
    "Bugesera": [
        "Gashora", "Juru", "Kamabuye", "Mareba", "Mayange", "Musenyi",
        "Mwogo", "Ngeruka", "Ntarama", "Nyamata", "Nyarugenge", "Rilima",
        "Ruhuha", "Rweru", "Shyara",
    ],
}


class Command(BaseCommand):
    help = "Seed Rwanda provinces, districts, and Bugesera sectors (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0

        country, made = Location.objects.get_or_create(
            parent=None, name=COUNTRY, level=LocationLevel.COUNTRY
        )
        created += int(made)

        districts_by_name = {}
        for province_name, districts in DISTRICTS.items():
            province, made = Location.objects.get_or_create(
                parent=country, name=province_name, level=LocationLevel.PROVINCE
            )
            created += int(made)
            for district_name in districts:
                district, made = Location.objects.get_or_create(
                    parent=province, name=district_name, level=LocationLevel.DISTRICT
                )
                created += int(made)
                districts_by_name[district_name] = district

        for district_name, sectors in SECTORS.items():
            district = districts_by_name.get(district_name)
            if district is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"District '{district_name}' not found; skipping its sectors."
                    )
                )
                continue
            for sector_name in sectors:
                _, made = Location.objects.get_or_create(
                    parent=district, name=sector_name, level=LocationLevel.SECTOR
                )
                created += int(made)

        total = Location.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Locations seeded: {created} new node(s), {total} total."
            )
        )
