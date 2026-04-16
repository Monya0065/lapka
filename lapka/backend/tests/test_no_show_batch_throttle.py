import pytest
import requests

from tests.constants import API, CLINIC_ID


def _login(email: str, password: str = "demo12345", clinic_id: str | None = None) -> str:
    payload = {"email": email, "password": password}
    if clinic_id:
        payload["clinic_id"] = clinic_id
    response = requests.post(f"{API}/api/v1/auth/login", json=payload, timeout=20)
    response.raise_for_status()
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers():
    token = _login("admin@lapka.local", clinic_id=CLINIC_ID)
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.mark.integration
def test_no_show_batch_respects_cooldown(admin_headers):
    risk = requests.get(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk?days=120",
        headers=admin_headers,
        timeout=20,
    )
    assert risk.status_code == 200
    rows = risk.json()
    if not rows:
        pytest.skip("No no-show risk rows in seed data")

    owner_id = rows[0]["owner_user_id"]
    risk_level = rows[0]["risk_level"]
    segment = "high_medium" if risk_level in {"high", "medium"} else "low"
    action = "soft_reminder"

    single = requests.post(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions",
        headers=admin_headers,
        json={"owner_user_id": owner_id, "action": action, "note": "cooldown-seed"},
        timeout=20,
    )
    assert single.status_code == 200

    preview = requests.post(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch",
        headers=admin_headers,
        json={
            "segment": segment,
            "action": action,
            "days": 120,
            "limit": 200,
            "cooldown_hours": 336,
            "dry_run": True,
        },
        timeout=20,
    )
    assert preview.status_code == 200
    preview_payload = preview.json()
    assert preview_payload.get("cooldown_hours") == 336
    assert int(preview_payload.get("skipped_due_cooldown") or 0) >= 1
    assert owner_id not in (preview_payload.get("owners") or [])

    execute = requests.post(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch",
        headers=admin_headers,
        json={
            "segment": segment,
            "action": action,
            "days": 120,
            "limit": 200,
            "cooldown_hours": 336,
            "confirm_token": preview_payload.get("confirm_token_hint"),
            "preview_token": preview_payload.get("preview_token"),
        },
        timeout=20,
    )
    assert execute.status_code == 200
    exec_payload = execute.json()
    assert exec_payload.get("cooldown_hours") == 336
    assert int(exec_payload.get("skipped_due_cooldown") or 0) >= 1
