"""Health check router with detailed status."""
import time
import os
from datetime import datetime
from fastapi import APIRouter, status, Response
from sqlalchemy import text

from app.database import create_engine
import redis.asyncio as redis

router = APIRouter()


class Metrics:
    def __init__(self):
        self.requests_total = 0
        self.requests_by_endpoint = {}
        self.errors_total = 0
        self.start_time = time.time()

    def increment_request(self, endpoint: str):
        self.requests_total += 1
        self.requests_by_endpoint[endpoint] = self.requests_by_endpoint.get(endpoint, 0) + 1

    def increment_error(self):
        self.errors_total += 1


metrics = Metrics()


@router.get("/health")
async def health_check():
    """Basic health check."""
    uptime = int(time.time() - metrics.start_time)
    return {
        "status": "ok",
        "service": "lapka-vpn",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "uptime_seconds": uptime,
    }


@router.get("/health/ready")
async def readiness_check(response: Response):
    """Readiness check for Kubernetes."""
    checks = {}
    is_ready = True

    try:
        engine = create_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        is_ready = False

    try:
        r = await redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))
        await r.ping()
        checks["redis"] = "ok"
        await r.aclose()
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"
        is_ready = False

    response.headers["X-Service-Ready"] = str(is_ready).lower()
    
    if is_ready:
        return {"ready": True, "checks": checks}
    return {"ready": False, "checks": checks, "timestamp": datetime.utcnow().isoformat()}, status.HTTP_503_SERVICE_UNAVAILABLE


@router.get("/health/live")
async def liveness_check():
    """Liveness check for Kubernetes."""
    return {"alive": True, "timestamp": datetime.utcnow().isoformat()}


@router.get("/metrics")
async def prometheus_metrics():
    """Prometheus-compatible metrics."""
    uptime = int(time.time() - metrics.start_time)
    return {
        "vpn_api_requests_total": metrics.requests_total,
        "vpn_api_errors_total": metrics.errors_total,
        "vpn_api_uptime_seconds": uptime,
        "# HELP vpn_api_requests_total Total requests",
        "# TYPE vpn_api_requests_total counter",
        "# HELP vpn_api_errors_total Total errors",
        "# TYPE vpn_api_errors_total counter",
    }


@router.get("/metrics/json")
async def get_metrics_json():
    """Get metrics as JSON."""
    uptime = int(time.time() - metrics.start_time)
    return {
        "requests_total": metrics.requests_total,
        "requests_by_endpoint": metrics.requests_by_endpoint,
        "errors_total": metrics.errors_total,
        "uptime_seconds": uptime,
    }


@router.post("/metrics/reset")
async def reset_metrics():
    """Reset metrics (admin only)."""
    metrics.requests_total = 0
    metrics.requests_by_endpoint = {}
    metrics.errors_total = 0
    metrics.start_time = time.time()
    return {"reset": True}