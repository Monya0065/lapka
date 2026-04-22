import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Visit, VisitStatus, PetOwnerLink


async def get_visit(db: AsyncSession, visit_id: uuid.UUID) -> Visit | None:
    return await db.scalar(select(Visit).where(Visit.id == visit_id))


async def get_visit_by_id(db: AsyncSession, visit_id: uuid.UUID) -> Visit | None:
    return await get_visit(db, visit_id)


async def list_visits_by_pet_id(
    db: AsyncSession,
    pet_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> List[Visit]:
    return await list_visits_for_pet(db, pet_id=pet_id, limit=limit, offset=offset)


async def list_visits(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID | None = None,
    clinic_id: uuid.UUID | None = None,
    vet_id: uuid.UUID | None = None,
    status: VisitStatus | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Visit]:
    conditions = []
    
    if pet_id:
        conditions.append(Visit.pet_id == pet_id)
    if clinic_id:
        conditions.append(Visit.clinic_id == clinic_id)
    if vet_id:
        conditions.append(Visit.vet_id == vet_id)
    if status:
        conditions.append(Visit.status == status)
    if from_date:
        conditions.append(Visit.created_at >= from_date)
    if to_date:
        conditions.append(Visit.created_at <= to_date)
    
    query = select(Visit).order_by(Visit.created_at.desc())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def list_visits_for_pet(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> List[Visit]:
    query = (
        select(Visit)
        .where(Visit.pet_id == pet_id)
        .order_by(Visit.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def list_visits_for_owner(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> List[Visit]:
    pet_ids_subquery = (
        select(PetOwnerLink.pet_id)
        .where(PetOwnerLink.user_id == owner_user_id)
    )
    query = (
        select(Visit)
        .where(Visit.pet_id.in_(pet_ids_subquery))
        .order_by(Visit.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def count_visits(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID | None = None,
    clinic_id: uuid.UUID | None = None,
    status: VisitStatus | None = None,
) -> int:
    conditions = []
    if pet_id:
        conditions.append(Visit.pet_id == pet_id)
    if clinic_id:
        conditions.append(Visit.clinic_id == clinic_id)
    if status:
        conditions.append(Visit.status == status)
    
    query = select(func.count(Visit.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    return int((await db.scalar(query)) or 0)


async def create_visit(db: AsyncSession, visit: Visit) -> Visit:
    db.add(visit)
    await db.flush()
    await db.refresh(visit)
    return visit


async def update_visit(db: AsyncSession, visit: Visit) -> Visit:
    await db.flush()
    await db.refresh(visit)
    return visit


async def get_latest_visit_for_pet(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
) -> Visit | None:
    query = (
        select(Visit)
        .where(Visit.pet_id == pet_id)
        .order_by(Visit.created_at.desc())
        .limit(1)
    )
    return await db.scalar(query)