"""UT-08: Africa's Talking gateway speaks the provider's actual contract.

The API answers 201 even when it refuses a recipient, so "sent" has to be read
from the per-recipient statusCode, not the HTTP status.
"""
import pytest
from django.test import override_settings

from apps.accounts.services import (
    AfricasTalkingSmsGateway,
    ConsoleSmsGateway,
    HttpSmsGateway,
    get_sms_gateway,
)


class FakeResponse:
    def __init__(self, payload, status_code=201):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


def _recipients(*status_codes):
    return {
        "SMSMessageData": {
            "Message": "Sent to 1/1 Total Cost: RWF 0.0000",
            "Recipients": [
                {"number": "+250780000030", "statusCode": c, "status": "Success"}
                for c in status_codes
            ],
        }
    }


@pytest.fixture
def capture(monkeypatch):
    calls = {}

    def fake_post(url, data=None, headers=None, timeout=None, **kwargs):
        calls.update(url=url, data=data, headers=headers, timeout=timeout)
        return FakeResponse(_recipients(101))

    monkeypatch.setattr("requests.post", fake_post)
    return calls


def test_sends_form_encoded_with_apikey_header(capture):
    gateway = AfricasTalkingSmsGateway(username="sandbox", api_key="key-123")

    assert gateway.send("+250780000030", "code 123456") is True
    assert capture["url"] == AfricasTalkingSmsGateway.SANDBOX_URL
    # Form fields, not JSON, and the key travels in a header named apiKey.
    assert capture["data"] == {
        "username": "sandbox",
        "to": "+250780000030",
        "message": "code 123456",
    }
    assert capture["headers"]["apiKey"] == "key-123"


def test_live_username_targets_live_endpoint(capture):
    gateway = AfricasTalkingSmsGateway(username="smartmurima", api_key="k")
    gateway.send("+250780000030", "hi")
    assert capture["url"] == AfricasTalkingSmsGateway.LIVE_URL


def test_sender_id_only_sent_when_registered(capture):
    AfricasTalkingSmsGateway(username="sandbox", api_key="k").send("+250", "hi")
    assert "from" not in capture["data"]

    AfricasTalkingSmsGateway(username="sandbox", api_key="k", sender_id="SM").send(
        "+250", "hi"
    )
    assert capture["data"]["from"] == "SM"


@pytest.mark.parametrize("status_code,expected", [(100, True), (102, True), (403, False)])
def test_delivery_is_read_from_recipient_status(monkeypatch, status_code, expected):
    monkeypatch.setattr(
        "requests.post",
        lambda *a, **kw: FakeResponse(_recipients(status_code)),
    )
    gateway = AfricasTalkingSmsGateway(username="sandbox", api_key="k")
    assert gateway.send("+250780000030", "hi") is expected


def test_no_recipients_is_a_failure(monkeypatch):
    payload = {"SMSMessageData": {"Message": "InvalidPhoneNumber", "Recipients": []}}
    monkeypatch.setattr("requests.post", lambda *a, **kw: FakeResponse(payload))
    gateway = AfricasTalkingSmsGateway(username="sandbox", api_key="k")
    assert gateway.send("not-a-number", "hi") is False


def test_network_error_is_reported_not_raised(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("connection reset")

    monkeypatch.setattr("requests.post", boom)
    gateway = AfricasTalkingSmsGateway(username="sandbox", api_key="k")
    assert gateway.send("+250780000030", "hi") is False


@override_settings(SMS_PROVIDER="africastalking", SMS_USERNAME="sandbox", SMS_API_KEY="k")
def test_settings_select_africas_talking():
    assert isinstance(get_sms_gateway(), AfricasTalkingSmsGateway)


@override_settings(SMS_PROVIDER="https://sms.example.com/send")
def test_url_provider_still_uses_generic_gateway():
    assert isinstance(get_sms_gateway(), HttpSmsGateway)


@override_settings(SMS_PROVIDER="")
def test_blank_provider_stays_on_console():
    gateway = get_sms_gateway()
    assert isinstance(gateway, ConsoleSmsGateway)
    assert gateway.dev_visible is True
