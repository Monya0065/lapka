import pytest


@pytest.mark.asyncio
async def test_get_subscription_not_authenticated(client):
    response = await client.get("/api/billing/subscription")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_payment_not_authenticated(client):
    response = await client.post("/api/billing/payment", json={
        "plan": "monthly",
        "payment_method": "card"
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_payment_webhook_no_signature(client):
    response = await client.post("/api/billing/webhook", json={
        "event": "payment.succeeded",
        "object": {"id": "test"}
    })
    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_get_plans(client):
    response = await client.get("/api/billing/plans")
    assert response.status_code in [200, 401]
    if response.status_code == 200:
        data = response.json()
        assert isinstance(data, list) or isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_payments_not_authenticated(client):
    response = await client.get("/api/billing/payments")
    assert response.status_code == 401