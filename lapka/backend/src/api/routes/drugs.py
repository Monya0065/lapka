from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.db.session import get_db_session
from src.models import RoleEnum
from src.security.deps import get_current_user
from src.services.audit import log_audit
from src.services.drug_marketplace import (
    create_or_update_shopping_item,
    get_market_analogs,
    get_market_availability,
    get_market_drug_by_id,
    list_owner_shopping_items,
    log_availability_query,
    resolve_drug,
    search_market_drugs,
)

router = APIRouter(tags=["drugs"])
_settings = get_settings()
_availability_windows: dict[str, deque[float]] = defaultdict(deque)


class ShoppingListItemRequest(BaseModel):
    drug_id: str
    variant_id: str | None = None
    quantity: int = Field(default=1, ge=1, le=50)
    notes: str | None = Field(default=None, max_length=255)


class AvailabilityTrackRequest(BaseModel):
    drug_id: str | None = None
    city: str | None = Field(default=None, max_length=128)
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = Field(default=None, ge=0.5, le=100)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "BAD_REQUEST", "message": message},
    )


def _as_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise _bad_request(f"Invalid {field_name} format") from exc


def _ensure_catalog_role(current_user) -> None:
    if current_user.role not in {RoleEnum.owner, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role cannot access drug marketplace"},
        )


def _enforce_availability_rate_limit(user_id: uuid.UUID) -> None:
    now = time.monotonic()
    window = _availability_windows[str(user_id)]
    horizon = now - max(5, _settings.pharmacy_availability_window_sec)
    while window and window[0] < horizon:
        window.popleft()
    if len(window) >= max(5, _settings.pharmacy_availability_rate_limit):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": "Too many availability requests. Try again later."},
        )
    window.append(now)


@router.get("/drugs")
async def list_drugs(
    q: str | None = Query(default=None),
    species: str | None = Query(default=None),
    form: str | None = Query(default=None),
    prescription_required: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_catalog_role(current_user)
    return await search_market_drugs(
        db,
        q=q,
        species=species,
        form=form,
        prescription_required=prescription_required,
        page=page,
        limit=limit,
    )


@router.get("/drugs/{drug_id}")
async def get_drug_details(
    drug_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_catalog_role(current_user)
    payload = await get_market_drug_by_id(
        db,
        drug_id=drug_id,
        user_role=current_user.role,
    )
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DRUG_NOT_FOUND", "message": "Drug not found in catalog"},
        )

    if current_user.role in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        await log_audit(
            db,
            actor_user_id=str(current_user.id),
            clinic_id=None,
            action="drug.view",
            target_type="drug",
            target_id=str(payload["id"]),
        )
        await db.commit()

    return payload


@router.get("/drugs/{drug_id}/analogs")
async def get_drug_analogs(
    drug_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_catalog_role(current_user)
    return await get_market_analogs(db, drug_id=drug_id)


@router.get("/drugs/{drug_id}/availability")
async def get_drug_availability(
    drug_id: str,
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    city: str | None = Query(default=None),
    radius_km: float | None = Query(default=None, ge=0.5, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_catalog_role(current_user)
    _enforce_availability_rate_limit(current_user.id)

    base_drug = await resolve_drug(db, identifier=drug_id)
    if not base_drug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DRUG_NOT_FOUND", "message": "Drug not found in catalog"},
        )

    payload = await get_market_availability(
        db,
        drug_id=base_drug.id,
        lat=lat,
        lng=lng,
        city=city,
        radius_km=radius_km,
    )
    await log_availability_query(
        db,
        user_id=current_user.id,
        role=current_user.role.value,
        drug_id=base_drug.id,
        city=city,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
    )
    await db.commit()
    return payload


@router.post("/owner/shopping-list", status_code=status.HTTP_201_CREATED)
async def add_to_owner_shopping_list(
    payload: ShoppingListItemRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only owner can edit shopping list"},
        )

    base_drug = await resolve_drug(db, identifier=payload.drug_id)
    if not base_drug:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DRUG_NOT_FOUND", "message": "Drug not found in catalog"},
        )
    variant_uuid = _as_uuid(payload.variant_id, "variant_id") if payload.variant_id else None

    row = await create_or_update_shopping_item(
        db,
        owner_user_id=current_user.id,
        drug_id=base_drug.id,
        variant_id=variant_uuid,
        quantity=payload.quantity,
        notes=payload.notes.strip() if payload.notes else None,
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="owner.shopping_list.upsert",
        target_type="shopping_item",
        target_id=str(row.id),
        metadata={"drug_id": str(base_drug.id), "variant_id": str(variant_uuid) if variant_uuid else None},
    )
    await db.commit()
    return {"status": "ok", "id": str(row.id)}


@router.get("/owner/shopping-list")
async def get_owner_shopping_list(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    if current_user.role != RoleEnum.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only owner can view shopping list"},
        )
    return await list_owner_shopping_items(db, owner_user_id=current_user.id)


@router.post("/availability/track", status_code=status.HTTP_201_CREATED)
async def track_availability_query(
    payload: AvailabilityTrackRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    drug_uuid = None
    if payload.drug_id:
        base_drug = await resolve_drug(db, identifier=payload.drug_id)
        drug_uuid = base_drug.id if base_drug else None
    await log_availability_query(
        db,
        user_id=current_user.id,
        role=current_user.role.value,
        drug_id=drug_uuid,
        city=payload.city,
        lat=payload.lat,
        lng=payload.lng,
        radius_km=payload.radius_km,
    )
    await db.commit()
    return {"status": "tracked"}
