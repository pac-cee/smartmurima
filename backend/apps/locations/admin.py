"""Django admin for the Rwanda location hierarchy."""
from django.contrib import admin

from .models import Location


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("name", "level", "parent", "code")
    list_filter = ("level",)
    search_fields = ("name", "code")
    ordering = ("level", "name")
    autocomplete_fields = ("parent",)
