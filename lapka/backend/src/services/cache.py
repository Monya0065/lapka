from __future__ import annotations

import json
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import redis.asyncio as redis

from src.core.config import get_settings
from src.core.redis_client import get_redis_client

DEFAULT_TTL_SEC = 300
LONG_TTL_SEC = 3600


async def get_cached(key: str) -> tuple[bool, Any]:
    client = get_redis_client()
    try:
        value = await client.get(key)
        if value is None:
            return False, None
        try:
            return True, json.loads(value)
        except json.JSONDecodeError:
            return True, value
    except redis.RedisError:
        return False, None


async def set_cached(key: str, value: Any, ttl_sec: int = DEFAULT_TTL_SEC) -> bool:
    client = get_redis_client()
    try:
        serialized = json.dumps(value) if not isinstance(value, str) else value
        await client.setex(key, ttl_sec, serialized)
        return True
    except redis.RedisError:
        return False


async def delete_cached(key: str) -> bool:
    client = get_redis_client()
    try:
        await client.delete(key)
        return True
    except redis.RedisError:
        return False


async def invalidate_prefix(prefix: str) -> int:
    client = get_redis_client()
    try:
        keys = []
        async for key in client.scan_iter(match=f"{prefix}*"):
            keys.append(key)
        if keys:
            return await client.delete(*keys)
        return 0
    except redis.RedisError:
        return 0


def cache_key(prefix: str, *args: Any) -> str:
    parts = [prefix]
    for arg in args:
        if arg is not None:
            parts.append(str(arg))
    key = ":".join(parts)
    if len(key) > 200:
        hash_suffix = hashlib.sha256(key.encode()).hexdigest()[:16]
        return f"{prefix}:{hash_suffix}"
    return key


async def cache_get_or_set(
    key: str,
    factory: Callable[[], Any],
    ttl_sec: int = DEFAULT_TTL_SEC,
    force_refresh: bool = False,
) -> Any:
    if not force_refresh:
        found, cached = await get_cached(key)
        if found:
            return cached

    value = await factory() if callable(factory) else factory
    await set_cached(key, value, ttl_sec)
    return value


async def rate_limit_check(
    key: str,
    limit: int,
    window_sec: int = 60,
) -> tuple[bool, int]:
    client = get_redis_client()
    try:
        now = datetime.now(timezone.utc).timestamp()
        window_key = f"rate:{key}"

        pipe = client.pipeline()
        pipe.zremrangebyscore(window_key, 0, now - window_sec)
        pipe.zadd(window_key, {str(now): now})
        pipe.expire(window_key, window_sec + 1)
        results = await pipe.execute()

        count = results[2] - 1
        allowed = count < limit

        if not allowed:
            await client.zrem(window_key, str(now))

        return allowed, max(0, limit - count)
    except redis.RedisError:
        return True, limit


async def increment_counter(key: str, ttl_sec: int = 86400) -> int:
    client = get_redis_client()
    try:
        value = await client.incr(key)
        if value == 1:
            await client.expire(key, ttl_sec)
        return value
    except redis.RedisError:
        return 0


async def get_counter(key: str) -> int:
    client = get_redis_client()
    try:
        value = await client.get(key)
        return int(value or 0)
    except redis.RedisError:
        return 0


async def set_session(
    session_id: str,
    data: dict[str, Any],
    ttl_sec: int = 604800,
) -> bool:
    key = f"session:{session_id}"
    return await set_cached(key, data, ttl_sec)


async def get_session(session_id: str) -> dict[str, Any] | None:
    key = f"session:{session_id}"
    found, value = await get_cached(key)
    return value if found else None


async def delete_session(session_id: str) -> bool:
    key = f"session:{session_id}"
    return await delete_cached(key)


export_cache_functions = {
    "get_cached",
    "set_cached",
    "delete_cached",
    "invalidate_prefix",
    "cache_key",
    "cache_get_or_set",
    "rate_limit_check",
    "increment_counter",
    "get_counter",
    "set_session",
    "get_session",
    "delete_session",
}