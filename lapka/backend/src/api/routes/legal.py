from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.db.session import get_db_session
from src.models import LegalAcceptance, User
from src.security.deps import get_current_user
from src.services.audit import log_audit

router = APIRouter(prefix="/legal", tags=["legal"])


class LegalAcceptanceUpsert(BaseModel):
    document_type: str = Field(min_length=2, max_length=64)
    version: str = Field(min_length=1, max_length=64)


@router.get("/meta")
async def legal_meta() -> dict:
    settings = get_settings()
    return {
        "privacy_policy_version": settings.legal_privacy_policy_version,
        "terms_version": settings.legal_terms_version,
        "consent_version": settings.legal_consent_version,
        "dpa_version": settings.legal_dpa_version,
        "privacy_contact_email": settings.legal_contact_email,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/acceptances")
async def list_legal_acceptances(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    rows = (
        await db.execute(
            select(LegalAcceptance)
            .where(LegalAcceptance.user_id == current_user.id)
            .order_by(LegalAcceptance.accepted_at.desc())
        )
    ).scalars().all()

    latest_by_doc: dict[str, LegalAcceptance] = {}
    for row in rows:
        if row.document_type not in latest_by_doc:
            latest_by_doc[row.document_type] = row

    return [
        {
            "document_type": item.document_type,
            "version": item.version,
            "accepted_at": item.accepted_at.isoformat(),
        }
        for item in latest_by_doc.values()
    ]


@router.post("/acceptances")
async def upsert_legal_acceptance(
    payload: LegalAcceptanceUpsert,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    existing = await db.scalar(
        select(LegalAcceptance).where(
            LegalAcceptance.user_id == current_user.id,
            LegalAcceptance.document_type == payload.document_type,
            LegalAcceptance.version == payload.version,
        )
    )
    if not existing:
        existing = LegalAcceptance(
            user_id=current_user.id,
            document_type=payload.document_type.strip().lower(),
            version=payload.version.strip(),
            ip_address=(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent", "")[:512] or None,
        )
        db.add(existing)
        await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="legal.acceptance",
        target_type="legal_document",
        target_id=payload.document_type.strip().lower(),
        metadata={"version": payload.version.strip()},
    )
    await db.commit()
    await db.refresh(existing)
    return {
        "document_type": existing.document_type,
        "version": existing.version,
        "accepted_at": existing.accepted_at.isoformat(),
    }
