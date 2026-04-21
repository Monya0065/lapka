from __future__ import annotations

from src.core.metrics import metrics_endpoint_label


def test_metrics_endpoint_label_leaves_static_api_paths():
    assert metrics_endpoint_label("/api/v1/pets") == "/api/v1/pets"


def test_metrics_endpoint_label_collapses_uuid_segments():
    uid = "550e8400-e29b-41d4-a716-446655440000"
    assert metrics_endpoint_label(f"/api/v1/pets/{uid}") == "/api/v1/pets/{id}"
    assert (
        metrics_endpoint_label(f"/api/v1/pets/{uid}/visits/{uid}")
        == "/api/v1/pets/{id}/visits/{id}"
    )