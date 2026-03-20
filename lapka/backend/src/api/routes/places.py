from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import Place, PlaceType
from src.security.deps import get_current_user
from src.services.audit import log_audit

router = APIRouter(prefix="/places", tags=["places"])


def _serialize_place(row: Place) -> dict:
    place_type = row.place_type.value
    if row.place_type in {PlaceType.clinic, PlaceType.emergency_clinic}:
        place_type = PlaceType.clinic.value
    return {
        "id": str(row.id),
        "name": row.name,
        "type": place_type,
        "city": row.city,
        "coordinates": {"lat": row.latitude, "lng": row.longitude},
        "address": row.address,
        "hours": row.hours,
    }


@router.get("")
async def list_places(
    type: PlaceType | None = Query(default=None),
    city: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query = select(Place)

    if type:
        if type == PlaceType.clinic:
            query = query.where(Place.place_type.in_([PlaceType.clinic, PlaceType.emergency_clinic]))
        else:
            query = query.where(Place.place_type == type)
    if city:
        query = query.where(Place.city.ilike(f"%{city.strip()}%"))
    if q:
        normalized = q.strip()
        query = query.where(
            or_(
                Place.name.ilike(f"%{normalized}%"),
                Place.city.ilike(f"%{normalized}%"),
                Place.address.ilike(f"%{normalized}%"),
            )
        )

    rows = (await db.scalars(query.order_by(Place.city.asc(), Place.name.asc()).limit(limit))).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="places.list",
        target_type="places_collection",
        target_id=None,
        metadata={"type": type.value if type else None, "city": city, "q": q},
    )
    await db.commit()
    return [_serialize_place(row) for row in rows]
