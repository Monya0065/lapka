"""Repository for User using raw SQL."""
import uuid
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[dict]:
        result = await self.session.execute(
            text("SELECT * FROM users WHERE id = :id"),
            {"id": str(user_id)}
        )
        row = result.fetchone()
        if row:
            return dict(row._mapping)
        return None

    async def get_by_email(self, email: str) -> Optional[dict]:
        result = await self.session.execute(
            text("SELECT * FROM users WHERE email = :email"),
            {"email": email}
        )
        row = result.fetchone()
        if row:
            return dict(row._mapping)
        return None

    async def create(self, email: str, password_hash: str) -> dict:
        user_id = uuid.uuid4()
        await self.session.execute(
            text("""
                INSERT INTO users (id, email, password_hash, mfa_enabled, role)
                VALUES (:id, :email, :password_hash, false, 'user')
                RETURNING id, email, mfa_enabled, role, created_at
            """),
            {
                "id": str(user_id),
                "email": email,
                "password_hash": password_hash,
            }
        )
        await self.session.commit()
        return {
            "id": str(user_id),
            "email": email,
            "password_hash": password_hash,
            "mfa_enabled": False,
            "role": "user",
        }

    async def update_mfa(self, user_id: uuid.UUID, enabled: bool) -> Optional[dict]:
        await self.session.execute(
            text("UPDATE users SET mfa_enabled = :enabled WHERE id = :id"),
            {"id": str(user_id), "enabled": enabled}
        )
        await self.session.commit()
        return await self.get_by_id(user_id)