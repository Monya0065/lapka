from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Notification, NotificationType, NotificationChannel


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    body: str | None = None,
    pet_id: uuid.UUID | None = None,
    appointment_id: uuid.UUID | None = None,
    visit_id: uuid.UUID | None = None,
    metadata: dict | None = None,
    channel: NotificationChannel = NotificationChannel.in_app,
) -> Notification:
    """Create a notification record and optionally dispatch to other channels.

    The database schema now includes a ``channel`` field; existing callers
    should continue to work with the default ``in_app`` value.  Higher‑level
    code can pass ``NotificationChannel.email`` (or ``sms``) when wiring a
    notification that should also trigger an external delivery.
    """
    row = Notification(
        user_id=user_id,
        pet_id=pet_id,
        appointment_id=appointment_id,
        visit_id=visit_id,
        notification_type=notification_type,
        channel=channel,
        title=title.strip(),
        body=body.strip() if body else None,
        metadata_json=metadata or {},
        is_read=False,
        read_at=None,
    )
    db.add(row)
    await db.flush()

    # additional delivery for non-in-app channels
    if channel == NotificationChannel.email:
        # placeholder - real implementation would enqueue/send via SMTP
        await _send_email(db, user_id, title, body)
    # future channels could be handled here

    return row


async def list_user_notifications(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 100,
    unread_only: bool = False,
) -> list[Notification]:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    query = query.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 300)))
    return list((await db.scalars(query)).all())




async def _send_email(db: AsyncSession, user_id: uuid.UUID, title: str, body: str | None):
    """Stub for sending email notifications.

    In a production setup this would call an email service (SES, SendGrid,
    etc.).  For now we just write an audit event so integration tests can
    observe the intent.
    """
    # import here to avoid circular dependency
    from src.services.audit import log_audit

    await log_audit(
        db,
        actor_user_id=str(user_id),
        clinic_id=None,
        action="notification.email",
        target_type="notification",
        target_id=None,
        metadata={"title": title, "body": body},
    )


async def mark_notifications_read(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_ids: list[uuid.UUID] | None = None,
    mark_all: bool = False,
) -> int:
    rows = await list_user_notifications(db, user_id=user_id, limit=300, unread_only=True)
    target_ids = set(notification_ids or [])

    marked = 0
    now = datetime.now(timezone.utc)
    for row in rows:
        if mark_all or row.id in target_ids:
            row.is_read = True
            row.read_at = now
            marked += 1
    return marked
