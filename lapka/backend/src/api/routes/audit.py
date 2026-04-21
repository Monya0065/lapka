import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import AuditEvent, Document, InpatientStay, PetOwnerLink, RoleEnum, Visit
from src.security.deps import get_current_user, require_roles

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def list_audit(
    limit: int = 50,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(min(limit, 200))
    if current_user.role == RoleEnum.clinic_admin:
        clinic_id = getattr(current_user, "clinic_id", None)
        if clinic_id is None:
            return []
        stmt = stmt.where(AuditEvent.clinic_id == clinic_id)
    rows = (await db.scalars(stmt)).all()
    return [
        {
            "id": str(row.id),
            "actor_user_id": str(row.actor_user_id) if row.actor_user_id else None,
            "clinic_id": str(row.clinic_id) if row.clinic_id else None,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.get("/owner-view")
async def owner_privacy_view(
    limit: int = 200,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    pet_ids = set((await db.scalars(select(PetOwnerLink.pet_id).where(PetOwnerLink.owner_user_id == current_user.id))).all())
    if not pet_ids:
        return []
    pet_id_str = {str(pid) for pid in pet_ids}

    rows = (
        await db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(min(limit, 500)))
    ).all()

    visit_pet_map: dict[str, str] = {}
    doc_pet_map: dict[str, str] = {}
    stay_pet_map: dict[str, str] = {}

    filtered = []
    for row in rows:
        if row.target_type == "pet":
            if row.target_id and row.target_id in pet_id_str:
                filtered.append(row)
            continue

        if row.target_type == "visit" and row.target_id:
            if row.target_id not in visit_pet_map:
                try:
                    visit_id = uuid.UUID(row.target_id)
                except (TypeError, ValueError):
                    visit_id = None
                visit = await db.scalar(select(Visit).where(Visit.id == visit_id)) if visit_id else None
                visit_pet_map[row.target_id] = str(visit.pet_id) if visit else ""
            if visit_pet_map[row.target_id] in pet_id_str:
                filtered.append(row)
            continue

        if row.target_type == "document" and row.target_id:
            if row.target_id not in doc_pet_map:
                try:
                    doc_id = uuid.UUID(row.target_id)
                except (TypeError, ValueError):
                    doc_id = None
                doc = await db.scalar(select(Document).where(Document.id == doc_id)) if doc_id else None
                doc_pet_map[row.target_id] = str(doc.pet_id) if doc else ""
            if doc_pet_map[row.target_id] in pet_id_str:
                filtered.append(row)
            continue

        if row.target_type == "inpatient_stay" and row.target_id:
            if row.target_id not in stay_pet_map:
                try:
                    stay_id = uuid.UUID(row.target_id)
                except (TypeError, ValueError):
                    stay_id = None
                stay = await db.scalar(select(InpatientStay).where(InpatientStay.id == stay_id)) if stay_id else None
                stay_pet_map[row.target_id] = str(stay.pet_id) if stay else ""
            if stay_pet_map[row.target_id] in pet_id_str:
                filtered.append(row)

    return [
        {
            "id": str(row.id),
            "actor_user_id": str(row.actor_user_id) if row.actor_user_id else None,
            "clinic_id": str(row.clinic_id) if row.clinic_id else None,
            "action": row.action,
            "target_type": row.target_type,
            "target_id": row.target_id,
            "created_at": row.created_at,
        }
        for row in filtered
    ]
