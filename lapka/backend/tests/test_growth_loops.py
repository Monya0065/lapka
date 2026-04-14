import requests
import pytest
from datetime import datetime, timedelta, timezone

from tests.constants import API, BARSIK_PET_ID, CLINIC_ID


def _login(email: str, password: str = "demo12345") -> str:
    response = requests.post(
        f"{API}/api/v1/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def tokens():
    return {
        "owner": _login("owner@lapka.local"),
        "admin": _login("admin@lapka.local"),
    }


def _owner_headers(tokens):
    return {"Authorization": f"Bearer {tokens['owner']}"}


def _admin_headers(tokens):
    return {"Authorization": f"Bearer {tokens['admin']}"}


@pytest.mark.integration
def test_owner_referral_invite_and_list(tokens):
    invite_response = requests.post(
        f"{API}/api/v1/referrals/invite",
        headers={**_owner_headers(tokens), "Content-Type": "application/json"},
        json={"invited_email": "growth-loop-check@example.com"},
        timeout=20,
    )
    assert invite_response.status_code == 201
    invite_payload = invite_response.json()
    assert invite_payload.get("invited_email") == "growth-loop-check@example.com"
    assert invite_payload.get("status") == "sent"

    list_response = requests.get(
        f"{API}/api/v1/referrals/my",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert list_response.status_code == 200
    rows = list_response.json()
    assert isinstance(rows, list)
    assert any(row.get("invited_email") == "growth-loop-check@example.com" for row in rows)


@pytest.mark.integration
def test_clinic_feedback_summary_shape(tokens):
    response = requests.get(
        f"{API}/api/v1/clinic/growth/feedback-summary?clinic_id={CLINIC_ID}&days=90",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert response.status_code == 200
    payload = response.json()
    expected_keys = {
        "clinic_id",
        "window_days",
        "reviews_total",
        "promoters",
        "passives",
        "detractors",
        "nps",
        "csat",
        "recommendations",
    }
    assert expected_keys.issubset(payload.keys())
    assert payload["clinic_id"] == CLINIC_ID
    assert isinstance(payload["recommendations"], list)


@pytest.mark.integration
def test_clinic_integrations_status_shape(tokens):
    response = requests.get(
        f"{API}/api/v1/clinic/integrations/status",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("clinic_id") == CLINIC_ID
    assert isinstance(payload.get("providers"), list)
    assert {"failed_payments_7d", "pending_labs", "retries_recommended", "window_days"}.issubset(payload.keys())


@pytest.mark.integration
def test_lost_pet_public_detail_hides_private_sighting_content(tokens):
    create_report = requests.post(
        f"{API}/api/v1/owner/lost-pets",
        headers={**_owner_headers(tokens), "Content-Type": "application/json"},
        json={
            "pet_id": BARSIK_PET_ID,
            "city": "Санкт-Петербург",
            "last_seen_location": "Тестовый адрес",
            "last_seen_time": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "description": "Проверка privacy-safe карточки.",
            "photo_url": None,
        },
        timeout=20,
    )
    assert create_report.status_code == 200
    report = (create_report.json() or {}).get("report") or {}
    report_id = report.get("id")
    assert report_id

    create_sighting = requests.post(
        f"{API}/api/v1/lost-pets/{report_id}/sightings",
        headers={"Content-Type": "application/json"},
        json={
            "reporter_name": "Public witness",
            "reporter_contact": "witness@example.com",
            "location_note": "У метро",
            "message": "Я видел питомца рядом с парком.",
        },
        timeout=20,
    )
    assert create_sighting.status_code == 201

    public_detail = requests.get(
        f"{API}/api/v1/lost-pets/{report_id}",
        timeout=20,
    )
    assert public_detail.status_code == 200
    payload = public_detail.json()
    assert isinstance(payload.get("sightings"), list)
    assert payload.get("sightings_public_count", 0) >= 1
    if payload["sightings"]:
        first = payload["sightings"][0]
        assert first.get("message") is None
        assert first.get("reporter_name") is None

    owner_detail = requests.get(
        f"{API}/api/v1/owner/lost-pets/{report_id}",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert owner_detail.status_code == 200
    owner_payload = owner_detail.json()
    assert owner_payload.get("contact_bridge") == "privacy_safe"
    if owner_payload.get("sightings"):
        first_owner = owner_payload["sightings"][0]
        assert first_owner.get("message")
        assert "@" in str(first_owner.get("reporter_contact_masked") or "")
