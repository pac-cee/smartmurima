"""The location a farmer picks at sign-up must survive the round trip.

Regression: the ``ensure_farmer_profile`` signal caches a location-less profile
on the user during ``save()``. Updating the profile afterwards left that cache
stale, so ``POST /auth/register`` answered ``location: null`` even though the
row was written -- and the client stored *that* as the session, so Settings
showed no location until a full reload.
"""
import pytest
from rest_framework.test import APIClient

from apps.locations.models import Location


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def sector(db):
    province = Location.objects.create(name="Eastern", level="province")
    district = Location.objects.create(name="Bugesera", level="district", parent=province)
    return Location.objects.create(name="Nyamata", level="sector", parent=district)


def test_register_echoes_the_location_it_was_given(db, client, sector):
    resp = client.post(
        "/api/v1/auth/register",
        {
            "full_name": "Claudine U",
            "email": "claudine@example.rw",
            "password": "StrongPass1",
            "location": sector.id,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.content
    # The response the client caches as its session must already carry it.
    assert str(resp.data["user"]["location"]) == str(sector.id)
    assert "Nyamata" in resp.data["user"]["location_path"]


def test_me_agrees_with_the_register_response(db, client, sector):
    resp = client.post(
        "/api/v1/auth/register",
        {
            "full_name": "Claudine U",
            "email": "claudine2@example.rw",
            "password": "StrongPass1",
            "location": sector.id,
        },
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['tokens']['access']}")
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert str(me.data["location"]) == str(resp.data["user"]["location"])


def test_updating_the_location_is_reflected_immediately(db, client, sector):
    resp = client.post(
        "/api/v1/auth/register",
        {"full_name": "No Loc", "email": "noloc@example.rw", "password": "StrongPass1"},
        format="json",
    )
    assert resp.data["user"]["location"] is None
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['tokens']['access']}")

    patched = client.patch("/api/v1/auth/me", {"location": sector.id}, format="json")
    assert patched.status_code == 200, patched.content
    # The PATCH response itself must show the new location, not the old cache.
    assert str(patched.data["location"]) == str(sector.id)
