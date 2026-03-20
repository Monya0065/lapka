import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ConsentGrant, ConsentScope


async def list_consents_for_owner(db: AsyncSession, owner_user_id: uuid.UUID) -> list[ConsentGrant]:
    rows = await db.scalars(select(ConsentGrant).where(ConsentGrant.owner_user_id == owner_user_id))
    return list(rows)


async def create_consent(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    clinic_id: uuid.UUID,
    scope_level: ConsentScope,
    expires_at: datetime | None,
) -> ConsentGrant:
    consent = ConsentGrant(
        pet_id=pet_id,
        owner_user_id=owner_user_id,
        clinic_id=clinic_id,
        scope_level=scope_level,
        expires_at=expires_at,
    )
    db.add(consent)
    await db.flush()
    return consent


async def get_consent(db: AsyncSession, consent_id: uuid.UUID) -> ConsentGrant | None:
    return await db.scalar(select(ConsentGrant).where(ConsentGrant.id == consent_id))
