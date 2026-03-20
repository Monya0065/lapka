from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.integrations.pharmacy_providers.provider_registry import get_pharmacy_provider
from src.models import (
    AvailabilityQuery,
    Drug,
    DrugAnalog,
    DrugImage,
    DrugVariant,
    DrugWarning,
    OwnerShoppingListItem,
    RoleEnum,
)


def _sanitize_text_list(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [str(v).strip() for v in values if str(v).strip()]


def _try_uuid(value: str | uuid.UUID) -> uuid.UUID | None:
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


async def resolve_drug(db: AsyncSession, *, identifier: str | uuid.UUID) -> Drug | None:
    uuid_id = _try_uuid(identifier)
    if uuid_id is not None:
        row = await db.scalar(select(Drug).where(Drug.id == uuid_id))
        if row:
            return row
    return await db.scalar(select(Drug).where(Drug.external_id == str(identifier)))


def _thumbnail_for(drug_id: uuid.UUID, images_map: dict[uuid.UUID, list[DrugImage]]) -> str:
    rows = images_map.get(drug_id, [])
    if rows:
        return rows[0].url
    return "/assets/img/drugs/pack-01.svg"


def _serialize_drug_card(drug: Drug, images_map: dict[uuid.UUID, list[DrugImage]]) -> dict[str, Any]:
    return {
        "id": str(drug.id),
        "name": drug.name,
        "active_substance": drug.active_substance,
        "prescription_required": bool(drug.prescription_required),
        "thumbnail_url": _thumbnail_for(drug.id, images_map),
        "forms": list(drug.forms_json or []),
        "species": list(drug.species_json or []),
        "tags": list(drug.tags_json or []),
        "popular": bool(drug.popularity_rank and drug.popularity_rank > 0),
    }


def _drug_order_key(drug: Drug) -> tuple[int, int, str]:
    rank = int(drug.popularity_rank or 10_000)
    is_generic_demo = 1 if str(drug.name or "").lower().startswith("препарат ") else 0
    return (rank, is_generic_demo, str(drug.name or "").lower())


async def _load_images_map(db: AsyncSession, drug_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[DrugImage]]:
    if not drug_ids:
        return {}
    image_rows = (
        await db.scalars(
            select(DrugImage)
            .where(DrugImage.drug_id.in_(drug_ids))
            .order_by(DrugImage.drug_id.asc(), DrugImage.sort_order.asc())
        )
    ).all()
    images_map: dict[uuid.UUID, list[DrugImage]] = {}
    for row in image_rows:
        images_map.setdefault(row.drug_id, []).append(row)
    return images_map


async def search_market_drugs(
    db: AsyncSession,
    *,
    q: str | None = None,
    species: str | None = None,
    form: str | None = None,
    prescription_required: bool | None = None,
    page: int = 1,
    limit: int = 24,
) -> dict[str, Any]:
    page = max(1, page)
    limit = max(1, min(100, limit))

    query = select(Drug)
    ql = (q or "").strip().lower()
    if ql:
        pattern = f"%{ql}%"
        query = query.where(
            or_(
                func.lower(Drug.name).like(pattern),
                func.lower(func.coalesce(Drug.active_substance, "")).like(pattern),
                func.lower(func.coalesce(Drug.group_name, "")).like(pattern),
            )
        )

    if prescription_required is not None:
        query = query.where(Drug.prescription_required.is_(prescription_required))

    species_l = (species or "").strip().lower()
    form_l = (form or "").strip().lower()

    all_rows = (
        await db.scalars(
            query.order_by(
                Drug.popularity_rank.asc().nullslast(),
                Drug.name.asc(),
            )
        )
    ).all()

    filtered_rows = [
        row
        for row in all_rows
        if (
            (not species_l or species_l in [str(item).lower() for item in (row.species_json or [])])
            and (not form_l or form_l in [str(item).lower() for item in (row.forms_json or [])])
        )
    ]
    filtered_rows.sort(key=_drug_order_key)
    total = len(filtered_rows)
    offset = (page - 1) * limit
    rows = filtered_rows[offset : offset + limit]
    ids = [row.id for row in rows]
    images_map = await _load_images_map(db, ids)
    items = [_serialize_drug_card(row, images_map) for row in rows]

    popular_rows = (
        await db.scalars(
            select(Drug)
            .where(Drug.popularity_rank.is_not(None))
            .order_by(Drug.popularity_rank.asc(), Drug.name.asc())
            .limit(15)
        )
    ).all()
    popular_ids = [row.id for row in popular_rows]
    popular_images_map = await _load_images_map(db, popular_ids)
    popular = [_serialize_drug_card(row, popular_images_map) for row in popular_rows]

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "popular": popular,
    }


