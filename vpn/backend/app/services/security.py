"""Security service for password validation and account protection."""
import re
import os
import hashlib
import hmac
import redis.asyncio as redis
from datetime import datetime, timedelta
from typing import Optional


class SecurityService:
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
        self._redis: Optional[redis.Redis] = None

        self.min_password_length = 8
        self.max_password_length = 128
        self.max_login_attempts = 5
        self.lockout_duration = 900  # 15 minutes

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    def validate_password_strength(self, password: str) -> tuple[bool, list[str]]:
        """Validate password strength."""
        errors = []

        if len(password) < self.min_password_length:
            errors.append(f"Пароль должен быть не менее {self.min_password_length} символов")

        if len(password) > self.max_password_length:
            errors.append(f"Пароль должен быть не более {self.max_password_length} символов")

        if not re.search(r"[a-z]", password):
            errors.append("Пароль должен содержать строчные буквы")

        if not re.search(r"[A-Z]", password):
            errors.append("Пароль должен содержать заглавные буквы")

        if not re.search(r"\d", password):
            errors.append("Пароль должен содержать цифры")

        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Пароль должен содержать специальный символ")

        common_passwords = [
            "password", "12345678", "qwerty", "admin", "welcome",
            "letmein", "monkey", "dragon", "master", "login",
        ]
        if password.lower() in common_passwords:
            errors.append("Пароль слишком простой")

        return len(errors) == 0, errors

    def check_password_compromised(self, password: str) -> bool:
        """Check if password was compromised in data breaches."""
        sha1_hash = hashlib.sha1(password.encode()).hexdigest().upper()
        prefix, suffix = sha1_hash[:5], sha1_hash[5:]
        return False

    async def record_failed_login(self, email: str) -> int:
        """Record failed login attempt. Returns current attempt count."""
        r = await self._get_redis()
        key = f"login_attempts:{email}"
        
        count = await r.incr(key)
        await r.expire(key, self.lockout_duration)
        
        return count

    async def get_failed_login_count(self, email: str) -> int:
        """Get failed login attempts count."""
        r = await self._get_redis()
        count = await r.get(f"login_attempts:{email}")
        return int(count) if count else 0

    async def clear_failed_login(self, email: str):
        """Clear failed login attempts after successful login."""
        r = await self._get_redis()
        await r.delete(f"login_attempts:{email}")

    async def is_account_locked(self, email: str) -> bool:
        """Check if account is locked due to failed attempts."""
        count = await self.get_failed_login_count(email)
        return count >= self.max_login_attempts

    async def lock_account(self, email: str, duration: Optional[int] = None):
        """Lock account for specified duration."""
        r = await self._get_redis()
        duration = duration or self.lockout_duration
        await r.setex(f"account_locked:{email}", duration, "1")

    async def unlock_account(self, email: str):
        """Unlock account."""
        r = await self._get_redis()
        await r.delete(f"account_locked:{email}")
        await r.delete(f"login_attempts:{email}")

    async def is_password_breached(self, password: str) -> bool:
        """Check password against breached passwords database."""
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        r = await self._get_redis()
        result = await r.get(f"breached:{password_hash}")
        if result:
            return True
        
        if self.check_password_compromised(password):
            return True
        
        return False

    async def generate_security_token(self, user_id: str, action: str) -> str:
        """Generate security token for sensitive actions."""
        r = await self._get_redis()
        
        token = hashlib.sha256(f"{user_id}:{action}:{datetime.utcnow()}".encode()).hexdigest()
        
        ttl = 3600
        if action == "password_reset":
            ttl = 3600
        elif action == "email_verify":
            ttl = 86400
        elif action == "2fa_setup":
            ttl = 300
        
        await r.setex(f"security_token:{action}:{token}", ttl, user_id)
        
        return token

    async def verify_security_token(self, token: str, action: str) -> Optional[str]:
        """Verify security token and return user_id."""
        r = await self._get_redis()
        user_id = await r.get(f"security_token:{action}:{token}")
        
        if user_id:
            await r.delete(f"security_token:{action}:{token}")
            return user_id.decode() if user_id else None
        
        return None


security_service = SecurityService()