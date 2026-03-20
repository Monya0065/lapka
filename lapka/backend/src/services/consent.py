from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import ConsentGrant, ConsentScope, PetOwnerLink
from src.repositories.consents import create_consent, get_consent, list_consents_for_owner
from src.repositories.pets import get_pet
from src.services.audit import log_audit


async def list_owner_consents(db: AsyncSession, *, owner_user_id: uuid.UUID) -> list[ConsentGrant]:
    return await list_consents_for_owner(db, owner_user_id)


async def grant_consent(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    pet_id: uuid.UUID,
    clinic_id: uuid.UUID,
    scope_level: ConsentScope,
    expires_at: datetime | None,
) -> ConsentGrant:
    pet = await get_pet(db, pet_id)
    if not pet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    owner_link = await db.scalar(
        select(PetOwnerLink).where(PetOwnerLink.pet_id == pet_id, PetOwnerLink.owner_user_id == owner_user_id)
    )
    if not owner_link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Owner cannot grant consent for this pet"},
        )

    consent = await create_consent(
        db,
        pet_id=pet_id,
        owner_user_id=owner_user_id,
        clinic_id=clinic_id,
        scope_level=scope_level,
        expires_at=expires_at,
    )
    await log_audit(
        db,
        actor_user_id=str(owner_user_id),
        clinic_id=str(clinic_id),
        action="consent.grant",
        target_type="consent",
        target_id=str(consent.id),
        metadata={"scope": scope_level.value},
    )
    await db.commit()
    await db.refresh(consent)
    return consent


async def revoke_consent(db: AsyncSession, *, owner_user_id: uuid.UUID, consent_id: uuid.UUID) -> ConsentGrant:
    consent = await get_consent(db, consent_id)
    if not consent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CONSENT_NOT_FOUND", "message": "Consent not found"},
        )
    if consent.owner_user_id != owner_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Cannot revoke this consent"},
        )

    consent.revoked_at = datetime.now(timezone.utc)
    await log_audit(
        db,
        actor_user_id=str(owner_user_id),
        clinic_id=str(consent.clinic_id),
        action="consent.revoke",
        target_type="consent",
        target_id=str(consent.id),
    )
    await db.commit()
    await db.refresh(consent)
    return consent
