import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Membership, MembershipStatus, RoleEnum


async def get_membership(db: AsyncSession, membership_id: uuid.UUID) -> Membership | None:
    return await db.scalar(select(Membership).where(Membership.id == membership_id))


async def get_membership_by_user_clinic(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    clinic_id: uuid.UUID,
) -> Membership | None:
    return await db.scalar(
        select(Membership).where(
            and_(
                Membership.user_id == user_id,
                Membership.clinic_id == clinic_id,
            )
        )
    )


async def list_memberships_for_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    status: MembershipStatus | None = None,
) -> List[Membership]:
    query = select(Membership).where(Membership.user_id == user_id)
    
    if status:
        query = query.where(Membership.status == status)
    
    return list((await db.scalars(query)).all())


async def list_memberships_for_clinic(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    status: MembershipStatus = MembershipStatus.active,
    role_in_clinic: RoleEnum | None = None,
) -> List[Membership]:
    conditions = [
        Membership.clinic_id == clinic_id,
        Membership.status == status,
    ]
    
    if role_in_clinic:
        conditions.append(Membership.role_in_clinic == role_in_clinic)
    
    query = (
        select(Membership)
        .where(and_(*conditions))
        .order_by(Membership.joined_at.desc())
    )
    return list((await db.scalars(query)).all())


async def list_clinic_admins(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
) -> List[Membership]:
    return await list_memberships_for_clinic(
        db,
        clinic_id=clinic_id,
        role_in_clinic=RoleEnum.clinic_admin,
    )


async def list_clinic_vets(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
) -> List[Membership]:
    return await list_memberships_for_clinic(
        db,
        clinic_id=clinic_id,
        role_in_clinic=RoleEnum.vet,
    )


async def count_memberships(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID | None = None,
    status: MembershipStatus | None = None,
) -> int:
    conditions = []
    
    if clinic_id:
        conditions.append(Membership.clinic_id == clinic_id)
    if status:
        conditions.append(Membership.status == status)
    
    query = select(func.count(Membership.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    return int((await db.scalar(query)) or 0)


async def create_membership(
    db: AsyncSession,
    membership: Membership,
) -> Membership:
    db.add(membership)
    await db.flush()
    await db.refresh(membership)
    return membership


async def update_membership(
    db: AsyncSession,
    membership: Membership,
) -> Membership:
    await db.flush()
    await db.refresh(membership)
    return membership


async def activate_membership(
    db: AsyncSession,
    membership: Membership,
) -> Membership:
    membership.status = MembershipStatus.active
    membership.joined_at = datetime.utcnow()
    await db.flush()
    await db.refresh(membership)
    return membership


async def deactivate_membership(
    db: AsyncSession,
    membership: Membership,
) -> Membership:
    membership.status = MembershipStatus.inactive
    await db.flush()
    await db.refresh(membership)
    return membership


async def delete_membership(
    db: AsyncSession,
    membership: Membership,
) -> None:
    await db.delete(membership)
    await db.flush()