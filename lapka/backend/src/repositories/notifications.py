import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Notification, NotificationChannel, NotificationType


async def get_notification(db: AsyncSession, notification_id: uuid.UUID) -> Notification | None:
    return await db.scalar(select(Notification).where(Notification.id == notification_id))


async def list_notifications(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    is_read: bool | None = None,
    notification_type: NotificationType | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> List[Notification]:
    conditions = [Notification.user_id == user_id]
    
    if is_read is not None:
        conditions.append(Notification.is_read == is_read)
    if notification_type:
        conditions.append(Notification.notification_type == notification_type)
    if from_date:
        conditions.append(Notification.created_at >= from_date)
    if to_date:
        conditions.append(Notification.created_at <= to_date)
    
    query = (
        select(Notification)
        .where(and_(*conditions))
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def count_unread_notifications(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> int:
    query = (
        select(func.count(Notification.id))
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
    )
    return int((await db.scalar(query)) or 0)


async def create_notification(db: AsyncSession, notification: Notification) -> Notification:
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


async def mark_notification_read(
    db: AsyncSession,
    notification_id: uuid.UUID,
) -> Notification | None:
    notification = await get_notification(db, notification_id)
    if notification:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        await db.flush()
        await db.refresh(notification)
    return notification


async def mark_all_notifications_read(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> int:
    from sqlalchemy import update
    
    stmt = (
        update(Notification)
        .where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        .values(is_read=True, read_at=datetime.utcnow())
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount


async def delete_notification(
    db: AsyncSession,
    notification_id: uuid.UUID,
) -> bool:
    notification = await get_notification(db, notification_id)
    if notification:
        await db.delete(notification)
        await db.flush()
        return True
    return False


async def get_notification_preferences(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> dict:
    from sqlalchemy import select
    from src.models import UserNotificationPreference
    
    prefs = await db.scalar(
        select(UserNotificationPreference).where(UserNotificationPreference.user_id == user_id)
    )
    
    if not prefs:
        return {
            "email": True,
            "sms": False,
            "push": True,
            "appointment_reminder": True,
            "document_alerts": True,
            "marketing": False,
        }
    
    return {
        "email": prefs.email_enabled,
        "sms": prefs.sms_enabled,
        "push": prefs.push_enabled,
        "appointment_reminder": prefs.appointment_reminder,
        "document_alerts": prefs.document_alerts,
        "marketing": prefs.marketing,
    }