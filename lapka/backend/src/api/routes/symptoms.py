from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import RoleEnum, Symptom
from src.security.deps import get_current_user

router = APIRouter(prefix="/symptoms", tags=["symptoms"])

_ALLOWED_ROLES = {RoleEnum.owner, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}


def _assert_allowed(user) -> None:
    if user.role not in _ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Access denied"})


def _serialize_symptom(row: Symptom) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "species": row.species,
        "category": row.category,
        "severity": row.severity,
        "emergency_flag": bool(row.emergency_flag),
        "description": row.description,
    }


@router.get("")
async def list_symptoms(
    q: str | None = Query(default=None),
    species: str | None = Query(default=None),
    category: str | None = Query(default=None),
    severity: int | None = Query(default=None, ge=1, le=5),
    emergency_flag: bool | None = Query(default=None),
    limit: int = Query(default=120, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=5000),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)

    query = select(Symptom)

    if q:
        pattern = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Symptom.name).like(pattern),
                func.lower(Symptom.description).like(pattern),
                func.lower(Symptom.id).like(pattern),
            )
        )

    if species:
        query = query.where(func.lower(Symptom.species).like(f"%{species.strip().lower()}%"))

    if category:
        query = query.where(func.lower(Symptom.category) == category.strip().lower())

    if severity is not None:
        query = query.where(Symptom.severity == severity)

    if emergency_flag is not None:
        query = query.where(Symptom.emergency_flag.is_(emergency_flag))

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    rows = (
        await db.scalars(
            query.order_by(Symptom.emergency_flag.desc(), Symptom.severity.desc(), Symptom.name.asc())
            .offset(offset)
            .limit(limit)
        )
    ).all()

    return {
        "count": len(rows),
        "total": int(total or 0),
        "items": [_serialize_symptom(row) for row in rows],
    }


@router.get("/search")
async def search_symptoms_endpoint(
    q: str = Query(default="", min_length=1),
    species: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)

    payload = await list_symptoms(
        q=q,
        species=species,
        category=category,
        severity=None,
        emergency_flag=None,
        limit=limit,
        offset=0,
        current_user=current_user,
        db=db,
    )
    return payload
