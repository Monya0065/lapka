"""Redis caching service."""
import os
import json
import redis.asyncio as redis
from datetime import datetime
from typing import Optional, Any


class CacheService:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
        self._redis: Optional[redis.Redis] = None
        self.default_ttl = 300

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        r = await self._get_redis()
        value = await r.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value.decode() if value else None
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache."""
        r = await self._get_redis()
        ttl = ttl or self.default_ttl
        
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        
        await r.setex(key, ttl, value)

    async def delete(self, key: str):
        """Delete key from cache."""
        r = await self._get_redis()
        await r.delete(key)

    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        r = await self._get_redis()
        return await r.exists(key) > 0

    async def incr(self, key: str, amount: int = 1) -> int:
        """Increment value."""
        r = await self._get_redis()
        return await r.incr(key, amount)

    async def decr(self, key: str, amount: int = 1) -> int:
        """Decrement value."""
        r = await self._get_redis()
        return await r.decr(key, amount)

    async def get_subscription(self, user_id: str) -> Optional[dict]:
        """Get cached subscription."""
        return await self.get(f"subscription:{user_id}")

    async def set_subscription(self, user_id: str, subscription: dict, ttl: int = 300):
        """Cache subscription."""
        await self.set(f"subscription:{user_id}", subscription, ttl)

    async def invalidate_subscription(self, user_id: str):
        """Invalidate subscription cache."""
        await self.delete(f"subscription:{user_id}")

    async def get_user(self, user_id: str) -> Optional[dict]:
        """Get cached user."""
        return await self.get(f"user:{user_id}")

    async def set_user(self, user_id: str, user: dict, ttl: int = 600):
        """Cache user."""
        await self.set(f"user:{user_id}", user, ttl)

    async def invalidate_user(self, user_id: str):
        """Invalidate user cache."""
        await self.delete(f"user:{user_id}")

    async def get_vpn_nodes(self) -> Optional[list]:
        """Get cached VPN nodes."""
        return await self.get("vpn:nodes")

    async def set_vpn_nodes(self, nodes: list, ttl: int = 60):
        """Cache VPN nodes."""
        await self.set("vpn:nodes", nodes, ttl)

    async def get_stats(self) -> Optional[dict]:
        """Get cached stats."""
        return await self.get("stats:global")

    async def set_stats(self, stats: dict, ttl: int = 30):
        """Cache stats."""
        await self.set("stats:global", stats, ttl)

    async def invalidate_all(self):
        """Clear all cache."""
        r = await self._get_redis()
        await r.flushdb()

    async def get_rate_limit(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        """Check rate limit. Returns (allowed, remaining)."""
        r = await self._get_redis()
        
        current = await r.get(key)
        current = int(current) if current else 0
        
        if current >= limit:
            return False, 0
        
        await r.incr(key)
        await r.expire(key, window)
        
        return True, limit - current - 1


cache_service = CacheService()