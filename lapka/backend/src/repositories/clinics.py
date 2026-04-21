import uuid
from typing import List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Clinic, Membership, MembershipStatus, User


async def get_clinic(db: AsyncSession, clinic_id: uuid.UUID) -> Clinic | None:
    return await db.scalar(select(Clinic).where(Clinic.id == clinic_id))


async def get_clinic_by_slug(db: AsyncSession, slug: str) -> Clinic | None:
    return await db.scalar(select(Clinic).where(Clinic.slug == slug))


async def list_clinics(
    db: AsyncSession,
    *,
    limit: int = 100,
    offset: int = 0,
    is_active: bool = True,
) -> List[Clinic]:
    query = select(Clinic).order_by(Clinic.name.asc())
    if is_active is not None:
        query = query.where(Clinic.is_active == is_active)
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def search_clinics(
    db: AsyncSession,
    *,
    query_text: str,
    city: str | None = None,
    limit: int = 20,
) -> List[Clinic]:
    conditions = [Clinic.is_active == True]
    
    search_filter = f"%{query_text}%"
    conditions.append(
        (Clinic.name.ilike(search_filter)) | 
        (Clinic.city.ilike(search_filter)) |
        (Clinic.address.ilike(search_filter))
    )
    
    if city:
        conditions.append(Clinic.city.ilike(f"%{city}%"))
    
    query = (
        select(Clinic)
        .where(and_(*conditions))
        .order_by(Clinic.name.asc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())


async def count_clinics(db: AsyncSession, is_active: bool = True) -> int:
    query = select(func.count(Clinic.id)).where(Clinic.is_active == is_active)
    return int((await db.scalar(query)) or 0)


async def get_clinic_with_members(db: AsyncSession, clinic_id: uuid.UUID) -> tuple[Clinic | None, List[User]]:
    clinic = await get_clinic(db, clinic_id)
    if not clinic:
        return None, []
    
    memberships = (
        await db.scalars(
            select(Membership)
            .where(
                and_(
                    Membership.clinic_id == clinic_id,
                    Membership.status == MembershipStatus.active
                )
            )
        )
    ).all()
    
    user_ids = [m.user_id for m in memberships]
    if not user_ids:
        return clinic, []
    
    users = list((await db.scalars(select(User).where(User.id.in_(user_ids)))).all())
    return clinic, users


async def get_membership(
    db: AsyncSession, 
    *, 
    user_id: uuid.UUID, 
    clinic_id: uuid.UUID
) -> Membership | None:
    return await db.scalar(
        select(Membership).where(
            and_(
                Membership.user_id == user_id,
                Membership.clinic_id == clinic_id
            )
        )
    )


async def get_user_memberships(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    status: MembershipStatus | None = None,
) -> List[Membership]:
    query = select(Membership).where(Membership.user_id == user_id)
    if status:
        query = query.where(Membership.status == status)
    return list((await db.scalars(query)).all())


async def get_clinic_members(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    status: MembershipStatus = MembershipStatus.active,
) -> List[Membership]:
    query = (
        select(Membership)
        .where(
            and_(
                Membership.clinic_id == clinic_id,
                Membership.status == status
            )
        )
        .order_by(Membership.created_at.asc())
    )
    return list((await db.scalars(query)).all())


async def create_membership(db: AsyncSession, membership: Membership) -> Membership:
    db.add(membership)
    await db.flush()
    await db.refresh(membership)
    return membership


async def update_membership(db: AsyncSession, membership: Membership) -> Membership:
    await db.flush()
    await db.refresh(membership)
    return membership