"""IP Blacklist service."""
import os
import redis.asyncio as redis
from datetime import datetime, timedelta
from typing import Optional


class BlacklistService:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    async def is_blacklisted(self, ip: str) -> bool:
        """Check if IP is blacklisted."""
        r = await self._get_redis()
        result = await r.get(f"blacklist:{ip}")
        return result is not None

    async def block_ip(self, ip: str, duration: int = 86400, reason: str = ""):
        """Block IP for duration seconds."""
        r = await self._get_redis()
        
        await r.setex(f"blacklist:{ip}", duration, reason)
        await r.setex(f"blocked_at:{ip}", duration, datetime.utcnow().isoformat())

    async def unblock_ip(self, ip: str):
        """Unblock IP."""
        r = await self._get_redis()
        await r.delete(f"blacklist:{ip}")
        await r.delete(f"blocked_at:{ip}")

    async def get_block_info(self, ip: str) -> Optional[dict]:
        """Get block information."""
        r = await self._get_redis()
        
        reason = await r.get(f"blacklist:{ip}")
        blocked_at = await r.get(f"blocked_at:{ip}")
        
        if not reason:
            return None
        
        ttl = await r.ttl(f"blacklist:{ip}")
        
        return {
            "ip": ip,
            "reason": reason.decode() if reason else "",
            "blocked_at": blocked_at.decode() if blocked_at else "",
            "expires_in": ttl,
        }

    async def get_all_blocked(self) -> list[dict]:
        """Get all blocked IPs."""
        r = await self._get_redis()
        
        keys = await r.keys("blacklist:*")
        
        results = []
        for key in keys:
            ip = key.decode().replace("blacklist:", "")
            info = await self.get_block_info(ip)
            if info:
                results.append(info)
        
        return results

    async def auto_block_suspicious(self, ip: str, reason: str):
        """Auto-block suspicious IP."""
        r = await self._get_redis()
        
        count = await r.incr(f"suspicious:{ip}")
        
        if count >= 10:
            await self.block_ip(ip, duration=3600, reason=reason)
            
            await r.delete(f"suspicious:{ip}")
            
            return True
        
        await r.expire(f"suspicious:{ip}", 300)
        
        return False


blacklist_service = BlacklistService()