async def get_market_drug_by_id(
    db: AsyncSession,
    *,
    drug_id: str | uuid.UUID,
    user_role: RoleEnum,
) -> dict[str, Any] | None:
    drug = await resolve_drug(db, identifier=drug_id)
    if not drug:
        return None

    images = (
        await db.scalars(
            select(DrugImage).where(DrugImage.drug_id == drug.id).order_by(DrugImage.sort_order.asc(), DrugImage.created_at.asc())
        )
    ).all()

    variants = (
        await db.scalars(
            select(DrugVariant).where(DrugVariant.drug_id == drug.id).order_by(DrugVariant.form.asc(), DrugVariant.created_at.asc())
        )
    ).all()

    warning_rows = (
        await db.scalars(
            select(DrugWarning).where(DrugWarning.drug_id == drug.id).order_by(DrugWarning.created_at.asc())
        )
    ).all()
    warnings = _sanitize_text_list(list(drug.warnings_json or [])) + _sanitize_text_list(
        [row.warning_text for row in warning_rows]
    )

    analog_links = (
        await db.scalars(select(DrugAnalog).where(DrugAnalog.drug_id == drug.id).order_by(DrugAnalog.created_at.asc()))
    ).all()
    analog_ids = list({row.analog_drug_id for row in analog_links if row.analog_drug_id != drug.id})
    analog_rows = []
    analog_images_map: dict[uuid.UUID, list[DrugImage]] = {}
    if analog_ids:
        analog_rows = (await db.scalars(select(Drug).where(Drug.id.in_(analog_ids)).order_by(Drug.name.asc()))).all()
        analog_images_map = await _load_images_map(db, analog_ids)

    analogs = [
        {
            "id": str(row.id),
            "name": row.name,
            "active_substance": row.active_substance,
            "prescription_required": bool(row.prescription_required),
            "thumbnail_url": _thumbnail_for(row.id, analog_images_map),
            "forms": list(row.forms_json or []),
        }
        for row in analog_rows
    ]

    payload: dict[str, Any] = {
        "id": str(drug.id),
        "name": drug.name,
        "active_substance": drug.active_substance,
        "group": drug.group_name,
        "species": list(drug.species_json or []),
        "forms": list(drug.forms_json or []),
        "tags": list(drug.tags_json or []),
        "prescription_required": bool(drug.prescription_required),
        "controlled_flag": bool(drug.controlled_flag),
        "description": drug.indications_summary
        or "Справочная информация по препарату. Решение принимает ветеринарный врач.",
        "contraindications": list(drug.contraindications_json or []),
        "side_effects": list(drug.side_effects_json or []),
        "interactions": list(drug.interactions_json or []),
        "warnings": warnings,
        "storage_notes": drug.storage_notes,
        "images": [row.url for row in images] or ["/assets/img/drugs/pack-01.svg"],
        "variants": [
            {
                "id": str(row.id),
                "form": row.form,
                "strength_text": row.strength_text,
                "pack_size_text": row.pack_size_text,
                "sku_text": row.sku_text,
            }
            for row in variants
        ],
        "analogs": analogs,
        "dose_reference": {
            "status": "placeholder",
            "text": "По протоколу клиники/официальной инструкции. Окончательное решение принимает ветеринарный врач.",
        },
    }

    if user_role in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        payload["clinical_notes"] = list(drug.clinical_notes_json or [])
    else:
        payload["owner_notice"] = (
            "Информация справочная. Не применяйте препараты без назначения ветеринарного врача."
        )

    return payload


async def get_market_analogs(db: AsyncSession, *, drug_id: str | uuid.UUID) -> list[dict[str, Any]]:
    base_drug = await resolve_drug(db, identifier=drug_id)
    if not base_drug:
        return []
    links = (
        await db.scalars(select(DrugAnalog).where(DrugAnalog.drug_id == base_drug.id).order_by(DrugAnalog.created_at.asc()))
    ).all()
    analog_ids = list({row.analog_drug_id for row in links if row.analog_drug_id != base_drug.id})
    if not analog_ids:
        return []

    rows = (await db.scalars(select(Drug).where(Drug.id.in_(analog_ids)).order_by(Drug.name.asc()))).all()
    images_map = await _load_images_map(db, [row.id for row in rows])
    return [_serialize_drug_card(row, images_map) for row in rows]


