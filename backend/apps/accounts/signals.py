"""Accounts signals.

Guarantees every farmer-role user has a Farmer profile, no matter how the user
is created (Django admin, admin-api, self-service registration, or seed
commands). ``get_or_create`` keeps it idempotent.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Farmer, Role, User


@receiver(post_save, sender=User)
def ensure_farmer_profile(sender, instance, **kwargs):
    if instance.role == Role.FARMER:
        Farmer.objects.get_or_create(user=instance)
