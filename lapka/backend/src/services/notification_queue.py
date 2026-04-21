"""
Async notification queue dispatcher.

Enqueues notifications to Redis queue for async processing by Celery workers.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from src.core.redis_client import get_redis_client


QUEUE_KEY = "notifications:pending"


def enqueue_notification(
    *,
    user_id: str,
    notification_id: str,
    channel: str,
    title: str,
    body: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: int = 0,
) -> bool:
    """Enqueue a notification to Redis for async processing."""
    try:
        redis = get_redis_client()
        payload = {
            "user_id": user_id,
            "notification_id": notification_id,
            "channel": channel,
            "title": title,
            "body": body,
            "action_url": action_url,
            "metadata": metadata or {},
            "priority": priority,
            "enqueued_at": datetime.now(timezone.utc).isoformat(),
            "attempts": 0,
        }
        redis.rpush(QUEUE_KEY, json.dumps(payload, ensure_ascii=True))
        return True
    except Exception:
        return False


async def enqueue_notification_async(
    *,
    user_id: str,
    notification_id: str,
    channel: str,
    title: str,
    body: str,
    action_url: Optional[str] = None,
    metadata: Optional[dict] = None,
    priority: int = 0,
) -> bool:
    """Async version using aioredis if available."""
    try:
        from src.core.redis_client import get_redis_async_client
        redis = get_redis_async_client()
        payload = {
            "user_id": user_id,
            "notification_id": notification_id,
            "channel": channel,
            "title": title,
            "body": body,
            "action_url": action_url,
            "metadata": metadata or {},
            "priority": priority,
            "enqueued_at": datetime.now(timezone.utc).isoformat(),
            "attempts": 0,
        }
        await redis.rpush(QUEUE_KEY, json.dumps(payload, ensure_ascii=True))
        return True
    except Exception:
        return False


def get_pending_count() -> int:
    """Return count of pending notifications in queue."""
    try:
        redis = get_redis_client()
        return redis.llen(QUEUE_KEY)
    except Exception:
        return 0


def get_notification_queue_stats() -> dict:
    """Return queue statistics."""
    try:
        redis = get_redis_client()
        return {
            "pending_count": redis.llen(QUEUE_KEY),
            "queue_key": QUEUE_KEY,
        }
    except Exception as e:
        return {"error": str(e)}