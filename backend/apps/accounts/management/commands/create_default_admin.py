"""Idempotently create a default Django superuser for local/dev use.

Creates ``admin`` (admin@smartmurima.rw / admin12345, role=admin) only if it
does not already exist. Safe to run repeatedly; it never overwrites an existing
account or password.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Q

User = get_user_model()

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@smartmurima.rw"
ADMIN_PASSWORD = "admin12345"


class Command(BaseCommand):
    help = "Ensure a default dev superuser (admin/admin12345) exists and can log in."

    def handle(self, *args, **options):
        # Idempotent against a persisted DB that may already hold a user with
        # this username OR email (e.g. an older seed's ``admin_demo``). Rather
        # than crash on the unique-email constraint, adopt that account and
        # guarantee the documented dev login works.
        existing = User.objects.filter(
            Q(username=ADMIN_USERNAME) | Q(email=ADMIN_EMAIL)
        ).first()
        if existing:
            existing.username = ADMIN_USERNAME
            existing.role = "admin"
            existing.is_staff = True
            existing.is_superuser = True
            existing.is_active = True
            existing.set_password(ADMIN_PASSWORD)
            existing.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Ensured dev superuser '{ADMIN_USERNAME}' "
                    f"({ADMIN_EMAIL} / {ADMIN_PASSWORD})."
                )
            )
            return

        User.objects.create_superuser(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            full_name="Platform Administrator",
            role="admin",
            is_active=True,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Created superuser '{ADMIN_USERNAME}' "
                f"({ADMIN_EMAIL} / {ADMIN_PASSWORD})."
            )
        )
