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


@pytest.fixture(scope="session")
def vet_headers():
    token = _login("vet@lapka.local", clinic_id=CLINIC_ID)
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.mark.integration
def test_no_show_auto_run_endpoint_dry_run(admin_headers):
    response = requests.post(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch/auto-run",
        headers=admin_headers,
        json={
            "days": 90,
            "cooldown_hours": 72,
            "limit": 50,
            "dry_run": True,
        },
        timeout=20,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("status") == "ok"
    assert payload.get("dry_run") is True
    assert isinstance(payload.get("considered"), int)
    assert isinstance(payload.get("applied"), int)
    assert isinstance(payload.get("skipped_due_cooldown"), int)
    assert isinstance(payload.get("actions"), dict)


@pytest.mark.integration
def test_no_show_auto_runner_status_forbidden_for_vet(vet_headers):
    response = requests.get(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch/auto-runner/status",
        headers=vet_headers,
        timeout=20,
    )
    assert response.status_code == 403


@pytest.mark.integration
def test_no_show_auto_runner_status_shape(admin_headers):
    response = requests.get(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch/auto-runner/status",
        headers=admin_headers,
        timeout=20,
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload.get("clinic_id") == CLINIC_ID
    assert "runner_enabled" in payload
    assert isinstance(payload.get("scheduled_hour_utc"), int)
    assert payload.get("utc_date")
    assert payload.get("schedule_health") in {
        "runner_disabled",
        "ok",
        "before_window",
        "in_window",
        "stale",
    }
    assert "ran_today_utc" in payload
    assert ("last_run_age_hours" in payload) and (
        payload.get("last_run_age_hours") is None or isinstance(payload.get("last_run_age_hours"), int)
    )
    assert ("missed_run_days" in payload) and (
        payload.get("missed_run_days") is None or isinstance(payload.get("missed_run_days"), int)
    )
    assert isinstance(payload.get("consecutive_missed_days"), int)
    history = payload.get("run_history_14d")
    assert isinstance(history, list)
    assert len(history) == 14
    assert all(isinstance(item.get("date"), str) for item in history)
    assert all(isinstance(item.get("ran"), bool) for item in history)
    assert all(isinstance(item.get("batches"), int) for item in history)
    last = payload.get("last_run")
    assert last is None or isinstance(last.get("batch_id"), str)


@pytest.mark.integration
def test_no_show_auto_runner_status_matches_last_execute(admin_headers):
    run = requests.post(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch/auto-run",
        headers=admin_headers,
        json={
            "days": 90,
            "cooldown_hours": 72,
            "limit": 20,
            "dry_run": False,
        },
        timeout=30,
    )
    assert run.status_code == 200
    batch_id = run.json().get("batch_id")
    assert batch_id

    status = requests.get(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/no-show-risk/actions/batch/auto-runner/status",
        headers=admin_headers,
        timeout=20,
    )
    assert status.status_code == 200
    payload = status.json()
    last = payload.get("last_run") or {}
    assert last.get("batch_id") == batch_id
    assert payload.get("last_run_age_hours") is not None
    assert int(payload.get("last_run_age_hours")) <= 1
    assert payload.get("missed_run_days") == 0
    assert isinstance(payload.get("consecutive_missed_days"), int)
    assert (payload.get("run_history_14d") or [])[-1].get("ran") is True
