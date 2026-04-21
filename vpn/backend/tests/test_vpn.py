import pytest


@pytest.mark.asyncio
async def test_get_nodes_not_authenticated(client):
    response = await client.get("/api/vpn/nodes")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_config_not_authenticated(client):
    response = await client.get("/api/vpn/config/some-device-id")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_connect_not_authenticated(client):
    response = await client.post("/api/vpn/connect", json={
        "device_id": "some-id",
        "node_id": "some-node"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_disconnect_not_authenticated(client):
    response = await client.post("/api/vpn/disconnect")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_stats_not_authenticated(client):
    response = await client.get("/api/vpn/stats")
    assert response.status_code == 401