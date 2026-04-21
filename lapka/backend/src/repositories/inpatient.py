import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import InpatientStay, InpatientStatus


async def get_inpatient_stay(db: AsyncSession, stay_id: uuid.UUID) -> InpatientStay | None:
    return await db.scalar(select(InpatientStay).where(InpatientStay.id == stay_id))


async def list_inpatient_stays(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID | None = None,
    clinic_id: uuid.UUID | None = None,
    status: InpatientStatus | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[InpatientStay]:
    conditions = []
    
    if pet_id:
        conditions.append(InpatientStay.pet_id == pet_id)
    if clinic_id:
        conditions.append(InpatientStay.clinic_id == clinic_id)
    if status:
        conditions.append(InpatientStay.status == status)
    if from_date:
        conditions.append(InpatientStay.admitted_at >= from_date)
    if to_date:
        conditions.append(InpatientStay.admitted_at <= to_date)
    
    query = select(InpatientStay).order_by(InpatientStay.admitted_at.desc())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def list_active_stays_for_clinic(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    limit: int = 50,
) -> List[InpatientStay]:
    query = (
        select(InpatientStay)
        .where(
            and_(
                InpatientStay.clinic_id == clinic_id,
                InpatientStay.status == InpatientStatus.active
            )
        )
        .order_by(InpatientStay.admitted_at.desc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())


async def list_stays_for_pet(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> List[InpatientStay]:
    query = (
        select(InpatientStay)
        .where(InpatientStay.pet_id == pet_id)
        .order_by(InpatientStay.admitted_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def count_inpatient_stays(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID | None = None,
    status: InpatientStatus | None = None,
) -> int:
    conditions = []
    if clinic_id:
        conditions.append(InpatientStay.clinic_id == clinic_id)
    if status:
        conditions.append(InpatientStay.status == status)
    
    query = select(func.count(InpatientStay.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    return int((await db.scalar(query)) or 0)


async def create_inpatient_stay(db: AsyncSession, stay: InpatientStay) -> InpatientStay:
    db.add(stay)
    await db.flush()
    await db.refresh(stay)
    return stay


async def update_inpatient_stay(db: AsyncSession, stay: InpatientStay) -> InpatientStay:
    await db.flush()
    await db.refresh(stay)
    return stay


async def get_active_stay_for_pet(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
) -> InpatientStay | None:
    return await db.scalar(
        select(InpatientStay)
        .where(
            and_(
                InpatientStay.pet_id == pet_id,
                InpatientStay.status == InpatientStatus.active
            )
        )
    )