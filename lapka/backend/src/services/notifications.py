from __future__ import annotations

import asyncio
import smtplib
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage

import requests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.models import Notification, NotificationType, NotificationChannel, User


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
        # Delivery errors must not break the API request.
        delivery = await _send_email(db, user_id, title, body)
        if delivery:
            row.metadata_json.update(delivery)
            await db.flush()

    if channel == NotificationChannel.sms:
        delivery = await _send_sms(db, user_id, title, body)
        if delivery:
            row.metadata_json.update(delivery)
            await db.flush()

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




async def _send_email(db: AsyncSession, user_id: uuid.UUID, title: str, body: str | None) -> dict | None:
    """Send email via SMTP if configured. Fallback: audit-only."""
    settings = get_settings()
    from src.services.audit import log_audit

    to_email = await db.scalar(select(User).where(User.id == user_id))
    if not to_email or not to_email.email:
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.email",
            target_type="notification",
            target_id=None,
            metadata={"status": "no_recipient", "title": title},
        )
        return {"email_delivery": {"status": "no_recipient"}}

    if not settings.smtp_host or not settings.smtp_from:
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.email",
            target_type="notification",
            target_id=None,
            metadata={"status": "audit_only", "title": title, "body": body},
        )
        return {"email_delivery": {"status": "audit_only"}}

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to_email.email
    message["Subject"] = title.strip()
    message.set_content(body or "")

    def _send_sync() -> None:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)

    try:
        await asyncio.to_thread(_send_sync)
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.email.sent",
            target_type="notification",
            target_id=None,
            metadata={"title": title},
        )
        return {"email_delivery": {"status": "sent"}}
    except Exception as exc:  # noqa: BLE001
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.email.error",
            target_type="notification",
            target_id=None,
            metadata={"title": title, "error": str(exc)},
        )
        return {"email_delivery": {"status": "error", "error": str(exc)}}


async def _send_sms(db: AsyncSession, user_id: uuid.UUID, title: str, body: str | None) -> dict | None:
    """Send SMS via HTTP gateway if configured. Fallback: audit-only."""
    settings = get_settings()
    from src.services.audit import log_audit

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user or not user.phone:
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.sms",
            target_type="notification",
            target_id=None,
            metadata={"status": "no_recipient", "title": title},
        )
        return {"sms_delivery": {"status": "no_recipient"}}

    if not settings.sms_gateway_url:
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.sms",
            target_type="notification",
            target_id=None,
            metadata={"status": "audit_only", "title": title},
        )
        return {"sms_delivery": {"status": "audit_only"}}

    payload = {
        "to": user.phone,
        "from": settings.sms_from,
        "message": f"{title}".strip() + (f"\n{body}" if body else ""),
    }
    headers = {"Content-Type": "application/json"}
    if settings.sms_gateway_api_key:
        headers["Authorization"] = f"Bearer {settings.sms_gateway_api_key}"

    def _post_sync() -> dict:
        resp = requests.post(settings.sms_gateway_url, json=payload, headers=headers, timeout=10)
        try:
            data = resp.json()
        except Exception:
            data = {"text": resp.text}
        resp.raise_for_status()
        return data

    try:
        data = await asyncio.to_thread(_post_sync)
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.sms.sent",
            target_type="notification",
            target_id=None,
            metadata={"title": title},
        )
        return {"sms_delivery": {"status": "sent", "provider": "http", "meta": data}}
    except Exception as exc:  # noqa: BLE001
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="notification.sms.error",
            target_type="notification",
            target_id=None,
            metadata={"title": title, "error": str(exc)},
        )
        return {"sms_delivery": {"status": "error", "error": str(exc)}}


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
