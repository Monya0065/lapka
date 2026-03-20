from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import ClinicalProtocol, RoleEnum
from src.security.deps import get_current_user

router = APIRouter(prefix="/protocols", tags=["clinical-protocols"])

_ALLOWED_ROLES = {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}
_ALLOWED_CATEGORIES = {
    "all",
    "general",
    "emergency",
    "gastroenterology",
    "neurology",
    "trauma",
    "anesthesia",
    "surgery",
    "toxicology",
    "inpatient",
    "diagnostics",
    "cardiology",
    "respiratory",
}
_SPECIES_ALIASES = {
    "cat": "cat",
    "cats": "cat",
    "кошка": "cat",
    "кошки": "cat",
    "кот": "cat",
    "dog": "dog",
    "dogs": "dog",
    "собака": "dog",
    "собаки": "dog",
    "пес": "dog",
    "пёс": "dog",
    "rabbit": "rabbit",
    "кролик": "rabbit",
    "кролики": "rabbit",
    "ferret": "ferret",
    "хорек": "ferret",
    "хорёк": "ferret",
    "хорьки": "ferret",
    "bird": "bird",
    "птица": "bird",
    "птицы": "bird",
}


def _assert_allowed(user) -> None:
    if user.role not in _ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Access denied"})


def _normalize_species(raw_species: str | None) -> str | None:
    if not raw_species:
        return None
    normalized = str(raw_species).strip().lower()
    if not normalized or normalized == "all":
        return None
    return _SPECIES_ALIASES.get(normalized, normalized)


def _serialize_protocol(row: ClinicalProtocol) -> dict:
    species_items = [item.strip() for item in str(row.species or "").split(",") if item.strip()]
    return {
        "id": row.id,
        "name": row.name,
        "species": species_items,
        "category": row.category,
        "description": row.description,
        "steps": row.steps_json or [],
        "emergency_flag": bool(row.emergency_flag),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("")
async def list_protocols(
    q: str | None = Query(default=None),
    species: str | None = Query(default=None),
    category: str | None = Query(default=None),
    emergency_flag: bool | None = Query(default=None),
    limit: int = Query(default=80, ge=1, le=300),
    offset: int = Query(default=0, ge=0, le=5000),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)

    query = select(ClinicalProtocol)

    if q:
        pattern = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(ClinicalProtocol.id).like(pattern),
                func.lower(ClinicalProtocol.name).like(pattern),
                func.lower(ClinicalProtocol.description).like(pattern),
                func.lower(cast(ClinicalProtocol.steps_json, Text)).like(pattern),
            )
        )

    normalized_species = _normalize_species(species)
    if normalized_species:
        query = query.where(func.lower(ClinicalProtocol.species).like(f"%{normalized_species}%"))

    if category:
        normalized_category = str(category).strip().lower()
        if normalized_category not in _ALLOWED_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_CATEGORY", "message": f"Unsupported category: {category}"},
            )
        if normalized_category != "all":
            query = query.where(ClinicalProtocol.category == normalized_category)

    if emergency_flag is not None:
        query = query.where(ClinicalProtocol.emergency_flag.is_(emergency_flag))

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = (
        await db.scalars(
            query.order_by(
                ClinicalProtocol.emergency_flag.desc(),
                ClinicalProtocol.category.asc(),
                ClinicalProtocol.name.asc(),
            )
            .offset(offset)
            .limit(limit)
        )
    ).all()

    return {
        "count": len(rows),
        "total": int(total or 0),
        "items": [_serialize_protocol(row) for row in rows],
    }


@router.get("/{protocol_id}")
async def get_protocol_by_id(
    protocol_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)
    row = await db.scalar(select(ClinicalProtocol).where(ClinicalProtocol.id == protocol_id))
    if not row:
        raise HTTPException(
            status_code=404,
            detail={"code": "PROTOCOL_NOT_FOUND", "message": "Clinical protocol not found"},
        )
    return _serialize_protocol(row)
