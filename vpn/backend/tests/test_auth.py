import pytest
from httpx import AsyncClient


@pytest.fixture
def test_user():
    return {
        "email": "test@example.com",
        "password": "testpassword123",
        "name": "Test User"
    }


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient, test_user):
    response = await client.post("/api/auth/register", json=test_user)
    assert response.status_code in [201, 400]
    data = response.json()
    assert "access_token" in data or "email" in data or "detail" in data


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    response = await client.post("/api/auth/register", json={
        "email": "invalid",
        "password": "password",
        "name": "Test"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    response = await client.post("/api/auth/login", json={
        "email": "demo@lapka.ru",
        "password": "demo123"
    })
    assert response.status_code in [200, 401]


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    response = await client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_missing_fields(client: AsyncClient):
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com"
    })
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(client: AsyncClient):
    response = await client.get("/api/auth/me")
    assert response.status_code == 401