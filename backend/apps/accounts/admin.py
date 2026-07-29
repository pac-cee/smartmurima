from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Farmer, OtpCode, User


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


admin.site.register(Farmer)
admin.site.register(OtpCode)
