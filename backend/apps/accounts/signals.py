"""Accounts signals.

Two invariants, enforced however a user is created (Django admin, admin-api,
self-service registration, or a seed command):

1. Every farmer-role user has a Farmer profile.
2. Every admin-role user can actually reach the Django admin console -- the
   admin console *is* the management UI for this platform, so ``role=admin``
   without ``is_staff`` would be a role that grants nothing.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Farmer, Role, User


@receiver(post_save, sender=User)
def ensure_farmer_profile(sender, instance, **kwargs):
    if instance.role == Role.FARMER:
        Farmer.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def ensure_admin_is_staff(sender, instance, **kwargs):
    """Grant admin-role users staff access (and revoke it when demoted)."""
    should_be_staff = instance.role == Role.ADMIN or instance.is_superuser
    if instance.is_staff != should_be_staff:
        # update() rather than save(), so this never re-enters the signal.
        User.objects.filter(pk=instance.pk).update(is_staff=should_be_staff)
        instance.is_staff = should_be_staff
