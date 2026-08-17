"""Django admin registration for recommendations."""
from django.contrib import admin

from .models import Recommendation


@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ("field", "type", "decision", "value", "unit", "confidence",
                    "created_at")
    list_filter = ("type", "created_at")
    search_fields = ("decision", "field__name", "field__farm__name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("field",)
    readonly_fields = ("created_at",)
