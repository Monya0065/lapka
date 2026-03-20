import os

import pytest
import requests


API = os.getenv("LAPKA_API_BASE", "http://localhost:8000")


@pytest.fixture(scope="session")
def tokens():
    def login(email: str, password: str = "demo12345") -> str:
        response = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=15,
        )
        response.raise_for_status()
        return response.json()["access_token"]

    return {
        "owner": login("owner@lapka.local"),
        "vet": login("vet@lapka.local"),
        "admin": login("admin@lapka.local"),
    }


@pytest.mark.integration
def test_vet_search_masked_without_consent(tokens):
    response = requests.get(
        f"{API}/api/v1/clinic/search/patients",
        params={"mode": "chip_id", "q": "LPK-CHIP-00091", "clinic_id": "11111111-1111-1111-1111-111111111111"},
        headers={"Authorization": f"Bearer {tokens['vet']}"},
        timeout=15,
    )
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert payload
    row = payload[0]
    assert row["consent_status"] == "none"
    assert row["owner_name"] == "Owner: hidden"
    assert row["owner_email"] is None


@pytest.mark.integration
def test_vet_open_full_card_only_with_consent(tokens):
    full_pet = "55555555-5555-5555-5555-555555555555"
    no_consent_pet = "60136ddf-8327-5875-8e39-2f336b1d9708"

    ok_response = requests.get(
        f"{API}/api/v1/pets/{full_pet}",
        headers={"Authorization": f"Bearer {tokens['vet']}"},
        timeout=15,
    )
    deny_response = requests.get(
        f"{API}/api/v1/pets/{no_consent_pet}",
        headers={"Authorization": f"Bearer {tokens['vet']}"},
        timeout=15,
    )

    assert ok_response.status_code == 200
    assert deny_response.status_code == 403


@pytest.mark.integration
def test_qr_checkin_returns_minimal_card(tokens):
    owner_pets = requests.get(
        f"{API}/api/v1/owner/search/pets",
        params={"q": "Барсик"},
        headers={"Authorization": f"Bearer {tokens['owner']}"},
        timeout=15,
    )
    owner_pets.raise_for_status()
    lapka_id = owner_pets.json()[0]["lapka_id"]

    response = requests.post(
        f"{API}/api/v1/clinic/checkin/qr",
        json={"token": f"QR-{lapka_id}", "clinic_id": "11111111-1111-1111-1111-111111111111"},
        headers={"Authorization": f"Bearer {tokens['admin']}"},
        timeout=15,
    )
    assert response.status_code == 200
    payload = response.json()

    assert "pet" in payload
    assert "pet_id" in payload["pet"]
    assert "consent_status" in payload
    # no full record payload in check-in response
    assert "visits" not in payload
    assert "documents" not in payload


@pytest.mark.integration
def test_owner_search_only_own_pets(tokens):
    response = requests.get(
        f"{API}/api/v1/owner/search/pets",
        params={"q": ""},
        headers={"Authorization": f"Bearer {tokens['owner']}"},
        timeout=15,
    )
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) <= 4
    assert any(row.get("pet_name") == "Барсик" for row in payload)
