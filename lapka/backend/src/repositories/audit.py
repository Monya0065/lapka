import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import AuditEvent


async def get_audit_event(db: AsyncSession, event_id: uuid.UUID) -> AuditEvent | None:
    return await db.scalar(select(AuditEvent).where(AuditEvent.id == event_id))


async def list_audit_events(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    action: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[AuditEvent]:
    conditions = []
    
    if user_id:
        conditions.append(AuditEvent.actor_user_id == user_id)
    if action:
        conditions.append(AuditEvent.action == action)
    if from_date:
        conditions.append(AuditEvent.created_at >= from_date)
    if to_date:
        conditions.append(AuditEvent.created_at <= to_date)
    
    query = select(AuditEvent).order_by(AuditEvent.created_at.desc())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def count_audit_events(
    db: AsyncSession,
    *,
    action: str | None = None,
    from_date: datetime | None = None,
) -> int:
    conditions = []
    
    if action:
        conditions.append(AuditEvent.action == action)
    if from_date:
        conditions.append(AuditEvent.created_at >= from_date)
    
    query = select(func.count(AuditEvent.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    return int((await db.scalar(query)) or 0)


async def create_audit_event(db: AsyncSession, event: AuditEvent) -> AuditEvent:
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event