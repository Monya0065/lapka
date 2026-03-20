from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_text
from src.db.session import get_db_session
from src.models import (
    Clinic,
    ConsentGrant,
    ConsentRequest,
    ConsentRequestStatus,
    ConsentScope,
    MasterPet,
    Membership,
    MembershipStatus,
    PetOwnerLink,
    PetQrToken,
    RoleEnum,
    User,
)
from src.security.deps import get_clinic_context, get_current_user, require_clinic_membership, require_roles
from src.services.audit import log_audit
from src.services.consent import grant_consent

router = APIRouter(tags=["patient-search"])

CONSENT_SCOPE_RANK = {
    ConsentScope.prescriptions_only: 1,
    ConsentScope.basic_medical: 2,
    ConsentScope.full_record: 3,
    ConsentScope.inpatient_view: 4,
    ConsentScope.camera_view: 5,
}


class ConsentRequestCreate(BaseModel):
    master_pet_id: str
    clinic_id: str
    message: str | None = Field(default=None, max_length=500)
    requested_scope: ConsentScope = ConsentScope.basic_medical


class ConsentRequestDecision(BaseModel):
    decision_note: str | None = Field(default=None, max_length=500)
    scope_level: ConsentScope | None = None


class QrCheckinRequest(BaseModel):
    token: str = Field(min_length=8, max_length=255)
    clinic_id: str | None = None


_SEARCH_RATE_STATE: dict[str, dict] = {}


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _mask_name(value: str | None) -> str:
    if not value:
        return "Скрыто"
    cleaned = value.strip()
    if not cleaned:
        return "Скрыто"
    if len(cleaned) <= 2:
        return f"{cleaned[0]}*"
    return f"{cleaned[0]}***"


def _parse_uuid(raw: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": f"Invalid {field_name} format"},
        ) from exc


async def _resolve_clinic_context(
    db: AsyncSession,
    *,
    current_user,
    clinic_id: str | None,
) -> uuid.UUID:
    if clinic_id:
        clinic_uuid = _parse_uuid(clinic_id, "clinic_id") if clinic_id else None
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
        return clinic_uuid

    membership = await db.scalar(
        select(Membership)
        .where(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.active,
        )
        .order_by(Membership.created_at.asc())
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "No active clinic membership"},
        )
    return membership.clinic_id


def _enforce_search_rate_limit(*, actor_id: str, mode: str, query_text: str) -> None:
    now_ts = datetime.now(timezone.utc).timestamp()
    window_sec = 60
    max_requests = 80
    max_distinct_queries = 40

    state = _SEARCH_RATE_STATE.get(actor_id)
    if not state or now_ts - state["window_start"] > window_sec:
        state = {
            "window_start": now_ts,
            "count": 0,
            "misses": 0,
            "queries": set(),
        }
        _SEARCH_RATE_STATE[actor_id] = state

    query_key = f"{mode}:{query_text.strip().lower()}"
    state["count"] += 1
    state["queries"].add(query_key)

    if state["count"] > max_requests or len(state["queries"]) > max_distinct_queries:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": "Too many search requests. Please wait and retry."},
        )


def _register_search_outcome(*, actor_id: str, had_hits: bool) -> None:
    state = _SEARCH_RATE_STATE.get(actor_id)
    if not state:
        return
    if had_hits:
        state["misses"] = max(0, state["misses"] - 1)
    else:
        state["misses"] += 1

    if state["count"] >= 24 and state["misses"] >= 16:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "SEARCH_THROTTLED", "message": "Search throttled due to suspicious enumeration pattern"},
        )


def _effective_scope_for_pet(
    grants: list[ConsentGrant],
    *,
    pet_id: uuid.UUID,
) -> ConsentScope | None:
    active_scope: ConsentScope | None = None
    now = datetime.now(timezone.utc)
    for grant in grants:
        if grant.pet_id != pet_id:
            continue
        if grant.revoked_at is not None:
            continue
        if grant.expires_at and grant.expires_at <= now:
            continue
        if not active_scope or CONSENT_SCOPE_RANK[grant.scope_level] > CONSENT_SCOPE_RANK[active_scope]:
            active_scope = grant.scope_level
    return active_scope


def _safe_masked_result(pet: MasterPet) -> dict:
    return {
        "pet_id": str(pet.id),
        "lapka_id": pet.lapka_id,
        "pet_name": _mask_name(pet.name),
        "species": pet.species,
        "breed": pet.breed,
        "consent_status": "none",
        "action_required": "request_consent",
        "owner_name": "Owner: hidden",
        "owner_email": None,
        "owner_phone": None,
        "consent_scope": None,
    }


