"""Integration tests: clinic pharmacy stock, reorder alerts, purchase orders."""

import pytest
import requests

from tests.constants import API, CLINIC_ID


def _login(email: str, password: str = "demo12345", clinic_id: str | None = None) -> str:
    payload = {"email": email, "password": password}
    if clinic_id:
        payload["clinic_id"] = clinic_id
    response = requests.post(f"{API}/api/v1/auth/login", json=payload, timeout=20)
    response.raise_for_status()
    return response.json()["access_token"]


@pytest.fixture(scope="session")
def tokens():
    return {
        "admin": _login("admin@lapka.local", clinic_id=CLINIC_ID),
    }


def _admin_headers(tokens):
    return {"Authorization": f"Bearer {tokens['admin']}", "Content-Type": "application/json"}


def _first_location_id(tokens) -> str:
    response = requests.get(
        f"{API}/api/v1/clinic/pharmacy/locations?clinic_id={CLINIC_ID}",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert response.status_code == 200
    rows = response.json()
    assert isinstance(rows, list) and rows, "seed should link pharmacy locations to demo clinic"
    return rows[0]["id"]


@pytest.mark.integration
def test_inventory_includes_stock_and_reorder_fields(tokens):
    loc_id = _first_location_id(tokens)
    response = requests.get(
        f"{API}/api/v1/clinic/pharmacy/inventory?clinic_id={CLINIC_ID}&location_id={loc_id}",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert response.status_code == 200
    rows = response.json()
    assert isinstance(rows, list) and rows
    row = rows[0]
    assert "stock_units" in row
    assert "reorder_point_units" in row
    assert "reorder_batch_units" in row
    assert "needs_reorder" in row
    assert isinstance(row["needs_reorder"], bool)


@pytest.mark.integration
def test_patch_inventory_updates_stock_units(tokens):
    loc_id = _first_location_id(tokens)
    list_resp = requests.get(
        f"{API}/api/v1/clinic/pharmacy/inventory?clinic_id={CLINIC_ID}&location_id={loc_id}",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert list_resp.status_code == 200
    inv_id = list_resp.json()[0]["id"]

    patch_resp = requests.patch(
        f"{API}/api/v1/clinic/pharmacy/inventory/{inv_id}",
        headers=_admin_headers(tokens),
        json={
            "stock_units": 42,
            "reorder_point_units": 10,
            "reorder_batch_units": 12,
            "preferred_supplier_note": "ООО «ТестСнаб»",
            "price_text": "от 500 RUB",
        },
        timeout=20,
    )
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data.get("stock_units") == 42
    assert data.get("needs_reorder") is False

    get_row = next(
        r for r in requests.get(
            f"{API}/api/v1/clinic/pharmacy/inventory?clinic_id={CLINIC_ID}&location_id={loc_id}",
            headers=_admin_headers(tokens),
            timeout=20,
        ).json()
        if r["id"] == inv_id
    )
    assert get_row["stock_units"] == 42


@pytest.mark.integration
def test_reorder_alerts_list_shape(tokens):
    loc_id = _first_location_id(tokens)
    response = requests.get(
        f"{API}/api/v1/clinic/pharmacy/reorder-alerts?clinic_id={CLINIC_ID}&location_id={loc_id}&limit=20",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert response.status_code == 200
    rows = response.json()
    assert isinstance(rows, list)
    for row in rows:
        assert row.get("needs_reorder") is True
        assert "stock_units" in row


@pytest.mark.integration
def test_purchase_order_receive_increments_stock(tokens):
    orders_resp = requests.get(
        f"{API}/api/v1/clinic/pharmacy/purchase-orders?clinic_id={CLINIC_ID}&limit=20",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert orders_resp.status_code == 200
    orders = orders_resp.json()
    assert isinstance(orders, list)

    target = None
    for order in orders:
        for line in order.get("lines") or []:
            remaining = line["quantity_ordered"] - line["quantity_received"]
            if remaining > 0 and line.get("pharmacy_inventory_id"):
                target = (order["id"], line)
                break
        if target:
            break

    assert target is not None, "seed should include a purchase order with open quantity"
    order_id, line = target
    inv_id = line["pharmacy_inventory_id"]

    before = next(
        r
        for r in requests.get(
            f"{API}/api/v1/clinic/pharmacy/inventory?clinic_id={CLINIC_ID}",
            headers=_admin_headers(tokens),
            timeout=20,
        ).json()
        if r["id"] == inv_id
    )
    stock_before = before["stock_units"]

    qty = min(3, line["quantity_ordered"] - line["quantity_received"])
    recv = requests.post(
        f"{API}/api/v1/clinic/pharmacy/purchase-orders/{order_id}/lines/{line['id']}/receive",
        headers=_admin_headers(tokens),
        json={"quantity": qty},
        timeout=20,
    )
    assert recv.status_code == 200
    assert recv.json().get("applied_quantity") == qty

    after = next(
        r
        for r in requests.get(
            f"{API}/api/v1/clinic/pharmacy/inventory?clinic_id={CLINIC_ID}",
            headers=_admin_headers(tokens),
            timeout=20,
        ).json()
        if r["id"] == inv_id
    )
    assert after["stock_units"] == stock_before + qty


@pytest.mark.integration
def test_create_purchase_order_unique_inventory_lines(tokens):
    loc_id = _first_location_id(tokens)
    inv_resp = requests.get(
        f"{API}/api/v1/clinic/pharmacy/reorder-alerts?clinic_id={CLINIC_ID}&location_id={loc_id}&limit=5",
        headers=_admin_headers(tokens),
        timeout=20,
    )
    assert inv_resp.status_code == 200
    alerts = inv_resp.json()
    if len(alerts) < 1:
        pytest.skip("no reorder alerts to build a minimal order")

    inv_id = alerts[0]["id"]
    create = requests.post(
        f"{API}/api/v1/clinic/pharmacy/purchase-orders",
        headers=_admin_headers(tokens),
        json={
            "clinic_id": CLINIC_ID,
            "pharmacy_location_id": loc_id,
            "supplier_name": "ИП Тестов (закупка)",
            "reference_code": "PO-TEST-001",
            "lines": [
                {"pharmacy_inventory_id": inv_id, "quantity_ordered": 6},
                {"pharmacy_inventory_id": inv_id, "quantity_ordered": 6},
            ],
        },
        timeout=20,
    )
    assert create.status_code == 422

    alert_loc = alerts[0].get("pharmacy_location_id") or loc_id
    create_ok = requests.post(
        f"{API}/api/v1/clinic/pharmacy/purchase-orders",
        headers=_admin_headers(tokens),
        json={
            "clinic_id": CLINIC_ID,
            "pharmacy_location_id": alert_loc,
            "supplier_name": "ИП Тестов (закупка)",
            "lines": [{"pharmacy_inventory_id": inv_id, "quantity_ordered": 6}],
        },
        timeout=20,
    )
    assert create_ok.status_code == 201
    assert create_ok.json().get("id")
