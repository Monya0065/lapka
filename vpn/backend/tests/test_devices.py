import pytest


@pytest.mark.asyncio
async def test_get_devices_not_authenticated(client):
    response = await client.get("/api/devices")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_device_not_authenticated(client):
    response = await client.post("/api/devices", json={"name": "Test Device"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_device_not_found(client):
    response = await client.get("/api/devices/nonexistent-id")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_device_not_authenticated(client):
    response = await client.delete("/api/devices/some-id")
    assert response.status_code == 401