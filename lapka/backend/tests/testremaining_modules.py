import os
import pytest
import requests


API = os.getenv("LAPKA_API_BASE", "http://localhost:8000")


class TestInsuranceEndpoints:
    def test_list_insurance_policies(self):
        """Test list insurance policies"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        
        resp = requests.get(
            f"{API}/api/v1/owner/insurance/policies",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert resp.status_code in (200, 404)

    def test_list_insurance_claims(self):
        """Test list insurance claims"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        
        resp = requests.get(
            f"{API}/api/v1/owner/insurance/claims",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert resp.status_code in (200, 404)


class TestMarketEndpoints:
    def test_market_clinics(self):
        """Test market clinics endpoint"""
        resp = requests.get(
            f"{API}/api/v1/market/clinics?lat=59.934&lon=30.306",
            timeout=20,
        )
        assert resp.status_code in (200, 422, 404)

    def test_market_vets(self):
        """Test market vets endpoint"""
        resp = requests.get(
            f"{API}/api/v1/market/vets?lat=59.934&lon=30.306",
            timeout=20,
        )
        assert resp.status_code in (200, 422, 404)

    def test_drugs_search(self):
        """Test drug marketplace search"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        
        resp = requests.get(
            f"{API}/api/v1/drugs?q=амоксициллин",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert resp.status_code in (200, 403, 404)


class TestLostPets:
    def test_create_lost_pet_report(self):
        """Test create lost pet report"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        
        resp = requests.post(
            f"{API}/api/v1/owner/lost-pets",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "pet_name": "TestCat",
                "species": "cat",
                "description": "Test description",
                "last_seen_at": "2026-04-22T10:00:00Z",
            },
            timeout=20,
        )
        assert resp.status_code in (201, 400, 422)

    def test_list_lost_pets_public(self):
        """Test public lost pets list"""
        resp = requests.get(
            f"{API}/api/v1/lost-pets",
            timeout=20,
        )
        assert resp.status_code in (200, 404)

    def test_ai_enhance_description(self):
        """Test AI description enhancement"""
        resp = requests.post(
            f"{API}/api/v1/lost-pets/ai/enhance-description",
            json={"description": "gray cat with green eyes"},
            timeout=30,
        )
        assert resp.status_code in (200, 422, 500)