def _safe_allowed_result(pet: MasterPet, owner: User | None, scope: ConsentScope) -> dict:
    return {
        "pet_id": str(pet.id),
        "lapka_id": pet.lapka_id,
        "pet_name": pet.name,
        "species": pet.species,
        "breed": pet.breed,
        "chip_id": pet.chip_id,
        "passport_id": pet.passport_id,
        "sex": pet.sex,
        "birth_date": pet.birth_date,
        "consent_status": "active",
        "action_required": None,
        "consent_scope": scope.value,
        "owner_name": owner.full_name if owner else None,
        "owner_email": owner.email if owner else None,
        "owner_phone": owner.phone if owner else None,
    }


@router.get("/owner/search/pets")
async def owner_search_pets(
    q: str = Query(default="", max_length=128),
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query_text = sanitize_text(q, max_len=128)
    pet_links = (
        await db.scalars(select(PetOwnerLink.pet_id).where(PetOwnerLink.owner_user_id == current_user.id))
    ).all()
    if not pet_links:
        return []

    statement = select(MasterPet).where(MasterPet.id.in_(list(pet_links))).order_by(MasterPet.name.asc())
    if query_text:
        statement = statement.where(
            or_(
                MasterPet.name.ilike(f"%{query_text}%"),
                MasterPet.chip_id.ilike(f"%{query_text}%"),
                MasterPet.passport_id.ilike(f"%{query_text}%"),
                MasterPet.lapka_id.ilike(f"%{query_text}%"),
            )
        )

    rows = (await db.scalars(statement.limit(80))).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="search.owner.pets",
        target_type="pet_collection",
        target_id=None,
        metadata={"query": query_text, "hits": len(rows)},
    )
    await db.commit()
    return [
        {
            "pet_id": str(p.id),
            "lapka_id": p.lapka_id,
            "pet_name": p.name,
            "species": p.species,
            "breed": p.breed,
            "sex": p.sex,
            "birth_date": p.birth_date,
            "chip_id": p.chip_id,
            "passport_id": p.passport_id,
        }
        for p in rows
    ]


@router.get("/clinic/search/patients")
async def clinic_search_patients(
    q: str = Query(..., min_length=1, max_length=128),
    mode: Literal["name", "owner_phone", "owner_email", "chip_id", "lapka_id"] = Query(default="name"),
    clinic_id: str | None = Depends(get_clinic_context),
    limit: int = Query(default=20, ge=1, le=100),
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query_text = sanitize_text(q, max_len=128)
    if mode == "name" and len(query_text) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Name search requires at least 3 characters"},
        )
    if mode == "owner_phone" and len(query_text) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Phone search requires at least 4 characters"},
        )
    if mode == "owner_email" and len(query_text) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Email search requires at least 5 characters"},
        )

    _enforce_search_rate_limit(actor_id=str(current_user.id), mode=mode, query_text=query_text)

    clinic_uuid = await _resolve_clinic_context(db, current_user=current_user, clinic_id=clinic_id)

    if mode in {"owner_phone", "owner_email"}:
        contact_clause = User.phone if mode == "owner_phone" else User.email
        candidate_rows = (
            await db.execute(
                select(MasterPet, User)
                .join(PetOwnerLink, PetOwnerLink.pet_id == MasterPet.id)
                .join(User, User.id == PetOwnerLink.owner_user_id)
                .where(contact_clause.ilike(f"%{query_text}%"))
                .order_by(MasterPet.name.asc())
                .limit(limit)
            )
        ).all()
        pets = [row[0] for row in candidate_rows]
        owner_by_pet = {row[0].id: row[1] for row in candidate_rows}
    else:
        statement = select(MasterPet)
        if mode == "chip_id":
            statement = statement.where(MasterPet.chip_id.ilike(f"%{query_text}%"))
        elif mode == "lapka_id":
            statement = statement.where(MasterPet.lapka_id.ilike(f"%{query_text}%"))
        else:
            statement = statement.where(MasterPet.name.ilike(f"%{query_text}%"))

        pets = (await db.scalars(statement.order_by(MasterPet.name.asc()).limit(limit))).all()
        owner_links = (
            await db.execute(
                select(PetOwnerLink, User)
                .join(User, User.id == PetOwnerLink.owner_user_id)
                .where(PetOwnerLink.pet_id.in_([pet.id for pet in pets]))
            )
        ).all() if pets else []
        owner_by_pet = {row[0].pet_id: row[1] for row in owner_links}

    pet_ids = [pet.id for pet in pets]
    grants = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.clinic_id == clinic_uuid,
                ConsentGrant.pet_id.in_(pet_ids) if pet_ids else False,
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all() if pet_ids else []

    results = []
    masked_count = 0
    for pet in pets:
        scope = _effective_scope_for_pet(grants, pet_id=pet.id)
        owner = owner_by_pet.get(pet.id)
        if scope is None:
            masked_count += 1
            results.append(_safe_masked_result(pet))
        else:
            results.append(_safe_allowed_result(pet, owner, scope))

    _register_search_outcome(actor_id=str(current_user.id), had_hits=bool(results))

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="search.clinic.patients",
        target_type="patient_search",
        target_id=None,
        metadata={
            "mode": mode,
            "query": query_text,
            "hits": len(results),
            "masked": masked_count,
        },
    )
    await db.commit()

    return results


