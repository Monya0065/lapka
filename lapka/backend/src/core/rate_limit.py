from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status
from src.core.config import get_settings

_bucket: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()
_settings = get_settings()


def enforce_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int = 80,
    window_sec: int = 60,
    message: str = "Too many requests. Try again later.",
) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"{scope}:{ip}"
    _evict_old(key, window_sec)
    with _lock:
        queue = _bucket[key]
        if len(queue) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "RATE_LIMITED", "message": message},
            )
        queue.append(time.monotonic())


def enforce_user_rate_limit(user_id: str | None, scope: str, message: str = "Too many requests. Try again later.") -> None:
    """Per-user rate limit. Falls back to no-op if user_id is None."""
    if not user_id:
        return
    user_limit = _settings.per_user_rate_limit or 200
    user_window = _settings.per_user_rate_window_sec or 60
    key = f"{scope}:user:{user_id}"
    _evict_old(key, user_window)
    with _lock:
        queue = _bucket[key]
        if len(queue) >= user_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "RATE_LIMITED", "message": message},
            )
        queue.append(time.monotonic())


def _evict_old(key: str, window_sec: float) -> None:
    now = time.monotonic()
    threshold = now - window_sec
    with _lock:
        queue = _bucket[key]
        while queue and queue[0] < threshold:
            queue.popleft()
        if not queue:
            del _bucket[key]


def get_rate_limit_stats(user_id: str | None = None) -> dict:
    """Return current rate limit usage for a user."""
    if not user_id:
        return {}
    user_window = _settings.per_user_rate_window_sec or 60
    key = f"authenticated:user:{user_id}"
    with _lock:
        queue = _bucket.get(key, deque())
        _evict_old(key, user_window)
        queue = _bucket.get(key, deque())
        return {
            "user_id": user_id,
            "window_sec": user_window,
            "limit": _settings.per_user_rate_limit or 200,
            "current": len(queue),
        }

