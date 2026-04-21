"""Pytest hooks for Lapka backend tests."""

from __future__ import annotations

import os
import time

import pytest


def _integration_items(items: list[pytest.Item]) -> list[pytest.Item]:
    return [item for item in items if item.get_closest_marker("integration")]


def _api_health_ok(api_base: str) -> tuple[bool, str | None]:
    import requests

    try:
        response = requests.get(f"{api_base}/health", timeout=3)
        if response.status_code == 200:
            return True, None
        return False, f"HTTP {response.status_code}"
    except Exception as exc:
        return False, str(exc)


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    int_items = _integration_items(items)
    if not int_items:
        return

    if os.getenv("LAPKA_SKIP_INTEGRATION"):
        skip_int = pytest.mark.skip(reason="LAPKA_SKIP_INTEGRATION=1 (no live API)")
        for item in int_items:
            item.add_marker(skip_int)
        return

    api = os.getenv("LAPKA_API_BASE", "http://localhost:8000").rstrip("/")
    wait_sec = int(os.getenv("LAPKA_API_WAIT_SEC", "25"))
    deadline = time.time() + max(wait_sec, 3)
    last_err: str | None = None
    while time.time() < deadline:
        ok, err = _api_health_ok(api)
        if ok:
            return
        last_err = err
        time.sleep(2)

    if os.getenv("LAPKA_REQUIRE_API") == "1":
        pytest.exit(
            f"Lapka API not reachable at {api}/health ({last_err}). "
            "CI expects a healthy stack; fix docker compose / health checks.",
            returncode=1,
        )

    skip_int = pytest.mark.skip(
        reason=(
            f"Lapka API not reachable at {api}/health ({last_err}). "
            "Start the stack (docker compose up --build), or set LAPKA_SKIP_INTEGRATION=1 "
            "for unit-only runs."
        )
    )
    for item in int_items:
        item.add_marker(skip_int)
