import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import MasterPet


async def get_pet(db: AsyncSession, pet_id: uuid.UUID) -> MasterPet | None:
    return await db.scalar(select(MasterPet).where(MasterPet.id == pet_id))
