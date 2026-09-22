"""Django admin registrations for the farms domain."""
from django.contrib import admin

from .models import Crop, Farm, Field, SensorNode


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ("name", "base_temp", "season")
    list_filter = ("season",)
    search_fields = ("name", "season")
    ordering = ("name",)


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ("name", "farmer", "sector", "location", "area_hectares",
                    "field_count")
    list_filter = ("sector", "created_at")
    search_fields = ("name", "sector", "farmer__username", "farmer__full_name",
                     "location__name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("farmer", "location")
    readonly_fields = ("created_at",)

    @admin.display(description="Fields")
    def field_count(self, obj):
        return obj.fields.count()


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ("name", "farm", "crop", "growth_stage", "area_hectares",
                    "planting_date")
    list_filter = ("growth_stage", "crop")
    search_fields = ("name", "farm__name", "crop__name")
    ordering = ("name",)
    autocomplete_fields = ("farm", "crop")


@admin.register(SensorNode)
class SensorNodeAdmin(admin.ModelAdmin):
    """Field devices, including the ones still waiting to be claimed."""

    list_display = ("device_id", "name", "field", "claimed", "online", "status",
                    "battery", "pump_mode", "pump_state", "last_seen")
    list_filter = ("status", "pump_mode", ("field", admin.EmptyFieldListFilter))
    search_fields = ("device_id", "hardware_id", "name", "field__name",
                     "field__farm__name")
    ordering = ("device_id",)
    autocomplete_fields = ("field",)
    # The token is a device secret: visible for support, never editable by hand
    # (claiming mints it; unpairing revokes it).
    readonly_fields = ("hardware_id", "token", "last_seen", "pump_state",
                       "created_at")
    fieldsets = (
        ("Identity", {"fields": ("device_id", "hardware_id", "name", "token")}),
        ("Assignment", {"fields": ("field", "status")}),
        ("Irrigation", {"fields": ("pump_mode", "pump_on", "pump_state",
                                    "dry_level", "wet_level")}),
        ("Health", {"fields": ("battery", "last_seen", "created_at")}),
    )
    actions = ("unpair_devices", "pump_to_auto")

    @admin.display(boolean=True, description="Claimed")
    def claimed(self, obj):
        return obj.is_claimed

    @admin.display(boolean=True, description="Online")
    def online(self, obj):
        return obj.is_online

    @admin.action(description="Unpair selected devices (revokes their token)")
    def unpair_devices(self, request, queryset):
        updated = queryset.update(field=None, token=None, pump_mode="auto",
                                  pump_on=None)
        self.message_user(request, f"{updated} device(s) unpaired.")

    @admin.action(description="Return pump control to automatic")
    def pump_to_auto(self, request, queryset):
        updated = queryset.update(pump_mode="auto", pump_on=None)
        self.message_user(request, f"{updated} device(s) back on auto.")
