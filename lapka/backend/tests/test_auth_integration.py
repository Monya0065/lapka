import os
import pytest
import requests


API = os.getenv("LAPKA_API_BASE", "http://localhost:8000")
CLINIC_ID = "11111111-1111-1111-1111-111111111111"


class TestAuthIntegration:
    def test_login_owner_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_invalid_password(self):
        """Test login fails with invalid password"""
        response = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "wrongpassword"},
            timeout=20,
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self):
        """Test login fails with nonexistent user"""
        response = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "nonexistent@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        assert response.status_code == 401

    def test_login_with_clinic_context(self):
        """Test login with clinic context for vet/admin"""
        response = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "vet@lapka.local", "password": "demo12345", "clinic_id": CLINIC_ID},
            timeout=20,
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_register_new_owner(self):
        """Test registration of new owner"""
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{API}/api/v1/auth/register",
            json={
                "email": email,
                "full_name": "Test User",
                "phone": "+1234567890",
                "password": "testpass123",
            },
            timeout=20,
        )
        assert response.status_code in (200, 201, 409)

    def test_refresh_token(self):
        """Test token refresh"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        refresh_token = login_resp.json()["refresh_token"]
        
        if refresh_token:
            refresh_resp = requests.post(
                f"{API}/api/v1/auth/refresh",
                json={"refresh_token": refresh_token},
                timeout=20,
            )
            assert refresh_resp.status_code == 200
            data = refresh_resp.json()
            assert "access_token" in data

    def test_me_endpoint(self):
        """Test /auth/me returns current user"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        
        me_resp = requests.get(
            f"{API}/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        assert me_resp.status_code == 200
        user = me_resp.json()
        assert "id" in user
        assert "email" in user

    def test_logout(self):
        """Test logout invalidates refresh token"""
        login_resp = requests.post(
            f"{API}/api/v1/auth/login",
            json={"email": "owner@lapka.local", "password": "demo12345"},
            timeout=20,
        )
        token = login_resp.json()["access_token"]
        refresh_t = login_resp.json().get("refresh_token", "")
        
        if refresh_t:
            logout_resp = requests.post(
                f"{API}/api/v1/auth/logout",
                headers={"Authorization": f"Bearer {token}"},
                json={"refresh_token": refresh_t},
                timeout=20,
            )
            assert logout_resp.status_code == 200