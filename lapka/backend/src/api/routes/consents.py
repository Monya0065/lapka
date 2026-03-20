import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import RoleEnum
from src.schemas.consent import ConsentCreateRequest, ConsentOut
from src.security.deps import require_roles
from src.services.consent import grant_consent, list_owner_consents, revoke_consent

router = APIRouter(prefix="/consents", tags=["consents"])


def _as_consent_out(consent) -> ConsentOut:
    return ConsentOut(
        id=str(consent.id),
        pet_id=str(consent.pet_id),
        owner_user_id=str(consent.owner_user_id),
        clinic_id=str(consent.clinic_id),
        scope_level=consent.scope_level,
        issued_at=consent.issued_at,
        expires_at=consent.expires_at,
        revoked_at=consent.revoked_at,
    )


@router.get("", response_model=list[ConsentOut])
async def list_consents(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[ConsentOut]:
    rows = await list_owner_consents(db, owner_user_id=current_user.id)
    return [_as_consent_out(row) for row in rows]


@router.post("", response_model=ConsentOut)
async def create_consent(
    payload: ConsentCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> ConsentOut:
    consent = await grant_consent(
        db,
        owner_user_id=current_user.id,
        pet_id=uuid.UUID(payload.pet_id),
        clinic_id=uuid.UUID(payload.clinic_id),
        scope_level=payload.scope_level,
        expires_at=payload.expires_at,
    )
    return _as_consent_out(consent)


@router.post("/{consent_id}/revoke", response_model=ConsentOut)
async def revoke_consent_endpoint(
    consent_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> ConsentOut:
    try:
        consent_uuid = uuid.UUID(consent_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid consent id"},
        ) from exc
    consent = await revoke_consent(db, owner_user_id=current_user.id, consent_id=consent_uuid)
    return _as_consent_out(consent)
