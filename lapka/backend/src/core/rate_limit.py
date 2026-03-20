from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

_bucket: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


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
    now = time.monotonic()
    threshold = now - window_sec

    with _lock:
        queue = _bucket[key]
        while queue and queue[0] < threshold:
            queue.popleft()
        if len(queue) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "RATE_LIMITED", "message": message},
            )
        queue.append(now)

