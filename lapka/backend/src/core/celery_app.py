from celery import Celery
from celery.schedules import crontab

from src.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "lapka",
    broker=settings.celery_broker_url or "redis://localhost:6379/1",
    backend=settings.celery_result_backend or "redis://localhost:6379/2",
    include=[
        "src.tasks.lost_pets",
        "src.tasks.notifications",
        "src.tasks.images",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)

celery_app.conf.beat_schedule = {
    "cleanup-expired-lost-pets": {
        "task": "src.tasks.lost_pets.cleanup_expired_reports",
        "schedule": crontab(hour=3, minute=0),
    },
    "check-hotspot-thresholds": {
        "task": "src.tasks.lost_pets.check_hotspot_thresholds",
        "schedule": crontab(minute="*/15"),
    },
    "process-pending-notifications": {
        "task": "src.tasks.notifications.process_pending",
        "schedule": crontab(minute="*/5"),
    },
}
