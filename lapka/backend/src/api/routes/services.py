import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import RoleEnum, Service
from src.security.deps import get_current_user, require_clinic_membership, require_roles
from src.services.audit import log_audit

router = APIRouter(prefix="/clinics/{clinic_id}/services", tags=["services"])


class ServiceCreateRequest(BaseModel):
    name: str = Field(min_length=2)
    duration_min: int = Field(default=30, ge=5, le=360)
    price: int = Field(default=0, ge=0)


@router.get("")
async def list_services(
    clinic_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = uuid.UUID(clinic_id)
    if current_user.role != RoleEnum.owner:
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    rows = (
        await db.scalars(
            select(Service).where(Service.clinic_id == clinic_uuid, Service.is_active.is_(True)).order_by(Service.name.asc())
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "clinic_id": str(r.clinic_id),
            "name": r.name,
            "duration_min": r.duration_min,
            "price": r.price,
        }
        for r in rows
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service(
    clinic_id: str,
    payload: ServiceCreateRequest,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = uuid.UUID(clinic_id)
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    row = Service(clinic_id=clinic_uuid, name=payload.name, duration_min=payload.duration_min, price=payload.price)
    db.add(row)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="service.create",
        target_type="service",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)

    return {
        "id": str(row.id),
        "status": "created",
    }


@router.delete("/{service_id}")
async def hide_service(
    clinic_id: str,
    service_id: str,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = uuid.UUID(clinic_id)
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    row = await db.scalar(select(Service).where(Service.id == uuid.UUID(service_id), Service.clinic_id == clinic_uuid))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Service not found"})

    row.is_active = False
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="service.hide",
        target_type="service",
        target_id=str(row.id),
    )
    await db.commit()
    return {"status": "hidden"}
