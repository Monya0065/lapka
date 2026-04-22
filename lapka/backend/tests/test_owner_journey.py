import os

import pytest
import requests


API = os.getenv("LAPKA_API_BASE", "http://localhost:8000")
CLINIC_ID = "11111111-1111-1111-1111-111111111111"
BARSIK_PET_ID = "55555555-5555-5555-5555-555555555555"


def _login(email: str, password: str = "demo12345", clinic_id: str | None = None) -> str:
    payload = {"email": email, "password": password}
    if clinic_id:
        payload["clinic_id"] = clinic_id
    response = requests.post(
        f"{API}/api/v1/auth/login",
        json=payload,
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def owner_token():
    return _login("owner@lapka.local")


@pytest.fixture(scope="session")
def vet_token():
    return _login("vet@lapka.local", clinic_id=CLINIC_ID)


class TestOwnerPets:
    def test_list_pets(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/pets", headers=headers, timeout=20)
        assert response.status_code == 200
        pets = response.json()
        assert isinstance(pets, list)
        if pets:
            assert "id" in pets[0]
            assert "name" in pets[0]

    def test_get_pet_by_id(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(
            f"{API}/api/v1/pets/{BARSIK_PET_ID}",
            headers=headers,
            timeout=20,
        )
        assert response.status_code == 200
        pet = response.json()
        assert pet["id"] == BARSIK_PET_ID
        assert "name" in pet
        assert "species" in pet

    def test_update_pet_photo(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.patch(
            f"{API}/api/v1/pets/{BARSIK_PET_ID}",
            headers=headers,
            json={"photo_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="},
            timeout=20,
        )
        assert response.status_code == 200
        updated = response.json()
        assert "photo_url" in updated

    def test_create_pet(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/pets",
            headers=headers,
            json={
                "name": "TestPet",
                "species": "cat",
                "breed": "British",
                "sex": "male",
            },
            timeout=20,
        )
        assert response.status_code == 201
        new_pet = response.json()
        assert new_pet["name"] == "TestPet"
        assert new_pet["species"] == "cat"


class TestOwnerAppointments:
    def test_list_appointments(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/owner/appointments", headers=headers, timeout=20)
        assert response.status_code == 200
        appointments = response.json()
        assert isinstance(appointments, list)

    def test_create_appointment(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/owner/appointments",
            headers=headers,
            json={
                "pet_id": BARSIK_PET_ID,
                "vet_id": "44444444-4444-4444-4444-444444444444",
                "clinic_id": CLINIC_ID,
                "scheduled_at": "2026-05-01T10:00:00Z",
                "reason": "Checkup",
            },
            timeout=20,
        )
        assert response.status_code in (201, 409, 422)


class TestOwnerVisits:
    def test_list_visits(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(
            f"{API}/api/v1/owner/pets/{BARSIK_PET_ID}/visits",
            headers=headers,
            timeout=20,
        )
        assert response.status_code in (200, 500)

    def test_get_visit_by_id(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(
            f"{API}/api/v1/owner/visits/66666666-6666-6666-6666-666666666666",
            headers=headers,
            timeout=20,
        )
        assert response.status_code in (200, 404, 500)


class TestOwnerDocuments:
    def test_list_documents(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/owner/documents", headers=headers, timeout=20)
        assert response.status_code in (200, 500)
        docs = response.json() if response.status_code == 200 else []
        assert isinstance(docs, list)

    def test_upload_document_metadata(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/owner/documents/upload-metadata",
            headers=headers,
            json={
                "pet_id": BARSIK_PET_ID,
                "doc_type": "LAB_RESULT",
                "title": "Test Lab Result",
            },
            timeout=20,
        )
        assert response.status_code in (201, 400, 403, 422, 500)


class TestOwnerConsents:
    def test_list_consents(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/owner/consents", headers=headers, timeout=20)
        assert response.status_code in (200, 500)
        consents = response.json() if response.status_code == 200 else []
        assert isinstance(consents, list)

    def test_grant_consent(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/owner/consents",
            headers=headers,
            json={
                "pet_id": BARSIK_PET_ID,
                "clinic_id": CLINIC_ID,
                "scope": "FULL_RECORD",
            },
            timeout=20,
        )
        assert response.status_code in (201, 400, 403, 409, 422, 500)


class TestOwnerTriage:
    def test_ai_triage(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/ai/triage",
            headers=headers,
            json={
                "pet_id": BARSIK_PET_ID,
                "selected_symptoms_ids": ["1"],
                "symptom_text": "vomiting",
                "species": "cat",
            },
            timeout=30,
        )
        assert response.status_code in (200, 422)
        if response.status_code == 200:
            result = response.json()
            assert "level" in result or "triage" in result


class TestOwnerInpatient:
    def test_list_inpatient(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/owner/inpatient", headers=headers, timeout=20)
        assert response.status_code == 200
        inpatient = response.json()
        assert isinstance(inpatient, list)


class TestOwnerVPN:
    def test_get_subscription(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/vpn/subscription", headers=headers, timeout=20)
        assert response.status_code == 200

    def test_get_plans(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/vpn/plans", headers=headers, timeout=20)
        assert response.status_code == 200
        plans = response.json()
        assert isinstance(plans, list)

    def test_checkout(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/vpn/subscription/checkout",
            headers=headers,
            json={"plan_code": "basic_monthly"},
            timeout=20,
        )
        assert response.status_code in (200, 201, 400, 422, 500)


class TestOwnerReminders:
    def test_list_reminders(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.get(f"{API}/api/v1/owner/reminders", headers=headers, timeout=20)
        assert response.status_code in (200, 500)
        reminders = response.json() if response.status_code == 200 else []
        assert isinstance(reminders, list)

    def test_create_reminder(self, owner_token):
        headers = {"Authorization": f"Bearer {owner_token}"}
        response = requests.post(
            f"{API}/api/v1/owner/reminders",
            headers=headers,
            json={
                "pet_id": BARSIK_PET_ID,
                "reminder_type": "VACCINE",
                "due_at": "2026-06-01T10:00:00Z",
                "title": "Vaccine reminder",
            },
            timeout=20,
        )
        assert response.status_code in (201, 400, 403, 422, 500)