from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_text
from src.core.rate_limit import enforce_rate_limit
from src.db.session import get_db_session
from src.models import (
    ConsentScope,
    Document,
    MasterPet,
    Prescription,
    PublicLink,
    RoleEnum,
    Visit,
)
from src.security.deps import enforce_pet_scope, get_current_user, require_roles
from src.services.audit import log_audit
from src.services.drug_marketplace import get_market_availability, resolve_drug

router = APIRouter(tags=["public-links"])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _is_expired_or_revoked(link: PublicLink) -> bool:
    now = datetime.now(timezone.utc)
    return link.revoked_at is not None or link.expires_at <= now


async def _audit_public_access(
    db: AsyncSession,
    *,
    link: PublicLink | None,
    action: str,
    request: Request,
    reason: str,
    link_type: str,
) -> None:
    await log_audit(
        db,
        actor_user_id=None,
        clinic_id=None,
        action=action,
        target_type="public_link",
        target_id=str(link.id) if link else None,
        metadata={
            "link_type": link_type,
            "reason": reason,
            "ip": request.client.host if request.client else "unknown",
            "ua": (request.headers.get("user-agent") or "")[:256],
        },
    )
    await db.commit()


class PublicPrescriptionCreateRequest(BaseModel):
    visit_id: str
    pet_id: str | None = None
    expires_in_hours: int = Field(default=24, ge=1, le=168)
    ttl_hours: int | None = Field(default=None, ge=1, le=168)


class PublicDocumentCreateRequest(BaseModel):
    document_id: str
    pet_id: str
    ttl_hours: int = Field(default=24, ge=1, le=168)


def _build_response_token(raw_token: str, expires_at: datetime, kind: str) -> dict:
    path = "/api/v1/public/prescriptions" if kind == "prescription" else "/api/v1/public/documents"
    return {
        "token": raw_token,
        "expires_at": expires_at,
        "url_path": f"{path}/{raw_token}",
        "web_path": f"/public-rx/{raw_token}" if kind == "prescription" else None,
    }


@router.get("/public-links/prescription")
async def list_prescription_links(
    visit_id: str | None = Query(default=None),
    include_expired: bool = Query(default=False),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query = select(PublicLink).where(PublicLink.link_type == "prescription")
    if visit_id:
        try:
            query = query.where(PublicLink.visit_id == uuid.UUID(visit_id))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Invalid visit_id"}) from exc
    rows = (await db.scalars(query.order_by(PublicLink.created_at.desc()).limit(100))).all()

    output: list[dict] = []
    for row in rows:
        if not row.visit_id or not row.pet_id:
            continue
        visit = await db.scalar(select(Visit).where(Visit.id == row.visit_id))
        if not visit:
            continue
        try:
            await enforce_pet_scope(
                db,
                current_user=current_user,
                pet_id=visit.pet_id,
                clinic_id=visit.clinic_id,
                required_scope=ConsentScope.prescriptions_only,
            )
        except HTTPException:
            continue
        expired = _is_expired_or_revoked(row)
        if expired and not include_expired:
            continue
        output.append(
            {
                "id": str(row.id),
                "visit_id": str(row.visit_id),
                "pet_id": str(row.pet_id),
                "expires_at": row.expires_at,
                "revoked_at": row.revoked_at,
                "created_at": row.created_at,
                "is_active": not expired,
            }
        )
    return output


@router.post("/public-links/prescription")
async def create_public_prescription_link(
    payload: PublicPrescriptionCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        visit_uuid = uuid.UUID(sanitize_text(payload.visit_id, max_len=64))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Invalid visit_id"}) from exc
    visit = await db.scalar(select(Visit).where(Visit.id == visit_uuid))
    if not visit:
        raise HTTPException(status_code=404, detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"})

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=visit.pet_id,
        clinic_id=visit.clinic_id,
        required_scope=ConsentScope.prescriptions_only,
    )

    if payload.pet_id:
        try:
            pet_id = uuid.UUID(sanitize_text(payload.pet_id, max_len=64))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Invalid pet_id"}) from exc
    else:
        pet_id = visit.pet_id
    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_id))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    ttl = payload.ttl_hours if payload.ttl_hours is not None else payload.expires_in_hours
    raw_token = secrets.token_urlsafe(24)
    row = PublicLink(
        token_hash=_hash_token(raw_token),
        link_type="prescription",
        visit_id=visit.id,
        pet_id=pet.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl),
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="public_link.create",
        target_type="public_link",
        target_id=str(row.id),
        metadata={"link_type": "prescription", "ttl_hours": ttl},
    )
    await db.commit()

    return _build_response_token(raw_token, row.expires_at, "prescription")


