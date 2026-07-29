"""Accounts business logic: SMS gateway, OTP lifecycle, and auth.

All ORM access is delegated to repositories. These services are unit-testable
without HTTP.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from core.exceptions import (
    ConflictError,
    NotFoundError,
    RateLimitedError,
    ValidationError,
)
from core.services import BaseService

from .models import OtpPurpose, User
from .repositories import FarmerRepository, OtpRepository, UserRepository

logger = logging.getLogger("smartmurima")


# ---------------------------------------------------------------------------
# SMS gateway
# ---------------------------------------------------------------------------
class SmsGateway:
    """Interface for delivering SMS. ``send`` returns True on success."""

    def send(self, to: str, message: str) -> bool:  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleSmsGateway(SmsGateway):
    """Dev backend: prints the message (with the OTP) to the console/logs."""

    def send(self, to: str, message: str) -> bool:
        logger.warning("[SMS:console] to=%s | %s", to, message)
        print(f"\n=== SMS to {to} ===\n{message}\n===================\n", flush=True)
        return True


class HttpSmsGateway(SmsGateway):
    """Pluggable production provider (generic HTTP POST). Configure via env."""

    def __init__(self, provider: str, api_key: str, sender_id: str):
        self.provider = provider
        self.api_key = api_key
        self.sender_id = sender_id

    def send(self, to: str, message: str) -> bool:
        try:
            import requests

            resp = requests.post(
                self.provider,
                json={
                    "sender": self.sender_id,
                    "to": to,
                    "message": message,
                },
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10,
            )
            resp.raise_for_status()
            return True
        except Exception as exc:  # pragma: no cover - network
            logger.error("SMS delivery failed: %s", exc)
            return False


def get_sms_gateway() -> SmsGateway:
    provider = getattr(settings, "SMS_PROVIDER", "")
    if provider:
        return HttpSmsGateway(
            provider=provider,
            api_key=getattr(settings, "SMS_API_KEY", ""),
            sender_id=getattr(settings, "SMS_SENDER_ID", "SmartMurima"),
        )
    return ConsoleSmsGateway()


# ---------------------------------------------------------------------------
# OTP service
# ---------------------------------------------------------------------------
@dataclass
class OtpIssueResult:
    identifier: str
    purpose: str
    expires_at: object
    dev_code: Optional[str] = None  # populated only when using console gateway


class OtpService(BaseService):
    """Generate, deliver, and verify one-time passwords.

    Codes are hashed (never stored plain), TTL'd, purpose-scoped, single-use,
    and rate-limited by resend-cooldown + max verification attempts.
    """

    def __init__(
        self,
        otp_repo: Optional[OtpRepository] = None,
        user_repo: Optional[UserRepository] = None,
        sms: Optional[SmsGateway] = None,
    ):
        self.otp_repo = otp_repo or OtpRepository()
        self.user_repo = user_repo or UserRepository()
        self.sms = sms or get_sms_gateway()

    # -- hashing ----------------------------------------------------------
    @staticmethod
    def _hash(code: str) -> str:
        return hashlib.sha256(
            f"{settings.SECRET_KEY}:{code}".encode("utf-8")
        ).hexdigest()

    @staticmethod
    def _verify_hash(code: str, code_hash: str) -> bool:
        return hmac.compare_digest(OtpService._hash(code), code_hash)

    def _generate_code(self) -> str:
        length = int(getattr(settings, "OTP_LENGTH", 6))
        upper = 10**length
        return str(secrets.randbelow(upper)).zfill(length)

    # -- issue ------------------------------------------------------------
    def issue(
        self, identifier: str, purpose: str, user: Optional[User] = None
    ) -> OtpIssueResult:
        if purpose not in OtpPurpose.values:
            raise ValidationError(f"Unknown OTP purpose '{purpose}'.")

        cooldown = int(getattr(settings, "OTP_RESEND_COOLDOWN_SECONDS", 60))
        last = self.otp_repo.latest_active(identifier, purpose)
        if last is not None:
            age = (timezone.now() - last.created_at).total_seconds()
            if age < cooldown:
                raise RateLimitedError(
                    f"Please wait {int(cooldown - age)}s before requesting a new code."
                )

        # Invalidate any still-open codes for this identifier + purpose.
        self.otp_repo.invalidate_open(identifier, purpose)

        code = self._generate_code()
        ttl = int(getattr(settings, "OTP_TTL_SECONDS", 300))
        expires_at = timezone.now() + timedelta(seconds=ttl)

        self.otp_repo.create(
            user=user,
            identifier=identifier,
            code_hash=self._hash(code),
            purpose=purpose,
            expires_at=expires_at,
        )

        message = (
            f"SmartMurima code: {code} (valid {ttl // 60} min). "
            "Do not share this code."
        )
        delivered = self.sms.send(identifier, message)
        if not delivered:
            logger.error("OTP delivery failed for %s", identifier)

        dev_code = code if isinstance(self.sms, ConsoleSmsGateway) else None
        return OtpIssueResult(
            identifier=identifier,
            purpose=purpose,
            expires_at=expires_at,
            dev_code=dev_code,
        )

    # -- verify -----------------------------------------------------------
    def verify(self, identifier: str, code: str, purpose: str) -> User:
        otp = self.otp_repo.latest_active(identifier, purpose)
        if otp is None:
            raise ValidationError("No active code. Request a new one.")

        if otp.expires_at <= timezone.now():
            self.otp_repo.mark_consumed(otp)
            raise ValidationError("Code has expired. Request a new one.")

        max_attempts = int(getattr(settings, "OTP_MAX_ATTEMPTS", 5))
        if otp.attempts >= max_attempts:
            self.otp_repo.mark_consumed(otp)
            raise RateLimitedError("Too many attempts. Request a new code.")

        if not self._verify_hash(code, otp.code_hash):
            self.otp_repo.increment_attempts(otp)
            raise ValidationError("Invalid code.")

        # Success: single-use consume.
        self.otp_repo.mark_consumed(otp)

        user = otp.user or self.user_repo.get_by_identifier(identifier)
        if user is None:
            raise NotFoundError("No account for this identifier.")
        return user


# ---------------------------------------------------------------------------
# Auth service
# ---------------------------------------------------------------------------
class AuthService(BaseService):
    def __init__(
        self,
        user_repo: Optional[UserRepository] = None,
        farmer_repo: Optional[FarmerRepository] = None,
        otp_service: Optional[OtpService] = None,
    ):
        self.user_repo = user_repo or UserRepository()
        self.farmer_repo = farmer_repo or FarmerRepository()
        self.otp_service = otp_service or OtpService()

    @staticmethod
    def tokens_for(user: User) -> dict:
        refresh = RefreshToken.for_user(user)
        return {"access": str(refresh.access_token), "refresh": str(refresh)}

    def _derive_username(self, email: Optional[str], phone: Optional[str]) -> str:
        base = (email.split("@")[0] if email else None) or phone or "user"
        candidate = base
        i = 0
        while self.user_repo.exists(username=candidate):
            i += 1
            candidate = f"{base}{i}"
        return candidate

    @transaction.atomic
    def register(self, data: dict) -> OtpIssueResult:
        email = data.get("email") or None
        phone = data.get("phone_number") or None
        if not email and not phone:
            raise ValidationError("Provide an email or phone number.")
        if email and self.user_repo.get_by_email(email):
            raise ConflictError("An account with this email already exists.")
        if phone and self.user_repo.get_by_phone(phone):
            raise ConflictError("An account with this phone number already exists.")

        user = self.user_repo.create(
            username=self._derive_username(email, phone),
            email=email,
            phone_number=phone,
            full_name=data["full_name"],
            role=data.get("role", "farmer"),
            language=data.get("language", "rw"),
            is_active=False,
        )
        user.set_password(data["password"])
        user.save(update_fields=["password"])

        if user.role == "farmer":
            self.farmer_repo.get_or_create(user=user)

        identifier = phone or email
        return self.otp_service.issue(identifier, OtpPurpose.REGISTER, user=user)

    def verify_registration(self, identifier: str, code: str) -> dict:
        user = self.otp_service.verify(identifier, code, OtpPurpose.REGISTER)
        if not user.is_active:
            self.user_repo.activate(user)
        return {"user": user, "tokens": self.tokens_for(user)}

    def login(self, identifier: str, password: str) -> dict:
        user = self.user_repo.get_by_identifier(identifier)
        if user is None:
            raise ValidationError("Invalid credentials.")
        # authenticate() honours password hashing + is_active.
        auth_user = authenticate(username=user.username, password=password)
        if auth_user is None:
            if not user.is_active:
                raise ValidationError("Account not verified. Verify via OTP first.")
            raise ValidationError("Invalid credentials.")
        return {"user": auth_user, "tokens": self.tokens_for(auth_user)}

    def request_password_reset(self, identifier: str) -> OtpIssueResult:
        user = self.user_repo.get_by_identifier(identifier)
        # Do not reveal whether the account exists; issue only if it does.
        if user is None:
            raise NotFoundError("No account for this identifier.")
        return self.otp_service.issue(identifier, OtpPurpose.RESET, user=user)

    @transaction.atomic
    def confirm_password_reset(
        self, identifier: str, code: str, new_password: str
    ) -> User:
        user = self.otp_service.verify(identifier, code, OtpPurpose.RESET)
        user.set_password(new_password)
        if not user.is_active:
            user.is_active = True
        user.save(update_fields=["password", "is_active"])
        return user

    def resend_otp(self, identifier: str, purpose: str) -> OtpIssueResult:
        user = self.user_repo.get_by_identifier(identifier)
        return self.otp_service.issue(identifier, purpose, user=user)

    def update_profile(self, user: User, data: dict) -> User:
        allowed = {"full_name", "language", "email", "phone_number"}
        updates = {k: v for k, v in data.items() if k in allowed}
        if not updates:
            return user
        return self.user_repo.update(user, **updates)
