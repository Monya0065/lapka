from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import AuditEvent, ConsentGrant, Document, LegalAcceptance, MasterPet, PetOwnerLink, RoleEnum, Session
from src.security.deps import require_current_legal_ack, require_roles
from src.services.audit import log_audit

router = APIRouter(
    prefix="/owner/privacy-pack",
    tags=["privacy-pack"],
    dependencies=[Depends(require_current_legal_ack)],
)


@router.get("")
async def export_owner_privacy_pack(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pet_ids = list(
        (await db.scalars(select(PetOwnerLink.pet_id).where(PetOwnerLink.owner_user_id == current_user.id))).all()
    )
    pets = (
        await db.scalars(select(MasterPet).where(MasterPet.id.in_(pet_ids)).order_by(MasterPet.created_at.desc()))
    ).all() if pet_ids else []
    docs = (
        await db.scalars(select(Document).where(Document.pet_id.in_(pet_ids)).order_by(Document.created_at.desc()).limit(300))
    ).all() if pet_ids else []
    consents = (
        await db.scalars(
            select(ConsentGrant).where(ConsentGrant.pet_id.in_(pet_ids)).order_by(ConsentGrant.issued_at.desc()).limit(300)
        )
    ).all() if pet_ids else []
    sessions = (
        await db.scalars(select(Session).where(Session.user_id == current_user.id).order_by(Session.created_at.desc()).limit(100))
    ).all()
    legal_acceptances = (
        await db.scalars(
            select(LegalAcceptance).where(LegalAcceptance.user_id == current_user.id).order_by(LegalAcceptance.accepted_at.desc()).limit(50)
        )
    ).all()
    audit_rows = (
        await db.scalars(
            select(AuditEvent)
            .where(AuditEvent.actor_user_id == str(current_user.id))
            .order_by(AuditEvent.created_at.desc())
            .limit(500)
        )
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="privacy.pack.export",
        target_type="owner",
        target_id=str(current_user.id),
        metadata={"pets": len(pets), "docs": len(docs), "consents": len(consents)},
    )
    await db.commit()

    return {
        "exported_at": datetime.now(timezone.utc),
        "owner": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        },
        "pets": [
            {"id": str(p.id), "name": p.name, "species": p.species, "breed": p.breed, "birth_date": p.birth_date}
            for p in pets
        ],
        "documents": [
            {"id": str(d.id), "pet_id": str(d.pet_id), "doc_type": d.doc_type, "created_at": d.created_at}
            for d in docs
        ],
        "consents": [
            {
                "id": str(c.id),
                "pet_id": str(c.pet_id),
                "clinic_id": str(c.clinic_id),
                "scope_level": c.scope_level.value if hasattr(c.scope_level, "value") else str(c.scope_level),
                "active": c.revoked_at is None and (c.expires_at is None or c.expires_at > datetime.now(timezone.utc)),
                "issued_at": c.issued_at,
                "expires_at": c.expires_at,
                "revoked_at": c.revoked_at,
            }
            for c in consents
        ],
        "sessions": [
            {
                "id": str(s.id),
                "created_at": s.created_at,
                "expires_at": s.expires_at,
                "revoked_at": s.revoked_at,
                "is_active": s.revoked_at is None and s.expires_at > datetime.now(timezone.utc),
            }
            for s in sessions
        ],
        "legal_acceptances": [
            {
                "id": str(a.id),
                "document_type": a.document_type,
                "version": a.version,
                "accepted_at": a.accepted_at,
                "ip_address": a.ip_address,
            }
            for a in legal_acceptances
        ],
        "audit_trail": [
            {
                "id": str(row.id),
                "actor_user_id": row.actor_user_id,
                "clinic_id": row.clinic_id,
                "action": row.action,
                "target_type": row.target_type,
                "target_id": row.target_id,
                "metadata": row.metadata_json,
                "created_at": row.created_at,
            }
            for row in audit_rows
        ],
    }

