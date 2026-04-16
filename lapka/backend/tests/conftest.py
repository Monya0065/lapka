"""Pytest hooks for Lapka backend tests."""

from __future__ import annotations

import os
import time

import pytest


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if not os.getenv("LAPKA_SKIP_INTEGRATION"):
        return
    skip_int = pytest.mark.skip(reason="LAPKA_SKIP_INTEGRATION=1 (no live API)")
    for item in items:
        if item.get_closest_marker("integration"):
            item.add_marker(skip_int)


def pytest_report_collectionfinish(
    config: pytest.Config, start_path: object, items: list[pytest.Item] | None
) -> None:
    """Wait for a healthy API before integration tests (avoids flaky Connection refused)."""
    if os.getenv("LAPKA_SKIP_INTEGRATION"):
        return
    if not items:
        return
    if not any(item.get_closest_marker("integration") for item in items):
        return

    import requests

    api = os.getenv("LAPKA_API_BASE", "http://localhost:8000").rstrip("/")
    deadline = time.time() + 120
    last_err: str | None = None
    while time.time() < deadline:
        try:
            response = requests.get(f"{api}/health", timeout=3)
            if response.status_code == 200:
                return
            last_err = f"HTTP {response.status_code}"
        except Exception as exc:
            last_err = str(exc)
        time.sleep(2)

    pytest.exit(
        f"Lapka API not reachable at {api}/health ({last_err}). "
        "Start the stack (docker compose up --build) or set LAPKA_SKIP_INTEGRATION=1 for unit-only runs.",
        returncode=1,
    )
