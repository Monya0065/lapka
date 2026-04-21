from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any

import psutil

from src.core.redis_client import get_redis_client


async def get_system_metrics() -> dict[str, Any]:
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hostname": os.environ.get("HOSTNAME", "local"),
        "cpu": {
            "percent": round(cpu_percent, 1),
            "count": psutil.cpu_count(),
        },
        "memory": {
            "total_mb": memory.total // (1024 * 1024),
            "available_mb": memory.available // (1024 * 1024),
            "percent": memory.percent,
        },
        "disk": {
            "total_gb": disk.total // (1024 * 1024 * 1024),
            "free_gb": disk.free // (1024 * 1024 * 1024),
            "percent": disk.percent,
        },
    }


async def get_app_metrics() -> dict[str, Any]:
    redis = get_redis_client()
    info = {}
    try:
        info = await redis.info("stats")
    except Exception:
        pass

    keys_count = 0
    try:
        keys_count = await redis.dbsize()
    except Exception:
        pass

    return {
        "redis": {
            "keys": keys_count,
            "connections": info.get("connected_clients", 0),
            "total_commands": info.get("total_commands_processed", 0),
        },
        "uptime_seconds": time.time() - psutil.Process().create_time(),
    }


async def get_health_status() -> dict[str, Any]:
    start = time.perf_counter()
    redis = get_redis_client()
    redis_ok = False

    try:
        await redis.ping()
        redis_ok = True
    except Exception:
        pass

    latency_ms = (time.perf_counter() - start) * 1000

    return {
        "status": "healthy" if redis_ok else "degraded",
        "checks": {
            "redis": "up" if redis_ok else "down",
        },
        "latency_ms": round(latency_ms, 2),
    }


async def increment_api_counter(endpoint: str, status: int) -> None:
    redis = get_redis_client()
    key = f"metrics:api:{endpoint}:{status}"
    try:
        await redis.incr(key)
        await redis.expire(key, 86400)
    except Exception:
        pass


async def get_api_stats() -> dict[str, Any]:
    redis = get_redis_client()
    stats = {}
    try:
        async for key in redis.scan_iter(match="metrics:api:*"):
            _, _, endpoint, status = key.split(":")
            stats[endpoint] = stats.get(endpoint, {})
            stats[endpoint][status] = await redis.get(key)
    except Exception:
        pass
    return stats