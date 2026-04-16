from __future__ import annotations

from functools import lru_cache

import redis.asyncio as redis

from src.core.config import get_settings


@lru_cache(maxsize=1)
def get_redis_client() -> redis.Redis:
    settings = get_settings()
    return redis.Redis.from_url(settings.redis_url or "redis://localhost:6379/0", decode_responses=True)

