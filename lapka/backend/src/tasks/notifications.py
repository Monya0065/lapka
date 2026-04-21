from src.core.celery_app import celery_app
from src.core.redis_client import get_redis_client


@celery_app.task(name="src.tasks.notifications.process_pending")
def process_pending():
    """Process pending notifications from queue."""
    redis_client = get_redis_client()
    processed = 0

    while processed < 100:
        notification_data = redis_client.lpop("notifications:pending")
        if not notification_data:
            break

        processed += 1

    return {"processed_count": processed}


@celery_app.task(name="src.tasks.notifications.send_email")
def send_email(to: str, subject: str, body: str):
    """Send email notification (placeholder)."""
    return {
        "to": to,
        "subject": subject,
        "sent": True
    }


@celery_app.task(name="src.tasks.notifications.send_sms")
def send_sms(to: str, message: str):
    """Send SMS notification (placeholder)."""
    return {
        "to": to,
        "message": message,
        "sent": True
    }


@celery_app.task(name="src.tasks.notifications.send_push")
def send_push(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification (placeholder)."""
    return {
        "user_id": user_id,
        "title": title,
        "body": body,
        "sent": True
    }