@router.post("/consent-requests", status_code=status.HTTP_201_CREATED)
async def create_consent_request(
    payload: ConsentRequestCreate,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = _parse_uuid(payload.clinic_id, "clinic_id")
    pet_uuid = _parse_uuid(payload.master_pet_id, "master_pet_id")

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    existing_pending = await db.scalar(
        select(ConsentRequest).where(
            ConsentRequest.pet_id == pet_uuid,
            ConsentRequest.clinic_id == clinic_uuid,
            ConsentRequest.status == ConsentRequestStatus.pending,
        )
    )
    if existing_pending:
        return {
            "id": str(existing_pending.id),
            "status": existing_pending.status.value,
            "pet_id": str(existing_pending.pet_id),
            "clinic_id": str(existing_pending.clinic_id),
            "requested_scope": existing_pending.requested_scope.value,
            "message": existing_pending.message,
            "created_at": existing_pending.created_at,
        }

    row = ConsentRequest(
        pet_id=pet_uuid,
        clinic_id=clinic_uuid,
        requested_by_user_id=current_user.id,
        requested_scope=payload.requested_scope,
        message=sanitize_text(payload.message, max_len=500) if payload.message else None,
        status=ConsentRequestStatus.pending,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="consent_request.create",
        target_type="consent_request",
        target_id=str(row.id),
        metadata={"pet_id": str(pet_uuid), "requested_scope": payload.requested_scope.value},
    )
    await db.commit()
    return {
        "id": str(row.id),
        "status": row.status.value,
        "pet_id": str(row.pet_id),
        "clinic_id": str(row.clinic_id),
        "requested_scope": row.requested_scope.value,
        "message": row.message,
        "created_at": row.created_at,
    }


@router.get("/owner/requests")
async def owner_consent_requests(
    status_filter: Literal["pending", "approved", "rejected", "cancelled"] | None = None,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    statement = (
        select(ConsentRequest, MasterPet, Clinic, User)
        .join(MasterPet, MasterPet.id == ConsentRequest.pet_id)
        .join(Clinic, Clinic.id == ConsentRequest.clinic_id)
        .join(User, User.id == ConsentRequest.requested_by_user_id)
        .join(PetOwnerLink, PetOwnerLink.pet_id == ConsentRequest.pet_id)
        .where(PetOwnerLink.owner_user_id == current_user.id)
        .order_by(ConsentRequest.created_at.desc())
    )
    if status_filter:
        statement = statement.where(ConsentRequest.status == ConsentRequestStatus(status_filter))

    rows = (await db.execute(statement.limit(300))).all()

    return [
        {
            "id": str(req.id),
            "status": req.status.value,
            "requested_scope": req.requested_scope.value,
            "message": req.message,
            "decision_note": req.decision_note,
            "created_at": req.created_at,
            "resolved_at": req.resolved_at,
            "pet": {
                "id": str(pet.id),
                "name": pet.name,
                "lapka_id": pet.lapka_id,
                "species": pet.species,
            },
            "clinic": {
                "id": str(clinic.id),
                "name": clinic.name,
            },
            "requested_by": {
                "id": str(requested_by.id),
                "name": requested_by.full_name,
                "role": requested_by.role.value,
            },
        }
        for req, pet, clinic, requested_by in rows
    ]


@router.post("/owner/requests/{request_id}/approve")
async def approve_owner_request(
    request_id: str,
    payload: ConsentRequestDecision,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    request_uuid = _parse_uuid(request_id, "request_id")

    row = await db.scalar(select(ConsentRequest).where(ConsentRequest.id == request_uuid))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Consent request not found"})
    if row.status != ConsentRequestStatus.pending:
        raise HTTPException(status_code=409, detail={"code": "INVALID_STATE", "message": "Request already resolved"})

    owner_link = await db.scalar(
        select(PetOwnerLink).where(PetOwnerLink.pet_id == row.pet_id, PetOwnerLink.owner_user_id == current_user.id)
    )
    if not owner_link:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "No access to request"})

    requested_scope = payload.scope_level or row.requested_scope

    existing_grants = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.pet_id == row.pet_id,
                ConsentGrant.clinic_id == row.clinic_id,
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all()

    has_scope = False
    now = datetime.now(timezone.utc)
    for grant in existing_grants:
        if grant.expires_at and grant.expires_at <= now:
            continue
        if CONSENT_SCOPE_RANK[grant.scope_level] >= CONSENT_SCOPE_RANK[requested_scope]:
            has_scope = True
            break

    if not has_scope:
        await grant_consent(
            db,
            owner_user_id=current_user.id,
            pet_id=row.pet_id,
            clinic_id=row.clinic_id,
            scope_level=requested_scope,
            expires_at=None,
        )

    row.status = ConsentRequestStatus.approved
    row.decision_note = sanitize_text(payload.decision_note, max_len=500) if payload.decision_note else None
    row.resolved_at = datetime.now(timezone.utc)
    row.resolved_by_user_id = current_user.id

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="consent_request.approve",
        target_type="consent_request",
        target_id=str(row.id),
        metadata={"scope": requested_scope.value},
    )
    await db.commit()

    return {
        "id": str(row.id),
        "status": row.status.value,
        "pet_id": str(row.pet_id),
        "clinic_id": str(row.clinic_id),
        "requested_scope": requested_scope.value,
    }