@router.post("/public-links/document")
async def create_public_document_link(
    payload: PublicDocumentCreateRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        doc_uuid = uuid.UUID(sanitize_text(payload.document_id, max_len=64))
        pet_uuid = uuid.UUID(sanitize_text(payload.pet_id, max_len=64))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Invalid document_id/pet_id"}) from exc

    doc = await db.scalar(select(Document).where(Document.id == doc_uuid))
    if not doc:
        raise HTTPException(status_code=404, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"})
    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=pet.id,
        clinic_id=doc.clinic_id,
        required_scope=ConsentScope.full_record,
    )

    raw_token = secrets.token_urlsafe(24)
    row = PublicLink(
        token_hash=_hash_token(raw_token),
        link_type="document",
        pet_id=pet.id,
        document_id=doc.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=payload.ttl_hours),
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(doc.clinic_id),
        action="public_link.create",
        target_type="public_link",
        target_id=str(row.id),
        metadata={"link_type": "document", "ttl_hours": payload.ttl_hours},
    )
    await db.commit()

    return _build_response_token(raw_token, row.expires_at, "document")


@router.post("/public-links/{token}/revoke")
async def revoke_public_link(
    token: str,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(PublicLink).where(PublicLink.token_hash == _hash_token(token)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "LINK_NOT_FOUND", "message": "Public link not found"})

    row.revoked_at = datetime.now(timezone.utc)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="public_link.revoke",
        target_type="public_link",
        target_id=str(row.id),
    )
    await db.commit()
    return {"status": "revoked"}


@router.post("/public-links/id/{link_id}/revoke")
async def revoke_public_link_by_id(
    link_id: str,
    current_user=Depends(require_roles(RoleEnum.owner, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        link_uuid = uuid.UUID(link_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Invalid link id"}) from exc

    row = await db.scalar(select(PublicLink).where(PublicLink.id == link_uuid))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "LINK_NOT_FOUND", "message": "Public link not found"})

    if row.pet_id is None:
        raise HTTPException(status_code=404, detail={"code": "LINK_TARGET_MISSING", "message": "Link target missing"})

    clinic_id = None
    if row.visit_id:
        visit = await db.scalar(select(Visit).where(Visit.id == row.visit_id))
        if visit:
            clinic_id = visit.clinic_id
    elif row.document_id:
        document = await db.scalar(select(Document).where(Document.id == row.document_id))
        if document:
            clinic_id = document.clinic_id

    if clinic_id is not None:
        required_scope = ConsentScope.prescriptions_only if row.link_type == "prescription" else ConsentScope.full_record
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=row.pet_id,
            clinic_id=clinic_id,
            required_scope=required_scope,
        )

    row.revoked_at = datetime.now(timezone.utc)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_id) if clinic_id else None,
        action="public_link.revoke",
        target_type="public_link",
        target_id=str(row.id),
        metadata={"via": "id"},
    )
    await db.commit()
    return {"status": "revoked", "id": str(row.id)}


