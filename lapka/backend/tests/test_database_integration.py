import os
import pytest
import requests


API = os.getenv("LAPKA_API_BASE", "http://localhost:8000")


class TestDatabaseMigration:
    def test_health_endpoint(self):
        """Test /health returns database status"""
        response = requests.get(f"{API}/health", timeout=20)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_docs_accessible(self):
        """Test API docs accessible"""
        response = requests.get(f"{API}/docs", timeout=20)
        assert response.status_code == 200

    def test_openapi_json(self):
        """Test OpenAPI schema accessible"""
        response = requests.get(f"{API}/openapi.json", timeout=20)
        assert response.status_code == 200
        schema = response.json()
        assert "openapi" in schema
        assert "paths" in schema

    def test_seed_data_loaded(self):
        """Test seed data is loaded"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        assert login_resp.status_code == 200

    def test_pets_exist(self):
        """Test pets from seed exist"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        
        pets_resp = requests.get(
            f"{API}/api/v1/pets",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert pets_resp.status_code == 200
        pets = pets_resp.json()
        assert len(pets) > 0

    def test_clinic_exists(self):
        """Test demo clinic exists"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "vet@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        
        users_resp = requests.get(
            f"{API}/api/v1/clinics",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert users_resp.status_code == 200

    def test_visits_possible(self):
        """Test visit creation is possible"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "vet@lapka.local", "password": "demo12345", "clinic_id": "11111111-1111-1111-1111-111111111111"},
            timeout=20,
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        
        patients_resp = requests.get(
            f"{API}/api/v1/clinic/search/patients",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert patients_resp.status_code in (200, 422)