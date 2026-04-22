import uuid
from datetime import datetime
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Reminder, ReminderType, PetOwnerLink


async def list_reminders_by_user_id(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 100,
    offset: int = 0,
) -> List[Reminder]:
    query = (
        select(Reminder)
        .where(Reminder.owner_user_id == user_id)
        .order_by(Reminder.due_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def create_reminder(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    reminder_type: str,
    due_at: datetime,
    title: str,
) -> Reminder:
    import secrets
    try:
        rem_type = ReminderType[reminder_type.upper()] if reminder_type.upper() in [t.name for t in ReminderType] else ReminderType.GENERAL
    except Exception:
        rem_type = ReminderType.GENERAL
    reminder = Reminder(
        id=uuid.UUID(secrets.token_urlsafe(16)[:16].replace("-", "")[:16].encode().hex()[:16], radix=16) if hasattr(uuid, 'UUID') else uuid.uuid4(),
        pet_id=pet_id,
        owner_user_id=owner_user_id,
        reminder_type=rem_type,
        due_at=due_at,
        title=title,
        is_done=False,
    )
    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)
    return reminder