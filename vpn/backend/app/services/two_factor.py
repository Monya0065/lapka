import os
import secrets
import pyotp
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis


class TwoFactorService:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
        self._redis: Optional[redis.Redis] = None
        self.issuer_name = "LapkaVPN"

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    async def generate_secret(self, user_id: str) -> str:
        secret = pyotp.random_base32()
        r = await self._get_redis()
        await r.setex(f"2fa:secret:{user_id}", 300, secret)
        return secret

    async def get_provisioning_uri(self, user_id: str, email: str) -> str:
        r = await self._get_redis()
        secret = await r.get(f"2fa:secret:{user_id}")
        if not secret:
            raise ValueError("Secret not generated")
        
        totp = pyotp.TOTP(secret.decode())
        return totp.provisioning_uri(email, issuer_name=self.issuer_name)

    async def verify_code(self, user_id: str, code: str) -> bool:
        r = await self._get_redis()
        
        secret = await r.get(f"2fa:secret:{user_id}")
        if not secret:
            return False
        
        totp = pyotp.TOTP(secret.decode())
        valid = totp.verify(code, valid_window=1)
        
        if valid:
            await r.delete(f"2fa:secret:{user_id}")
            await r.setex(f"2fa:verified:{user_id}", 86400 * 30, "1")
        
        return valid

    async def is_enabled(self, user_id: str) -> bool:
        r = await self._get_redis()
        result = await r.get(f"2fa:verified:{user_id}")
        return result is not None

    async def enable(self, user_id: str) -> bool:
        r = await self._get_redis()
        await r.setex(f"2fa:verified:{user_id}", 86400 * 30, "1")
        return True

    async def disable(self, user_id: str) -> bool:
        r = await self._get_redis()
        await r.delete(f"2fa:verified:{user_id}")
        return True

    async def generate_backup_codes(self, user_id: str) -> list[str]:
        codes = [secrets.token_hex(4) for _ in range(10)]
        r = await self._get_redis()
        for code in codes:
            await r.sadd(f"2fa:backup:{user_id}", code)
        await r.expire(f"2fa:backup:{user_id}", 86400 * 365)
        return codes

    async def verify_backup_code(self, user_id: str, code: str) -> bool:
        r = await self._get_redis()
        result = await r.srem(f"2fa:backup:{user_id}", code)
        return result > 0

    async def generate_recovery_codes(self, user_id: str) -> list[str]:
        codes = []
        for _ in range(10):
            code = secrets.token_urlsafe(4)
            codes.append(code)
        
        r = await self._get_redis()
        pipe = r.pipeline()
        for code in codes:
            pipe.sadd(f"2fa:recovery:{user_id}", code)
        pipe.expire(f"2fa:recovery:{user_id}", 86400 * 365)
        await pipe.execute()
        return codes

    async def verify_recovery_code(self, user_id: str, code: str) -> bool:
        r = await self._get_redis()
        result = await r.srem(f"2fa:recovery:{user_id}", code)
        return result > 0


two_factor_service = TwoFactorService()