"""UT-06: OTP lifecycle -- hashed, TTL'd, single-use, rate-limited."""
import pytest
from django.utils import timezone

from apps.accounts.models import OtpCode, OtpPurpose, User
from apps.accounts.repositories import OtpRepository
from apps.accounts.services import OtpService
from core.exceptions import RateLimitedError, ValidationError


@pytest.fixture
def user(db):
    return User.objects.create(
        username="alice", email="alice@example.com", full_name="Alice",
        phone_number="+250780000010", is_active=False,
    )


def test_issue_stores_hashed_code(db, user):
    service = OtpService()
    result = service.issue(user.phone_number, OtpPurpose.REGISTER, user=user)
    otp = OtpCode.objects.get(identifier=user.phone_number)
    # The stored code must never be the plaintext.
    assert result.dev_code is not None
    assert otp.code_hash != result.dev_code
    assert len(otp.code_hash) == 64  # sha256 hexdigest


def test_verify_success_consumes_single_use(db, user):
    service = OtpService()
    result = service.issue(user.phone_number, OtpPurpose.REGISTER, user=user)
    verified = service.verify(user.phone_number, result.dev_code, OtpPurpose.REGISTER)
    assert verified.id == user.id
    # Second verification with same code must fail (single-use).
    with pytest.raises(ValidationError):
        service.verify(user.phone_number, result.dev_code, OtpPurpose.REGISTER)


def test_verify_rejects_wrong_code(db, user):
    service = OtpService()
    service.issue(user.phone_number, OtpPurpose.REGISTER, user=user)
    with pytest.raises(ValidationError):
        service.verify(user.phone_number, "000000", OtpPurpose.REGISTER)


def test_expired_code_rejected(db, user):
    service = OtpService()
    result = service.issue(user.phone_number, OtpPurpose.REGISTER, user=user)
    otp = OtpRepository().latest_active(user.phone_number, OtpPurpose.REGISTER)
    otp.expires_at = timezone.now() - timezone.timedelta(seconds=1)
    otp.save(update_fields=["expires_at"])
    with pytest.raises(ValidationError):
        service.verify(user.phone_number, result.dev_code, OtpPurpose.REGISTER)


def test_resend_cooldown_rate_limited(db, user):
    service = OtpService()
    service.issue(user.phone_number, OtpPurpose.REGISTER, user=user)
    with pytest.raises(RateLimitedError):
        service.issue(user.phone_number, OtpPurpose.REGISTER, user=user)
