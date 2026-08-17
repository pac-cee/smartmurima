"""Django admin registration for alerts."""
from django.contrib import admin

from .models import Alert


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("user", "type", "severity", "is_read", "created_at")
    list_filter = ("type", "severity", "is_read", "created_at")
    search_fields = ("message", "user__username", "user__full_name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at",)
    actions = ("mark_read", "mark_unread")

    @admin.action(description="Mark selected alerts as read")
    def mark_read(self, request, queryset):
        updated = queryset.update(is_read=True)
        self.message_user(request, f"{updated} alert(s) marked as read.")

    @admin.action(description="Mark selected alerts as unread")
    def mark_unread(self, request, queryset):
        updated = queryset.update(is_read=False)
        self.message_user(request, f"{updated} alert(s) marked as unread.")