@router.post("/owner/requests/{request_id}/reject")
async def reject_owner_request(
    request_id: str,
    payload: ConsentRequestDecision,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    request_uuid = _parse_uuid(request_id, "request_id")

    row = await db.scalar(select(ConsentRequest).where(ConsentRequest.id == request_uuid))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Consent request not found"})
    if row.status != ConsentRequestStatus.pending:
        raise HTTPException(status_code=409, detail={"code": "INVALID_STATE", "message": "Request already resolved"})

    owner_link = await db.scalar(
        select(PetOwnerLink).where(PetOwnerLink.pet_id == row.pet_id, PetOwnerLink.owner_user_id == current_user.id)
    )
    if not owner_link:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "No access to request"})

    row.status = ConsentRequestStatus.rejected
    row.decision_note = sanitize_text(payload.decision_note, max_len=500) if payload.decision_note else None
    row.resolved_at = datetime.now(timezone.utc)
    row.resolved_by_user_id = current_user.id

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="consent_request.reject",
        target_type="consent_request",
        target_id=str(row.id),
    )
    await db.commit()

    return {
        "id": str(row.id),
        "status": row.status.value,
        "pet_id": str(row.pet_id),
        "clinic_id": str(row.clinic_id),
    }


@router.post("/clinic/checkin/qr")
async def clinic_checkin_by_qr(
    payload: QrCheckinRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = await _resolve_clinic_context(db, current_user=current_user, clinic_id=payload.clinic_id)
    now = datetime.now(timezone.utc)

    token_hash = _hash_token(payload.token.strip())
    qr = await db.scalar(select(PetQrToken).where(PetQrToken.token_hash == token_hash))
    if not qr or qr.revoked_at is not None or (qr.expires_at and qr.expires_at <= now):
        await log_audit(
            db,
            actor_user_id=str(current_user.id),
            clinic_id=str(clinic_uuid),
            action="checkin.qr.failed",
            target_type="pet_qr_token",
            target_id=None,
            metadata={"token_tail": payload.token.strip()[-6:]},
        )
        await db.commit()
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "QR token is invalid"})

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == qr.pet_id))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    grants = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.pet_id == pet.id,
                ConsentGrant.clinic_id == clinic_uuid,
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all()
    scope = _effective_scope_for_pet(grants, pet_id=pet.id)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="checkin.qr.success",
        target_type="pet",
        target_id=str(pet.id),
        metadata={"token_tail": payload.token.strip()[-6:], "consent": scope.value if scope else "none"},
    )
    await db.commit()

    return {
        "pet": {
            "pet_id": str(pet.id),
            "lapka_id": pet.lapka_id,
            "pet_name": pet.name,
            "species": pet.species,
            "breed": pet.breed,
        },
        "owner": {
            "display": "Owner: hidden" if scope is None else "Owner: consent granted",
        },
        "consent_status": "active" if scope else "none",
        "consent_scope": scope.value if scope else None,
        "action_required": None if scope else "request_consent",
        "can_create_appointment_draft": True,
    }