async def get_market_availability(
    db: AsyncSession,
    *,
    drug_id: str | uuid.UUID,
    lat: float | None = None,
    lng: float | None = None,
    city: str | None = None,
    radius_km: float | None = None,
) -> dict[str, Any]:
    base_drug = await resolve_drug(db, identifier=drug_id)
    if not base_drug:
        return {"online": [], "offline": [], "disclaimer": "Availability is informational; confirm with pharmacy."}
    provider = get_pharmacy_provider()
    online = await provider.search_online_offers(db, drug_id=base_drug.id, city=city, limit=12)
    offline = await provider.search_offline_inventory(
        db,
        drug_id=base_drug.id,
        city=city,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        limit=20,
    )
    return {
        "online": online,
        "offline": offline,
        "disclaimer": "Availability is informational; confirm with pharmacy.",
    }


async def create_or_update_shopping_item(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    drug_id: uuid.UUID,
    variant_id: uuid.UUID | None,
    quantity: int,
    notes: str | None,
) -> OwnerShoppingListItem:
    filters = [OwnerShoppingListItem.owner_user_id == owner_user_id, OwnerShoppingListItem.drug_id == drug_id]
    if variant_id is None:
        filters.append(OwnerShoppingListItem.variant_id.is_(None))
    else:
        filters.append(OwnerShoppingListItem.variant_id == variant_id)

    row = await db.scalar(select(OwnerShoppingListItem).where(and_(*filters)))
    if row:
        row.quantity = quantity
        row.notes = notes
        row.updated_at = datetime.now(timezone.utc)
        return row

    row = OwnerShoppingListItem(
        owner_user_id=owner_user_id,
        drug_id=drug_id,
        variant_id=variant_id,
        quantity=quantity,
        notes=notes,
    )
    db.add(row)
    await db.flush()
    return row


async def list_owner_shopping_items(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
) -> list[dict[str, Any]]:
    rows = (
        await db.scalars(
            select(OwnerShoppingListItem)
            .where(OwnerShoppingListItem.owner_user_id == owner_user_id)
            .order_by(OwnerShoppingListItem.updated_at.desc(), OwnerShoppingListItem.created_at.desc())
        )
    ).all()
    if not rows:
        return []

    drug_ids = list({row.drug_id for row in rows})
    drugs = (
        await db.scalars(select(Drug).where(Drug.id.in_(drug_ids)))
    ).all()
    drug_map = {row.id: row for row in drugs}
    images_map = await _load_images_map(db, drug_ids)

    variant_ids = [row.variant_id for row in rows if row.variant_id]
    variants_map: dict[uuid.UUID, DrugVariant] = {}
    if variant_ids:
        variants = (await db.scalars(select(DrugVariant).where(DrugVariant.id.in_(variant_ids)))).all()
        variants_map = {row.id: row for row in variants}

    payload: list[dict[str, Any]] = []
    for row in rows:
        drug = drug_map.get(row.drug_id)
        if not drug:
            continue
        variant = variants_map.get(row.variant_id) if row.variant_id else None
        payload.append(
            {
                "id": str(row.id),
                "drug_id": str(drug.id),
                "variant_id": str(row.variant_id) if row.variant_id else None,
                "quantity": row.quantity,
                "notes": row.notes,
                "drug_name": drug.name,
                "thumbnail_url": _thumbnail_for(drug.id, images_map),
                "prescription_required": bool(drug.prescription_required),
                "variant_label": (
                    f"{variant.form} · {variant.strength_text or 'по инструкции'}"
                    if variant
                    else "Базовая форма"
                ),
                "updated_at": row.updated_at,
            }
        )
    return payload


async def log_availability_query(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None,
    role: str | None,
    drug_id: uuid.UUID | None,
    city: str | None,
    lat: float | None,
    lng: float | None,
    radius_km: float | None,
) -> None:
    db.add(
        AvailabilityQuery(
            user_id=user_id,
            role=role,
            drug_id=drug_id,
            city=city,
            latitude=lat,
            longitude=lng,
            radius_km=radius_km,
        )
    )
