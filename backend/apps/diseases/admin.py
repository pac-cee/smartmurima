"""Django admin registration for disease reports."""
from django.contrib import admin
from django.utils.html import format_html

from .models import DiseaseReport


@admin.register(DiseaseReport)
class DiseaseReportAdmin(admin.ModelAdmin):
    list_display = ("field", "disease", "confidence", "is_healthy", "created_at")
    list_filter = ("is_healthy", "disease", "created_at")
    search_fields = ("disease", "field__name", "field__farm__name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("field",)
    readonly_fields = ("created_at", "image_thumbnail")

    @admin.display(description="Preview")
    def image_thumbnail(self, obj):
        if not obj.image:
            return "-"
        return format_html(
            '<img src="{}" style="max-height:160px;max-width:240px;" />',
            obj.image.url,
        )
