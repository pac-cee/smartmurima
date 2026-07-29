"""IT-02: register -> OTP verify -> tokens; and IT-01: JWT-protected 401."""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User


@pytest.fixture
def client():
    return APIClient()


def test_protected_endpoint_requires_jwt(db, client):
    # IT-01: /auth/me is JWT-protected -> 401 without a token.
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_register_verify_returns_tokens(db, client):
    resp = client.post(
        "/api/v1/auth/register",
        {
            "full_name": "Bob Farmer",
            "phone_number": "+250780000020",
            "password": "StrongPass1",
            "role": "farmer",
            "language": "rw",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    dev_code = resp.data["dev_code"]  # console gateway exposes the code in dev

    user = User.objects.get(phone_number="+250780000020")
    assert user.is_active is False  # inactive until verified

    verify = client.post(
        "/api/v1/auth/otp/verify",
        {"phone_number": "+250780000020", "code": dev_code},
        format="json",
    )
    assert verify.status_code == 200, verify.content
    assert "access" in verify.data["tokens"]
    assert "refresh" in verify.data["tokens"]

    user.refresh_from_db()
    assert user.is_active is True

    # Authenticated request now succeeds.
    token = verify.data["tokens"]["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.data["full_name"] == "Bob Farmer"
