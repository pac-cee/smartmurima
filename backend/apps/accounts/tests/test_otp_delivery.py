"""UT-07: an OTP goes out on the channel its identifier names.

An email address handed to the SMS gateway reaches nobody, which is what the
password-reset flow used to do for email accounts.
"""
import pytest
from django.core import mail

from apps.accounts.models import OtpPurpose, User
from apps.accounts.services import OtpService, SmsGateway


class RecordingSmsGateway(SmsGateway):
    dev_visible = False

    def __init__(self):
        self.sent = []

    def send(self, to: str, message: str) -> bool:
        self.sent.append((to, message))
        return True


@pytest.fixture
def user(db):
    return User.objects.create(
        username="carol", email="carol@example.com", full_name="Carol",
        phone_number="+250780000030", is_active=True,
    )


def test_email_identifier_is_emailed_not_texted(db, user):
    sms = RecordingSmsGateway()
    service = OtpService(sms=sms)

    result = service.issue(user.email, OtpPurpose.RESET, user=user)

    assert sms.sent == []  # nothing went to the SMS gateway
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == [user.email]
    # The code must be in the body the user receives.
    assert result.dev_code is not None  # locmem backend -> dev-visible
    assert result.dev_code in message.body
    assert service.verify(user.email, result.dev_code, OtpPurpose.RESET).id == user.id


def test_phone_identifier_is_texted_not_emailed(db, user):
    sms = RecordingSmsGateway()
    service = OtpService(sms=sms)

    service.issue(user.phone_number, OtpPurpose.RESET, user=user)

    assert mail.outbox == []
    assert len(sms.sent) == 1
    assert sms.sent[0][0] == user.phone_number


def test_real_sms_gateway_does_not_leak_the_code(db, user):
    """dev_code is only for gateways that cannot reach the user."""
    result = OtpService(sms=RecordingSmsGateway()).issue(
        user.phone_number, OtpPurpose.RESET, user=user
    )
    assert result.dev_code is None
