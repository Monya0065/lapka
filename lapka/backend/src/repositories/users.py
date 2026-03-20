import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import RoleEnum, User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == email))


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await db.scalar(select(User).where(User.id == user_id))


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
    return user
