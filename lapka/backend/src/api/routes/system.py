from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from src.core.metrics import get_metrics_snapshot

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/metrics")
async def system_metrics() -> dict:
    snapshot = get_metrics_snapshot()
    snapshot["timestamp"] = datetime.now(timezone.utc).isoformat()
    return snapshot

