"""
Inpatient product tests.

NOTE: These tests require VPN API with inpatient data in seed.
They run against LAPKA_API_BASE or can be run against VPN_API explicitly.
For main API runs, they will be skipped.
"""
import os
import pytest
import requests

# These tests require VPN infrastructure with inpatient seed data
# Currently skipped - run manually with LAPKA_API=http://localhost:8001
pytestmark = pytest.mark.skip(reason="Requires VPN with inpatient seed data")

from tests.constants import API, BARSIK_PET_ID, CLINIC_ID

BARSIK_STAY_ID = "77777777-7777-7777-7777-777777777777"


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
        "vet": _login("vet@lapka.local"),
    }


def _owner_headers(tokens):
    return {"Authorization": f"Bearer {tokens['owner']}"}


def _vet_headers(tokens):
    return {"Authorization": f"Bearer {tokens['vet']}"}


@pytest.mark.integration
def test_owner_inpatient_list_and_detail(tokens):
    list_response = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert list_response.status_code == 200
    rows = list_response.json()
    assert isinstance(rows, list)
    assert rows

    stay_id = rows[0]["id"]
    detail_response = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient/{stay_id}",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert "events" in detail
    assert "photo_reports" in detail
    assert "questions_to_ask_doctor" in detail


@pytest.mark.integration
def test_owner_camera_token_one_time_consumes(tokens):
    rows = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient",
        headers=_owner_headers(tokens),
        timeout=20,
    ).json()
    stay = next((row for row in rows if row.get("camera_available")), None)
    assert stay is not None

    detail = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient/{stay['id']}",
        headers=_owner_headers(tokens),
        timeout=20,
    ).json()
    camera_id = detail["cameras"][0]["camera_id"]

    issue_response = requests.post(
        f"{API}/api/v1/inpatient/owner/inpatient/{stay['id']}/camera-token",
        headers={**_owner_headers(tokens), "Content-Type": "application/json"},
        json={"camera_id": camera_id, "ttl_minutes": 20, "one_time": True},
        timeout=20,
    )
    assert issue_response.status_code == 200
    token = issue_response.json()["token"]

    first_stream = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient/camera-stream?token={token}",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert first_stream.status_code == 200

    second_stream = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient/camera-stream?token={token}",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert second_stream.status_code == 403
    assert second_stream.json().get("detail", {}).get("code") == "TOKEN_CONSUMED"


@pytest.mark.integration
def test_vet_event_creates_owner_notification(tokens):
    grant = requests.post(
        f"{API}/api/v1/consents",
        headers={**_owner_headers(tokens), "Content-Type": "application/json"},
        json={
            "pet_id": BARSIK_PET_ID,
            "clinic_id": CLINIC_ID,
            "scope_level": "INPATIENT_VIEW",
        },
        timeout=20,
    )
    assert grant.status_code in {200, 201}

    create_event = requests.post(
        f"{API}/api/v1/inpatient/stays/{BARSIK_STAY_ID}/events",
        headers={**_vet_headers(tokens), "Content-Type": "application/json"},
        json={
            "event_type": "status_update",
            "owner_visible": True,
            "title": "QA update",
            "description_safe": "Системная проверка owner-visible обновлений.",
        },
        timeout=20,
    )
    assert create_event.status_code == 201

    notifications = requests.get(
        f"{API}/api/v1/notifications?limit=20",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert notifications.status_code == 200
    rows = notifications.json()
    assert any(row.get("title", "").startswith("Стационар:") for row in rows)
    # new channel column should appear and we expect at least one email when vet triggers owner-visible event
    assert any(row.get("channel") == "email" for row in rows)


@pytest.mark.integration
def test_owner_inpatient_digest_endpoint_shape(tokens):
    response = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient/digest?window_hours=24",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"window_hours", "total_updates", "recent_items", "by_stay"}
    assert isinstance(payload["window_hours"], int)
    assert isinstance(payload["total_updates"], int)
    assert isinstance(payload["recent_items"], list)
    assert isinstance(payload["by_stay"], list)
    if payload["recent_items"]:
        sample = payload["recent_items"][0]
        assert {"id", "stay_id", "kind", "title", "body", "created_at"}.issubset(sample.keys())


@pytest.mark.integration
def test_owner_digest_notification_is_deduplicated(tokens):
    grant = requests.post(
        f"{API}/api/v1/consents",
        headers={**_owner_headers(tokens), "Content-Type": "application/json"},
        json={
            "pet_id": BARSIK_PET_ID,
            "clinic_id": CLINIC_ID,
            "scope_level": "INPATIENT_VIEW",
        },
        timeout=20,
    )
    assert grant.status_code in {200, 201}

    create_event = requests.post(
        f"{API}/api/v1/inpatient/stays/{BARSIK_STAY_ID}/events",
        headers={**_vet_headers(tokens), "Content-Type": "application/json"},
        json={
            "event_type": "status_update",
            "owner_visible": True,
            "title": "Digest dedup check",
            "description_safe": "Проверка дедупликации digest-уведомлений.",
        },
        timeout=20,
    )
    assert create_event.status_code == 201

    before = requests.get(
        f"{API}/api/v1/notifications?limit=100",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert before.status_code == 200
    before_count = sum(1 for row in before.json() if (row.get("metadata") or {}).get("kind") == "inpatient_digest")

    first = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert first.status_code == 200

    mid = requests.get(
        f"{API}/api/v1/notifications?limit=100",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert mid.status_code == 200
    mid_count = sum(1 for row in mid.json() if (row.get("metadata") or {}).get("kind") == "inpatient_digest")

    second = requests.get(
        f"{API}/api/v1/inpatient/owner/inpatient",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert second.status_code == 200

    after = requests.get(
        f"{API}/api/v1/notifications?limit=100",
        headers=_owner_headers(tokens),
        timeout=20,
    )
    assert after.status_code == 200
    after_count = sum(1 for row in after.json() if (row.get("metadata") or {}).get("kind") == "inpatient_digest")

    assert mid_count in {before_count, before_count + 1}
    assert after_count == mid_count
