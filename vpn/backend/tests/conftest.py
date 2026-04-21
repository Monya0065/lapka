import pytest
from httpx import AsyncClient


def get_app():
    from app import create_app
    return create_app()


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client() -> AsyncClient:
    app = get_app()
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def authenticated_client(client: AsyncClient) -> AsyncClient:
    response = await client.post("/api/auth/login", json={
        "email": "demo@lapka.ru",
        "password": "demo123"
    })
    if response.status_code == 200:
        token = response.json()["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"
    return client