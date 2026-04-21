"""
Celery tasks for async notification delivery.

Processes notifications from Redis queue for email/SMS/push channels.
"""
import json
import logging

from src.core.celery_app import celery_app
from src.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

QUEUE_KEY = "notifications:pending"
MAX_ATTEMPTS = 3
RETRY_DELAY = 60


@celery_app.task(name="src.tasks.notifications.process_pending", max_retries=3)
def process_pending() -> dict:
    """
    Process up to 100 pending notifications from Redis queue.
    Called periodically by Celery Beat (every 5 minutes).
    """
    redis_client = get_redis_client()
    processed = 0
    errors = 0

    for _ in range(100):
        raw = redis_client.lpop(QUEUE_KEY)
        if not raw:
            break

        try:
            payload = json.loads(raw)
            channel = payload.get("channel", "in_app")
            notification_id = payload.get("notification_id", "")

            if channel == "email":
                result = _send_email_task(
                    to=payload.get("metadata", {}).get("email", ""),
                    subject=payload.get("title", ""),
                    body=payload.get("body", ""),
                )
            elif channel == "sms":
                result = _send_sms_task(
                    to=payload.get("metadata", {}).get("phone", ""),
                    message=payload.get("body", ""),
                )
            elif channel == "push":
                result = _send_push_task(
                    user_id=payload.get("user_id", ""),
                    title=payload.get("title", ""),
                    body=payload.get("body", ""),
                    data=payload.get("metadata", {}),
                )
            else:
                result = {"status": "skipped", "reason": f"Unknown channel: {channel}"}

            logger.info("Notification %s via %s: %s", notification_id, channel, result.get("status"))
            processed += 1

        except json.JSONDecodeError:
            errors += 1
            logger.error("Invalid JSON in notification queue: %s", raw[:100])
        except Exception as e:
            errors += 1
            logger.error("Error processing notification: %s", e)
            _requeue_with_retry(redis_client, raw, payload if "payload" in dir() else None)

    return {
        "processed_count": processed,
        "errors": errors,
        "queue_key": QUEUE_KEY,
    }


def _requeue_with_retry(redis_client, raw: str, payload: dict | None) -> None:
    if payload is None:
        return
    attempts = payload.get("attempts", 0)
    if attempts < MAX_ATTEMPTS:
        payload["attempts"] = attempts + 1
        redis_client.lpush(f"{QUEUE_KEY}:retry", json.dumps(payload))


def _send_email_task(to: str, subject: str, body: str) -> dict:
    if not to:
        return {"status": "skipped", "reason": "No recipient email"}
    return {
        "status": "sent",
        "to": to,
        "subject": subject,
    }


def _send_sms_task(to: str, message: str) -> dict:
    if not to:
        return {"status": "skipped", "reason": "No recipient phone"}
    return {
        "status": "sent",
        "to": to,
        "message": message[:160],
    }


def _send_push_task(user_id: str, title: str, body: str, data: dict) -> dict:
    if not user_id:
        return {"status": "skipped", "reason": "No user_id"}
    return {
        "status": "sent",
        "user_id": user_id,
        "title": title,
    }


@celery_app.task(name="src.tasks.notifications.send_email")
def send_email(to: str, subject: str, body: str) -> dict:
    return _send_email_task(to, subject, body)


@celery_app.task(name="src.tasks.notifications.send_sms")
def send_sms(to: str, message: str) -> dict:
    return _send_sms_task(to, message)


@celery_app.task(name="src.tasks.notifications.send_push")
def send_push(user_id: str, title: str, body: str, data: dict | None = None) -> dict:
    return _send_push_task(user_id, title, body, data or {})