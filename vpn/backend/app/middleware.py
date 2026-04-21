"""Rate limiting middleware."""
import time
import os
import redis.asyncio as redis
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url: str = None):
        super().__init__(app)
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379")
        self._redis = None
        
        self.limits = {
            "default": (100, 60),
            "auth": (10, 60),
            "login": (5, 60),
            "register": (3, 300),
            "payment": (10, 300),
        }

    async def _get_redis(self):
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host

    def _get_limit(self, path: str) -> tuple[int, int]:
        if "/auth/login" in path:
            return self.limits["login"]
        elif "/auth/register" in path:
            return self.limits["register"]
        elif "/billing/payment" in path:
            return self.limits["payment"]
        elif "/auth" in path:
            return self.limits["auth"]
        return self.limits["default"]

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        path = request.url.path
        
        limit, window = self._get_limit(path)
        key = f"rate:{client_ip}:{path}"
        
        r = await self._get_redis()
        
        current = await r.get(key)
        current = int(current) if current else 0
        
        response = await call_next(request)
        
        if current >= limit:
            response = JSONResponse(
                status_code=429,
                content={
                    "detail": "Слишком много запросов. Попробуйте позже.",
                    "retry_after": window,
                },
            )
            response.headers["Retry-After"] = str(window)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = "0"
            response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window)
        
        await r.incr(key)
        await r.expire(key, window)
        
        remaining = limit - current - 1
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window)
        
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        
        return response


class CORSMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, allowed_origins: list = None):
        super().__init__(app)
        self.allowed_origins = allowed_origins or ["https://lapka.ru", "https://www.lapka.ru"]

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("Origin")
        
        if origin in self.allowed_origins:
            response = await call_next(request)
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response
        
        return await call_next(request)