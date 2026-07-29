"""Accounts repositories -- the only place touching the accounts ORM."""
from __future__ import annotations

from typing import Optional

from django.db.models import Q
from django.utils import timezone

from core.repositories import BaseRepository

from .models import Farmer, OtpCode, User


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_username(self, username: str) -> Optional[User]:
        return self.get_or_none(username=username)

    def get_by_email(self, email: str) -> Optional[User]:
        return self.get_or_none(email__iexact=email)

    def get_by_phone(self, phone: str) -> Optional[User]:
        return self.get_or_none(phone_number=phone)

    def get_by_identifier(self, identifier: str) -> Optional[User]:
        """Resolve a user by username, email, or phone number."""
        return (
            self.get_queryset()
            .filter(
                Q(username=identifier)
                | Q(email__iexact=identifier)
                | Q(phone_number=identifier)
            )
            .first()
        )

    def activate(self, user: User) -> User:
        return self.update(user, is_active=True)


class FarmerRepository(BaseRepository[Farmer]):
    model = Farmer


class OtpRepository(BaseRepository[OtpCode]):
    model = OtpCode

    def latest_active(self, identifier: str, purpose: str) -> Optional[OtpCode]:
        return (
            self.get_queryset()
            .filter(identifier=identifier, purpose=purpose, consumed_at__isnull=True)
            .order_by("-created_at")
            .first()
        )

    def invalidate_open(self, identifier: str, purpose: str) -> int:
        """Consume any still-open codes for this identifier+purpose."""
        return (
            self.get_queryset()
            .filter(identifier=identifier, purpose=purpose, consumed_at__isnull=True)
            .update(consumed_at=timezone.now())
        )

    def mark_consumed(self, otp: OtpCode) -> OtpCode:
        return self.update(otp, consumed_at=timezone.now())

    def increment_attempts(self, otp: OtpCode) -> OtpCode:
        return self.update(otp, attempts=otp.attempts + 1)