@router.get("/public/prescriptions/{token}")
async def fetch_public_prescription(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    enforce_rate_limit(request, scope="public.prescriptions", limit=120, window_sec=60)
    token_hash = _hash_token(token)
    link = await db.scalar(
        select(PublicLink).where(PublicLink.token_hash == token_hash, PublicLink.link_type == "prescription")
    )
    if not link:
        await _audit_public_access(
            db,
            link=None,
            action="public_link.view_denied",
            request=request,
            reason="not_found",
            link_type="prescription",
        )
        raise HTTPException(status_code=404, detail={"code": "LINK_NOT_FOUND", "message": "Public link not found"})
    if _is_expired_or_revoked(link):
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="expired_or_revoked",
            link_type="prescription",
        )
        raise HTTPException(status_code=410, detail={"code": "LINK_EXPIRED", "message": "Public link expired or revoked"})
    if not link.visit_id or not link.pet_id:
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="target_missing",
            link_type="prescription",
        )
        raise HTTPException(status_code=404, detail={"code": "LINK_TARGET_MISSING", "message": "Public link target not found"})

    visit = await db.scalar(select(Visit).where(Visit.id == link.visit_id))
    if not visit:
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="visit_missing",
            link_type="prescription",
        )
        raise HTTPException(status_code=404, detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"})
    pet = await db.scalar(select(MasterPet).where(MasterPet.id == link.pet_id))
    if not pet:
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="pet_missing",
            link_type="prescription",
        )
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    prescriptions = (
        await db.scalars(select(Prescription).where(Prescription.visit_id == link.visit_id).order_by(Prescription.created_at))
    ).all()

    medications: list[dict] = []
    for rx in prescriptions:
        forms: list[str] = []
        where_to_buy = {"online": [], "offline": []}

        drug = await resolve_drug(db, identifier=rx.drug_name)
        if drug:
            forms = list(drug.forms_json or [])
            availability = await get_market_availability(db, drug_id=drug.id, city="Санкт-Петербург")
            where_to_buy["online"] = list((availability.get("online") or [])[:2])
            where_to_buy["offline"] = list((availability.get("offline") or [])[:3])

        medications.append(
            {
                "id": str(rx.id),
                "medication_name": rx.drug_name,
                "forms": forms,
                "prescription_required": rx.prescription_required,
                "where_to_buy": where_to_buy,
            }
        )

    await log_audit(
        db,
        actor_user_id=None,
        clinic_id=str(visit.clinic_id),
        action="public_link.view",
        target_type="public_link",
        target_id=str(link.id),
        metadata={
            "link_type": "prescription",
            "token_tail": token[-6:],
            "ip": request.client.host if request.client else "unknown",
            "ua": request.headers.get("user-agent", "")[:256],
        },
    )
    await db.commit()

    return {
        "pet_name": pet.name,
        "visit_id": str(visit.id),
        "expires_at": link.expires_at,
        "medications": medications,
        "safety_disclaimer": "Information only. Consult a veterinarian for medical decisions.",
    }


@router.get("/public/documents/{token}")
async def fetch_public_document(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    enforce_rate_limit(request, scope="public.documents", limit=80, window_sec=60)
    token_hash = _hash_token(token)
    link = await db.scalar(select(PublicLink).where(PublicLink.token_hash == token_hash, PublicLink.link_type == "document"))
    if not link:
        await _audit_public_access(
            db,
            link=None,
            action="public_link.view_denied",
            request=request,
            reason="not_found",
            link_type="document",
        )
        raise HTTPException(status_code=404, detail={"code": "LINK_NOT_FOUND", "message": "Public link not found"})
    if _is_expired_or_revoked(link):
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="expired_or_revoked",
            link_type="document",
        )
        raise HTTPException(status_code=410, detail={"code": "LINK_EXPIRED", "message": "Public link expired or revoked"})
    if not link.document_id or not link.pet_id:
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="target_missing",
            link_type="document",
        )
        raise HTTPException(status_code=404, detail={"code": "LINK_TARGET_MISSING", "message": "Public link target not found"})

    doc = await db.scalar(select(Document).where(Document.id == link.document_id))
    pet = await db.scalar(select(MasterPet).where(MasterPet.id == link.pet_id))
    if not doc or not pet:
        await _audit_public_access(
            db,
            link=link,
            action="public_link.view_denied",
            request=request,
            reason="document_or_pet_missing",
            link_type="document",
        )
        raise HTTPException(status_code=404, detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"})

    await log_audit(
        db,
        actor_user_id=None,
        clinic_id=str(doc.clinic_id),
        action="public_link.view",
        target_type="public_link",
        target_id=str(link.id),
        metadata={
            "link_type": "document",
            "token_tail": token[-6:],
            "ip": request.client.host if request.client else "unknown",
            "ua": request.headers.get("user-agent", "")[:256],
        },
    )
    await db.commit()

    return {
        "pet_name": pet.name,
        "document": {
            "id": str(doc.id),
            "doc_type": doc.doc_type,
            "created_at": doc.created_at,
        },
        "warning": "Public access is limited to one document. Contact clinic for full medical history.",
    }
