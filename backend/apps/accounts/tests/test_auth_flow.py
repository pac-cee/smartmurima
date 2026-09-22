"""IT-02: single-step register -> tokens; and IT-01: JWT-protected 401."""
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


def test_register_returns_an_active_session(db, client):
    """Registration is one step: the response already carries a usable JWT."""
    resp = client.post(
        "/api/v1/auth/register",
        {
            "full_name": "Bob Farmer",
            "phone_number": "+250780000020",
            "password": "StrongPass1",
            "language": "rw",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    assert "access" in resp.data["tokens"]
    assert "refresh" in resp.data["tokens"]
    assert resp.data["user"]["full_name"] == "Bob Farmer"
    assert resp.data["user"]["role"] == "farmer"

    user = User.objects.get(phone_number="+250780000020")
    assert user.is_active is True  # no verification step to wait on
    assert user.farmer_profile is not None

    # The token works immediately -- no second round-trip.
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['tokens']['access']}")
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.data["full_name"] == "Bob Farmer"


def test_register_then_login_with_the_same_credentials(db, client):
    """Regression: a freshly registered account can sign in right away."""
    client.post(
        "/api/v1/auth/register",
        {
            "full_name": "Claudine U",
            "email": "claudine@example.rw",
            "password": "StrongPass1",
        },
        format="json",
    )
    login = client.post(
        "/api/v1/auth/login",
        {"identifier": "claudine@example.rw", "password": "StrongPass1"},
        format="json",
    )
    assert login.status_code == 200, login.content
    assert "access" in login.data["tokens"]


def test_register_rejects_a_duplicate_email(db, client):
    payload = {
        "full_name": "Dup",
        "email": "dup@example.rw",
        "password": "StrongPass1",
    }
    assert client.post("/api/v1/auth/register", payload, format="json").status_code == 201
    second = client.post("/api/v1/auth/register", payload, format="json")
    assert second.status_code == 409, second.content
