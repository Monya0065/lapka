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
def test_dashboard_returns_kpi_targets_and_progress(admin_headers):
    response = requests.get(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/dashboard?period_days=30",
        headers=admin_headers,
        timeout=20,
    )
    assert response.status_code == 200
    payload = response.json()
    assert "kpi_targets" in payload
    assert "kpi_progress" in payload
    assert {"daily_patients_target", "monthly_revenue_target_cents", "max_wait_over_15_target"}.issubset(
        payload["kpi_targets"].keys()
    )


@pytest.mark.integration
def test_update_kpi_targets_persists(admin_headers):
    update = requests.put(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/kpi-targets",
        headers=admin_headers,
        json={
            "daily_patients_target": 31,
            "monthly_revenue_target_cents": 7770000,
            "max_wait_over_15_target": 4,
        },
        timeout=20,
    )
    assert update.status_code == 200

    verify = requests.get(
        f"{API}/api/v1/analytics/clinic/{CLINIC_ID}/dashboard?period_days=30",
        headers=admin_headers,
        timeout=20,
    )
    assert verify.status_code == 200
    targets = verify.json().get("kpi_targets") or {}
    assert targets.get("daily_patients_target") == 31
    assert targets.get("monthly_revenue_target_cents") == 7770000
    assert targets.get("max_wait_over_15_target") == 4
