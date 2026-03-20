from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Text, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import Disease, RoleEnum
from src.security.deps import get_current_user

router = APIRouter(prefix="/diseases", tags=["diseases"])

_ALLOWED_ROLES = {RoleEnum.owner, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}
_ALLOWED_CATEGORIES = {
    "dermatology",
    "gastroenterology",
    "neurology",
    "cardiology",
    "infectious",
    "trauma",
    "toxicology",
    "respiratory",
    "urinary",
    "endocrine",
    "ophthalmology",
}
_SPECIES_ALIASES = {
    "cat": "cat",
    "cats": "cat",
    "кошка": "cat",
    "кошки": "cat",
    "dog": "dog",
    "dogs": "dog",
    "собака": "dog",
    "собаки": "dog",
    "rabbit": "rabbit",
    "кролик": "rabbit",
    "кролики": "rabbit",
    "ferret": "ferret",
    "хорек": "ferret",
    "хорьки": "ferret",
    "bird": "bird",
    "птицы": "bird",
}


def _assert_allowed(user) -> None:
    if user.role not in _ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Access denied"})


def _serialize_disease(row: Disease) -> dict:
    species_items = [item.strip() for item in str(row.species or "").split(",") if item.strip()]
    return {
        "id": row.id,
        "name": row.name,
        "species": species_items,
        "category": row.category,
        "symptoms": row.symptoms_json or [],
        "description": row.description,
        "emergency_level": row.emergency_level,
        "prevalence": row.prevalence,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _normalize_species_query(raw_species: str) -> str:
    normalized = str(raw_species or "").strip().lower()
    return _SPECIES_ALIASES.get(normalized, normalized)


@router.get("")
async def list_diseases(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    species: str | None = Query(default=None),
    emergency_level: str | None = Query(default=None, pattern="^(GREEN|YELLOW|RED)$"),
    limit: int = Query(default=80, ge=1, le=250),
    offset: int = Query(default=0, ge=0, le=5000),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)

    query = select(Disease)

    if q:
        search = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Disease.name).like(search),
                func.lower(Disease.description).like(search),
                func.lower(Disease.id).like(search),
                func.lower(cast(Disease.symptoms_json, Text)).like(search),
            )
        )

    if category:
        normalized = category.strip().lower()
        if normalized != "all":
            if normalized not in _ALLOWED_CATEGORIES:
                raise HTTPException(
                    status_code=422,
                    detail={"code": "INVALID_CATEGORY", "message": f"Unsupported category: {category}"},
                )
            query = query.where(Disease.category == normalized)

    if species:
        normalized_species = _normalize_species_query(species)
        if normalized_species != "all":
            query = query.where(func.lower(Disease.species).like(f"%{normalized_species}%"))

    if emergency_level:
        query = query.where(Disease.emergency_level == emergency_level)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = (
        await db.scalars(
            query.order_by(Disease.emergency_level.desc(), Disease.name.asc())
            .offset(offset)
            .limit(limit)
        )
    ).all()

    return {
        "count": len(rows),
        "total": int(total or 0),
        "items": [_serialize_disease(row) for row in rows],
    }


@router.get("/search")
async def search_diseases_endpoint(
    q: str = Query(default="", min_length=1),
    category: str | None = Query(default=None),
    species: str | None = Query(default=None),
    limit: int = Query(default=40, ge=1, le=120),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)
    payload = await list_diseases(
        q=q,
        category=category,
        species=species,
        emergency_level=None,
        limit=limit,
        offset=0,
        current_user=current_user,
        db=db,
    )
    return payload


@router.get("/{disease_id}")
async def get_disease_by_id(
    disease_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _assert_allowed(current_user)
    row = await db.scalar(select(Disease).where(Disease.id == disease_id))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "DISEASE_NOT_FOUND", "message": "Disease not found"})
    return _serialize_disease(row)
