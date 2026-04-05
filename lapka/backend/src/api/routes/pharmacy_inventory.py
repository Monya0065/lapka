from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Drug,
    DrugVariant,
    Pharmacy,
    PharmacyInventory,
    PharmacyLocation,
    NotificationType,
    RoleEnum,
)
from src.security.deps import require_clinic_membership, require_roles
from src.services.audit import log_audit
from src.services.notifications import create_notification, list_user_notifications

router = APIRouter(prefix="/clinic/pharmacy", tags=["pharmacy-inventory"])


class InventoryUpdateRequest(BaseModel):
    in_stock: bool | None = Field(default=None)
    expires_at: datetime | None = Field(default=None)
    price_text: str | None = Field(default=None, min_length=1, max_length=64)


@router.get("/locations")
async def list_pharmacy_locations(
    clinic_id: str = Query(...),
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = uuid.UUID(clinic_id)
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    rows = (
        await db.execute(
            select(PharmacyLocation, Pharmacy)
            .join(Pharmacy, Pharmacy.id == PharmacyLocation.pharmacy_id)
            .where(PharmacyLocation.clinic_id == clinic_uuid)
            .order_by(Pharmacy.name.asc(), PharmacyLocation.address.asc())
        )
    ).all()

    # rows are tuples (PharmacyLocation, Pharmacy)
    payload: list[dict] = []
    for loc, pharmacy in rows:
        payload.append(
            {
                "id": str(loc.id),
                "clinic_id": str(clinic_uuid),
                "pharmacy_id": str(pharmacy.id),
                "pharmacy_name": pharmacy.name,
                "city": loc.city,
                "address": loc.address,
                "hours": loc.hours,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
            }
        )

    return payload


@router.get("/expiration-alerts")
async def get_expiration_alerts(
    clinic_id: str = Query(...),
    within_days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=10, ge=1, le=50),
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = uuid.UUID(clinic_id)
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
    now = datetime.now(timezone.utc)
    bound = now + timedelta(days=within_days)
    inv_stmt = (
        select(PharmacyInventory, PharmacyLocation, Pharmacy, Drug)
        .join(PharmacyLocation, PharmacyLocation.id == PharmacyInventory.pharmacy_location_id)
        .join(Pharmacy, Pharmacy.id == PharmacyLocation.pharmacy_id)
        .join(Drug, Drug.id == PharmacyInventory.drug_id)
        .where(
            PharmacyLocation.clinic_id == clinic_uuid,
            PharmacyInventory.in_stock.is_(True),
            PharmacyInventory.expires_at.is_not(None),
            PharmacyInventory.expires_at <= bound,
        )
        .order_by(PharmacyInventory.expires_at.asc())
    )
    rows = (await db.execute(inv_stmt)).all()
    items = []
    for inv, loc, pharmacy, drug in rows[:limit]:
        items.append({
            "id": str(inv.id),
            "drug_name": drug.name,
            "pharmacy_name": pharmacy.name,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        })

    # Minimal "inbox signal" for urgent windows.
    # We reuse existing NotificationType enum and distinguish the signal via metadata.
    if within_days in (7, 30) and len(rows) > 0:
        try:
            unread = await list_user_notifications(db, user_id=current_user.id, limit=100, unread_only=True)
            already = any(
                (row.metadata_json or {}).get("kind") == "pharmacy_expiration_alert"
                and (row.metadata_json or {}).get("within_days") == within_days
                for row in unread
            )
            if not already:
                total = len(rows)
                title = "Сигнал по складу: срок годности приближается"
                body = f"Найдены {total} позиций со сроком до {within_days} дней. Проверьте раздел «Склад и сроки»."
                if within_days == 7:
                    title = "Срочный сигнал по складу: риск просрочки"
                await create_notification(
                    db,
                    user_id=current_user.id,
                    notification_type=NotificationType.inpatient_update,
                    title=title,
                    body=body,
                    metadata={
                        "kind": "pharmacy_expiration_alert",
                        "within_days": within_days,
                        "count": total,
                        "clinic_id": str(clinic_uuid),
                    },
                )
                await log_audit(
                    db,
                    actor_user_id=str(current_user.id),
                    clinic_id=str(clinic_uuid),
                    action="pharmacy.inventory.expiration_alerts.notify",
                    target_type="pharmacy_inventory",
                    target_id=None,
                    metadata={"within_days": within_days, "count": len(rows)},
                )
        except Exception:  # noqa: BLE001
            # Never break the expiration endpoint by notification failures.
            pass

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="pharmacy.inventory.expiration_alerts.view",
        target_type="pharmacy_inventory",
        target_id=None,
        metadata={"within_days": within_days, "limit": limit},
    )
    await db.commit()
    return {"count": len(rows), "within_days": within_days, "items": items}


