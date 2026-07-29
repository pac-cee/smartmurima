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


class SensorNode(models.Model):
    field = models.ForeignKey(
        Field, on_delete=models.CASCADE, related_name="sensor_nodes"
    )
    device_id = models.CharField(max_length=120, unique=True)
    status = models.CharField(
        max_length=20, choices=NodeStatus.choices, default=NodeStatus.ACTIVE
    )
    battery = models.PositiveSmallIntegerField(default=100)
    last_seen = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "farms_sensor_node"
        ordering = ["device_id"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(battery__gte=0) & models.Q(battery__lte=100),
                name="node_battery_range",
            ),
        ]

    def __str__(self):
        return self.device_id

    @property
    def owner_user(self):
        return self.field.farm.farmer
