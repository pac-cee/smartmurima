"""Farms domain ORM: Crop, Farm, Field, SensorNode."""
from django.conf import settings
from django.db import models


class Crop(models.Model):
    name = models.CharField(max_length=120, unique=True)
    base_temp = models.DecimalField(
        max_digits=5, decimal_places=2, default=10.0,
        help_text="Base temperature (°C) for GDD accumulation.",
    )
    season = models.CharField(max_length=60, blank=True, default="")

    class Meta:
        db_table = "farms_crop"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Farm(models.Model):
    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="farms"
    )
    name = models.CharField(max_length=255)
    sector = models.CharField(max_length=120, blank=True, default="")
    # A farm may sit in a different location than its owner is registered under.
    location = models.ForeignKey(
        "locations.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="farms",
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    area_hectares = models.DecimalField(
        max_digits=8, decimal_places=2, default=0
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "farms_farm"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(area_hectares__gte=0), name="farm_area_non_negative"
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def owner_user(self):
        return self.farmer


class GrowthStage(models.TextChoices):
    GERMINATION = "germination", "Germination"
    VEGETATIVE = "vegetative", "Vegetative"
    FLOWERING = "flowering", "Flowering"
    MATURITY = "maturity", "Maturity"
    HARVEST = "harvest", "Harvest"


class Field(models.Model):
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="fields")
    crop = models.ForeignKey(
        Crop, on_delete=models.SET_NULL, null=True, blank=True, related_name="fields"
    )
    name = models.CharField(max_length=255)
    planting_date = models.DateField(null=True, blank=True)
    growth_stage = models.CharField(
        max_length=20,
        choices=GrowthStage.choices,
        default=GrowthStage.VEGETATIVE,
    )
    area_hectares = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    class Meta:
        db_table = "farms_field"
        ordering = ["name"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(area_hectares__gte=0), name="field_area_non_negative"
            ),
        ]

    def __str__(self):
        return f"{self.name} @ {self.farm.name}"

    @property
    def owner_user(self):
        return self.farm.farmer


class NodeStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    MAINTENANCE = "maintenance", "Maintenance"


class PumpMode(models.TextChoices):
    AUTO = "auto", "Auto (device decides from soil moisture)"
    MANUAL = "manual", "Manual (farmer overrides)"


# A device is considered live if it reported within this many seconds.
DEVICE_ONLINE_WINDOW_SECONDS = 60


class SensorNode(models.Model):
    """A physical field node (ESP32) and everything the backend knows about it.

    Lifecycle: the board boots unpaired, announces its ``hardware_id`` to
    ``/iot/announce/`` and sits in the discovery list with ``field=None``. A
    farmer claims it against one of their fields, which mints ``token``; the
    next announce hands that token back and the board starts posting telemetry.
    """

    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name="sensor_nodes",
        null=True,
        blank=True,
        help_text="Null while the device is discovered but not yet claimed.",
    )
    device_id = models.CharField(max_length=120, unique=True)
    # The ESP32's own immutable identity (MAC-derived), reported on announce.
    hardware_id = models.CharField(
        max_length=120, unique=True, null=True, blank=True
    )
    name = models.CharField(max_length=120, blank=True, default="")
    # Shared secret the firmware posts telemetry with. Minted on claim.
    token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=NodeStatus.choices, default=NodeStatus.ACTIVE
    )
    battery = models.PositiveSmallIntegerField(default=100)
    last_seen = models.DateTimeField(null=True, blank=True)

    # -- irrigation control (mirrored back to the device on every telemetry POST)
    pump_mode = models.CharField(
        max_length=10, choices=PumpMode.choices, default=PumpMode.AUTO
    )
    pump_on = models.BooleanField(
        null=True,
        blank=True,
        help_text="Manual-mode target state. Null means 'let the device decide'.",
    )
    pump_state = models.BooleanField(
        default=False, help_text="Last pump state the device reported."
    )
    dry_level = models.PositiveSmallIntegerField(
        default=40, help_text="Soil moisture %% below which the pump turns on."
    )
    wet_level = models.PositiveSmallIntegerField(
        default=65, help_text="Soil moisture %% above which the pump turns off."
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = "farms_sensor_node"
        ordering = ["device_id"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(battery__gte=0) & models.Q(battery__lte=100),
                name="node_battery_range",
            ),
            models.CheckConstraint(
                check=models.Q(dry_level__lt=models.F("wet_level")),
                name="node_dry_below_wet",
            ),
        ]

    def __str__(self):
        return self.device_id

    @property
    def owner_user(self):
        # Unclaimed devices have no owner; permissions fall back to admins.
        return self.field.farm.farmer if self.field_id else None

    @property
    def is_claimed(self) -> bool:
        return self.field_id is not None

    @property
    def is_online(self) -> bool:
        if self.last_seen is None:
            return False
        from django.utils import timezone

        age = (timezone.now() - self.last_seen).total_seconds()
        return age <= DEVICE_ONLINE_WINDOW_SECONDS
