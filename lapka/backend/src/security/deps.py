from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.db.session import get_db_session
from src.models import ConsentGrant, ConsentScope, LegalAcceptance, Membership, MembershipStatus, PetOwnerLink, RoleEnum, User
from src.security.jwt import TokenError, decode_token

bearer_scheme = HTTPBearer(auto_error=True)
optional_bearer_scheme = HTTPBearer(auto_error=False)

SCOPE_RANK = {
    ConsentScope.prescriptions_only: 1,
    ConsentScope.basic_medical: 2,
    ConsentScope.full_record: 3,
    ConsentScope.inpatient_view: 4,
    ConsentScope.camera_view: 5,
}


def _forbidden(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"code": "FORBIDDEN", "message": message},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid token"},
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid access token"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Token subject missing"},
        )

    user = await db.scalar(select(User).where(User.id == uuid.UUID(user_id), User.is_active.is_(True)))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "User not found"},
        )
    # attach clinic context from token, if present
    clinic_claim = payload.get("clinic_id")
    if clinic_claim:
        try:
            user.clinic_id = uuid.UUID(clinic_claim)
        except ValueError:
            user.clinic_id = None
    else:
        user.clinic_id = None
    return user


async def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: AsyncSession = Depends(get_db_session),
) -> User | None:
    if credentials is None:
        return None

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except TokenError:
        return None

    if payload.get("type") != "access":
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return await db.scalar(select(User).where(User.id == uuid.UUID(user_id), User.is_active.is_(True)))


def require_roles(*roles: RoleEnum) -> Callable[[User], User]:
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise _forbidden("Role is not allowed for this endpoint")
        return current_user

    return dependency


async def require_owner_of_pet(db: AsyncSession, *, owner_user_id: uuid.UUID, pet_id: uuid.UUID) -> None:
    link = await db.scalar(
        select(PetOwnerLink).where(PetOwnerLink.owner_user_id == owner_user_id, PetOwnerLink.pet_id == pet_id)
    )
    if not link:
        raise _forbidden("Owner has no access to this pet")


from fastapi import Query


async def get_clinic_context(
    clinic_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> str | None:
    """Resolve a clinic identifier for the current request.

    If the query parameter is omitted but the user token carries a clinic_id,
    return that value. Otherwise return whatever was supplied (possibly None).
    """
    if not clinic_id and getattr(current_user, "clinic_id", None):
        return str(current_user.clinic_id)
    return clinic_id


async def require_clinic_membership(db: AsyncSession, *, user_id: uuid.UUID, clinic_id: uuid.UUID) -> Membership:
    membership = await db.scalar(
        select(Membership).where(
            Membership.user_id == user_id,
            Membership.clinic_id == clinic_id,
            Membership.status == MembershipStatus.active,
        )
    )
    if not membership:
        raise _forbidden("No active clinic membership")
    return membership


async def require_active_consent(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    clinic_id: uuid.UUID,
    required_scope: ConsentScope,
) -> ConsentGrant:
    now = datetime.now(timezone.utc)
    grants = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.pet_id == pet_id,
                ConsentGrant.clinic_id == clinic_id,
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all()

    for grant in grants:
        if grant.expires_at and grant.expires_at <= now:
            continue
        if SCOPE_RANK[grant.scope_level] >= SCOPE_RANK[required_scope]:
            return grant

    raise _forbidden("Active consent is missing or scope is insufficient")


async def enforce_pet_scope(
    db: AsyncSession,
    *,
    current_user: User,
    pet_id: uuid.UUID,
    clinic_id: uuid.UUID | None,
    required_scope: ConsentScope,
) -> None:
    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_id)
        return

    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Role is not allowed")

    if clinic_id is None:
        raise _forbidden("Clinic context is required")

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_id)
    await require_active_consent(db, pet_id=pet_id, clinic_id=clinic_id, required_scope=required_scope)


async def require_current_legal_ack(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> None:
    """When enabled, require latest legal acceptance versions for authenticated requests."""
    settings = get_settings()
    if not settings.legal_enforcement_enabled:
        return None

    required_versions = {
        "privacy_policy": settings.legal_privacy_policy_version,
        "terms_of_service": settings.legal_terms_version,
        "consent_processing": settings.legal_consent_version,
    }
    for doc_type, version in required_versions.items():
        existing = await db.scalar(
            select(LegalAcceptance).where(
                LegalAcceptance.user_id == current_user.id,
                LegalAcceptance.document_type == doc_type,
                LegalAcceptance.version == version,
            )
        )
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={
                    "code": "LEGAL_ACK_REQUIRED",
                    "message": "Current legal acceptance is required",
                    "document_type": doc_type,
                    "required_version": version,
                },
            )
    return None
