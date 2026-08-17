"""Locations ORM: a self-referencing Rwanda administrative hierarchy.

Levels descend country -> province -> district -> sector. Each node points at
its ``parent`` (nullable only for the country root). Models hold fields, Meta,
and ``__str__``/path helpers only -- no business logic.
"""
from django.db import models


class LocationLevel(models.TextChoices):
    COUNTRY = "country", "Country"
    PROVINCE = "province", "Province"
    DISTRICT = "district", "District"
    SECTOR = "sector", "Sector"


class Location(models.Model):
    name = models.CharField(max_length=120)
    level = models.CharField(max_length=20, choices=LocationLevel.choices)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    code = models.CharField(max_length=20, blank=True, default="")

    class Meta:
        db_table = "locations_location"
        ordering = ["level", "name"]
        indexes = [
            models.Index(fields=["level", "parent"]),
            models.Index(fields=["name"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(level__in=[c[0] for c in LocationLevel.choices]),
                name="location_level_valid",
            ),
            models.UniqueConstraint(
                fields=["parent", "name", "level"],
                name="location_unique_child",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.level})"

    def path_names(self) -> list[str]:
        """Return names from the country root down to this node."""
        names: list[str] = []
        node = self
        # Guard against accidental cycles with a depth cap (hierarchy is 4 deep).
        for _ in range(8):
            if node is None:
                break
            names.append(node.name)
            node = node.parent
        return list(reversed(names))

    @property
    def full_path(self) -> str:
        """Human-readable path, e.g. 'Rwanda / Eastern / Bugesera / Nyamata'."""
        return " / ".join(self.path_names())
