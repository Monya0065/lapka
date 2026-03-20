from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import RoleEnum, Session, User, Membership, MembershipStatus
from src.repositories.users import create_user, get_user_by_email
from src.security.jwt import create_access_token, create_refresh_token, decode_token
from src.security.passwords import hash_password, verify_password
from src.services.audit import log_audit


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def register_owner(
    db: AsyncSession,
    *,
    email: str,
    full_name: str,
    phone: str | None,
    password: str,
) -> User:
    if await get_user_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "User with this email already exists"},
        )

    user = await create_user(
        db,
        email=email,
        full_name=full_name,
        phone=phone,
        password_hash=hash_password(password),
        role=RoleEnum.owner,
    )
    await log_audit(
        db,
        actor_user_id=str(user.id),
        clinic_id=None,
        action="auth.register",
        target_type="user",
        target_id=str(user.id),
        metadata={"role": user.role.value},
    )
    await db.commit()
    await db.refresh(user)
    return user


async def select_clinic(db: AsyncSession, *, user: User, clinic_id: uuid.UUID) -> str:
    """Return a new access token scoped to the given clinic.

    The caller must already be an active member of the clinic.
    """
    membership = await db.scalar(
        select(Membership)
        .where(
            Membership.user_id == user.id,
            Membership.clinic_id == clinic_id,
            Membership.status == MembershipStatus.active,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_MEMBER", "message": "User is not an active member of the clinic"},
        )

    # generate token with clinic claim
    token = create_access_token(subject=str(user.id), role=user.role.value, clinic_id=str(clinic_id))
    await log_audit(
        db,
        actor_user_id=str(user.id),
        clinic_id=clinic_id,
        action="auth.select_clinic",
        target_type="session",
        target_id=None,
    )
    await db.commit()
    return token


async def login(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    clinic_id: uuid.UUID | None = None,
) -> tuple[User, str, str]:
    normalized_email = (email or "").strip().lower()
    user = await get_user_by_email(db, normalized_email)
    if not user or not verify_password(password, user.password_hash):
        await log_audit(
            db,
            actor_user_id=None,
            clinic_id=None,
            action="auth.login_failed",
            target_type="session",
            target_id=None,
            metadata={"email": normalized_email[:128]},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password"},
        )

    # if a clinic is requested, verify membership
    if clinic_id is not None and user.role in (RoleEnum.vet, RoleEnum.clinic_admin):
        membership = await db.scalar(
            select(Membership)
            .where(
                Membership.user_id == user.id,
                Membership.clinic_id == clinic_id,
                Membership.status == MembershipStatus.active,
            )
        )
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "NOT_MEMBER", "message": "User is not an active member of the clinic"},
            )

    access_token = create_access_token(subject=str(user.id), role=user.role.value, clinic_id=str(clinic_id) if clinic_id else None)
    refresh_token = create_refresh_token(subject=str(user.id))

    payload = decode_token(refresh_token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=expires_at,
    )
    db.add(session)

    await log_audit(
        db,
        actor_user_id=str(user.id),
        clinic_id=clinic_id,
        action="auth.login",
        target_type="session",
        target_id=str(session.id),
    )
    await db.commit()
    return user, access_token, refresh_token


async def refresh(db: AsyncSession, *, raw_refresh_token: str) -> tuple[str, str]:
    try:
        payload = decode_token(raw_refresh_token)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Refresh token is invalid"},
        ) from exc

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Refresh token type is invalid"},
        )

    user_id = payload.get("sub")
    token_hash = hash_token(raw_refresh_token)

    session = await db.scalar(
        select(Session).where(
            Session.refresh_token_hash == token_hash,
            Session.revoked_at.is_(None),
        )
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Refresh token not found or revoked"},
        )

    if session.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_EXPIRED", "message": "Refresh token expired"},
        )

    user = await db.scalar(select(User).where(User.id == uuid.UUID(user_id), User.is_active.is_(True)))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "User not found"},
        )

    session.revoked_at = datetime.now(timezone.utc)

    new_access = create_access_token(subject=str(user.id), role=user.role.value)
    new_refresh = create_refresh_token(subject=str(user.id))
    new_payload = decode_token(new_refresh)
    new_session = Session(
        user_id=user.id,
        refresh_token_hash=hash_token(new_refresh),
        expires_at=datetime.fromtimestamp(new_payload["exp"], tz=timezone.utc),
    )
    db.add(new_session)

    await log_audit(
        db,
        actor_user_id=str(user.id),
        clinic_id=None,
        action="auth.refresh",
        target_type="session",
        target_id=str(new_session.id),
    )

    await db.commit()
    return new_access, new_refresh


async def logout(db: AsyncSession, *, user_id: uuid.UUID, raw_refresh_token: str) -> None:
    token_hash = hash_token(raw_refresh_token)
    session = await db.scalar(
        select(Session).where(
            Session.refresh_token_hash == token_hash,
            Session.user_id == user_id,
            Session.revoked_at.is_(None),
        )
    )
    if session:
        session.revoked_at = datetime.now(timezone.utc)
        await log_audit(
            db,
            actor_user_id=str(user_id),
            clinic_id=None,
            action="auth.logout",
            target_type="session",
            target_id=str(session.id),
        )
        await db.commit()
