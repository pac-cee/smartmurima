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
    list_display = ("device_id", "field", "status", "battery", "last_seen")
    list_filter = ("status",)
    search_fields = ("device_id", "field__name", "field__farm__name")
    ordering = ("device_id",)
    autocomplete_fields = ("field",)
    readonly_fields = ("last_seen",)
