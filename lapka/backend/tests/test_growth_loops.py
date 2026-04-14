import pytest
import requests

from tests.constants import API, CLINIC_ID


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
