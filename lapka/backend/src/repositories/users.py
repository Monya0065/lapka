import uuid
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import RoleEnum, User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == email))


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


async def list_users(
    db: AsyncSession,
    *,
    role: RoleEnum | None = None,
    is_active: bool | None = None,
    clinic_id: uuid.UUID | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[User]:
    conditions = []
    
    if role:
        conditions.append(User.role == role)
    if is_active is not None:
        conditions.append(User.is_active == is_active)
    
    query = select(User).order_by(User.created_at.desc())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def search_users(
    db: AsyncSession,
    *,
    query_text: str,
    role: RoleEnum | None = None,
    limit: int = 20,
) -> List[User]:
    search = f"%{query_text}%"
    conditions = [
        or_(
            User.full_name.ilike(search),
            User.email.ilike(search),
        )
    ]
    
    if role:
        conditions.append(User.role == role)
    
    query = (
        select(User)
        .where(and_(*conditions))
        .order_by(User.full_name.asc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())


async def count_users(
    db: AsyncSession,
    *,
    role: RoleEnum | None = None,
    is_active: bool = True,
) -> int:
    query = select(func.count(User.id))
    conditions = [User.is_active == is_active]
    
    if role:
        conditions.append(User.role == role)
    
    query = query.where(and_(*conditions))
    return int((await db.scalar(query)) or 0)


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    full_name: str,
    phone: str | None,
    password_hash: str,
    role: RoleEnum,
) -> User:
    user = User(email=email, full_name=full_name, phone=phone, password_hash=password_hash, role=role)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def update_user(db: AsyncSession, user: User) -> User:
    await db.flush()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, user: User) -> User:
    user.is_active = False
    await db.flush()
    await db.refresh(user)
    return user


async def list_vets_for_clinic(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    limit: int = 50,
) -> List[User]:
    from src.models import Membership, MembershipStatus
    
    membership_subquery = (
        select(Membership.user_id)
        .where(
            and_(
                Membership.clinic_id == clinic_id,
                Membership.status == MembershipStatus.active,
            )
        )
    )
    
    query = (
        select(User)
        .where(
            and_(
                User.id.in_(membership_subquery),
                User.role == RoleEnum.vet,
                User.is_active == True,
            )
        )
        .order_by(User.full_name.asc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())


async def list_owners(
    db: AsyncSession,
    *,
    limit: int = 100,
    offset: int = 0,
) -> List[User]:
    query = (
        select(User)
        .where(User.role == RoleEnum.owner)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())