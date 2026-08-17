from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Farmer, OtpCode, User


class FarmerInline(admin.StackedInline):
    """Edit the Farmer profile (incl. its location) inline on the user page.

    Only shown on the *change* page: on add, the profile is auto-created by the
    ``ensure_farmer_profile`` post_save signal, so showing an add-form here would
    risk a duplicate. See ``UserAdmin.get_inlines``.
    """

    model = Farmer
    can_delete = False
    extra = 0
    max_num = 1
    autocomplete_fields = ("location",)
    verbose_name_plural = "Farmer profile"


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "full_name", "email", "phone_number", "role",
                    "is_active")
    list_filter = ("role", "language", "is_active", "is_staff")
    search_fields = ("username", "email", "phone_number", "full_name")
    ordering = ("-created_at",)
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Profile", {"fields": ("full_name", "email", "phone_number", "role",
                                 "language")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser",
                                     "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("username", "full_name", "email", "phone_number", "role",
                       "password1", "password2"),
        }),
    )
    readonly_fields = ("created_at",)

    def get_inlines(self, request, obj):
        # Show the Farmer inline only when editing an existing farmer user.
        if obj is not None and obj.role == "farmer":
            return [FarmerInline]
        return []


@admin.register(Farmer)
class FarmerAdmin(admin.ModelAdmin):
    list_display = ("user", "cooperative_name", "location", "created_at")
    search_fields = ("user__username", "user__full_name", "cooperative_name",
                     "location__name")
    list_filter = ("location__level",)
    autocomplete_fields = ("user", "location")
    readonly_fields = ("created_at",)


admin.site.register(OtpCode)