@router.get("/inventory")
async def list_inventory(
    clinic_id: str = Query(...),
    location_id: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Поиск по названию препарата"),
    in_stock: bool | None = Query(default=None, description="Фильтр по наличию"),
    expires_within_days: int | None = Query(
        default=None,
        ge=0,
        le=365,
        description="Показать товары со сроком годности не позже N дней",
    ),
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = uuid.UUID(clinic_id)
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    now = datetime.now(timezone.utc)

    inv_stmt = (
        select(
            PharmacyInventory,
            PharmacyLocation,
            Pharmacy,
            Drug,
            DrugVariant,
        )
        .join(PharmacyLocation, PharmacyLocation.id == PharmacyInventory.pharmacy_location_id)
        .join(Pharmacy, Pharmacy.id == PharmacyLocation.pharmacy_id)
        .join(Drug, Drug.id == PharmacyInventory.drug_id)
        .outerjoin(DrugVariant, DrugVariant.id == PharmacyInventory.variant_id)
        .where(PharmacyLocation.clinic_id == clinic_uuid)
    )

    if location_id:
        inv_stmt = inv_stmt.where(PharmacyLocation.id == uuid.UUID(location_id))

    if in_stock is not None:
        inv_stmt = inv_stmt.where(PharmacyInventory.in_stock == in_stock)

    if expires_within_days is not None:
        bound = now + timedelta(days=expires_within_days)
        inv_stmt = inv_stmt.where(
            PharmacyInventory.expires_at.is_not(None),
            PharmacyInventory.expires_at <= bound,
        )

    if q and q.strip():
        q_clean = f"%{q.strip()}%"
        inv_stmt = inv_stmt.where(Drug.name.ilike(q_clean))

    inv_stmt = inv_stmt.order_by(
        PharmacyInventory.in_stock.desc(),
        PharmacyInventory.expires_at.asc().nulls_last(),
        Drug.name.asc(),
    )

    rows = (await db.execute(inv_stmt)).all()
    payload: list[dict] = []
    for inv, loc, pharmacy, drug, variant in rows:
        payload.append(
            {
                "id": str(inv.id),
                "clinic_id": str(clinic_uuid),
                "pharmacy_location_id": str(loc.id),
                "pharmacy_id": str(pharmacy.id),
                "pharmacy_name": pharmacy.name,
                "drug_id": str(drug.id),
                "drug_name": drug.name,
                "variant_id": str(variant.id) if variant else None,
                "variant_text": (
                    variant.form if variant else None
                ),
                "in_stock": inv.in_stock,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
                "price_text": inv.price_text,
                "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
            }
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="pharmacy.inventory.view",
        target_type="pharmacy_inventory",
        target_id=None,
        metadata={"location_id": location_id, "q": q, "in_stock": in_stock, "expires_within_days": expires_within_days},
    )
    await db.commit()

    return payload


@router.patch("/inventory/{inventory_id}")
async def patch_inventory(
    inventory_id: str,
    payload: InventoryUpdateRequest,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    inv_uuid = uuid.UUID(inventory_id)

    row = await db.scalar(select(PharmacyInventory).where(PharmacyInventory.id == inv_uuid))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Inventory item not found"})

    loc = await db.scalar(
        select(PharmacyLocation).where(PharmacyLocation.id == row.pharmacy_location_id)
    )
    if not loc or not loc.clinic_id:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Inventory location not linked to a clinic"})

    clinic_uuid = loc.clinic_id
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(row, key, value)

    # `log_audit` stores metadata as JSON; ensure datetimes are serializable.
    serializable_metadata = {}
    for key, value in updates.items():
        if isinstance(value, datetime):
            serializable_metadata[key] = value.isoformat()
        else:
            serializable_metadata[key] = value

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="pharmacy.inventory.update",
        target_type="pharmacy_inventory",
        target_id=str(row.id),
        metadata=serializable_metadata,
    )
    await db.commit()

    await db.refresh(row)
    return {
        "status": "updated",
        "id": str(row.id),
        "in_stock": row.in_stock,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "price_text": row.price_text,
    }

