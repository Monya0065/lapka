from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.integrations.pharmacy_providers.base import PharmacyProvider
from src.models import (
    OnlineOffer,
    OnlineStore,
    Pharmacy,
    PharmacyInventory,
    PharmacyLocation,
)


def _distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    # Demo-friendly haversine distance.
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(radius * c, 1)


class DemoPharmacyProvider(PharmacyProvider):
    name = "demo"

    async def search_online_offers(
        self,
        db: AsyncSession,
        *,
        drug_id: uuid.UUID,
        city: str | None = None,
        limit: int = 12,
    ) -> list[dict[str, Any]]:
        query = (
            select(OnlineOffer, OnlineStore)
            .join(OnlineStore, OnlineStore.id == OnlineOffer.online_store_id)
            .where(OnlineOffer.drug_id == drug_id)
            .order_by(OnlineOffer.updated_at.desc())
            .limit(limit)
        )
        rows = (await db.execute(query)).all()

        return [
            {
                "store": store.name,
                "price_text": offer.price_text,
                "delivery_text": offer.delivery_text or "Доставка по тарифам магазина",
                "url": offer.url,
                "updated_at": offer.updated_at,
            }
            for offer, store in rows
        ]

    async def search_offline_inventory(
        self,
        db: AsyncSession,
        *,
        drug_id: uuid.UUID,
        city: str | None = None,
        lat: float | None = None,
        lng: float | None = None,
        radius_km: float | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        query = (
            select(PharmacyInventory, PharmacyLocation, Pharmacy)
            .join(PharmacyLocation, PharmacyLocation.id == PharmacyInventory.pharmacy_location_id)
            .join(Pharmacy, Pharmacy.id == PharmacyLocation.pharmacy_id)
            .where(PharmacyInventory.drug_id == drug_id)
            .order_by(PharmacyInventory.updated_at.desc())
            .limit(limit * 2)
        )
        if city:
            query = query.where(PharmacyLocation.city.ilike(city.strip()))
        rows = (await db.execute(query)).all()

        center_lat = lat if lat is not None else 55.7558
        center_lng = lng if lng is not None else 37.6176
        max_radius = radius_km if radius_km is not None else 30.0

        payload: list[dict[str, Any]] = []
        for inv, location, pharmacy in rows:
            distance = _distance_km(center_lat, center_lng, location.latitude, location.longitude)
            if distance > max_radius:
                continue
            payload.append(
                {
                    "pharmacy": pharmacy.name,
                    "address": location.address,
                    "distance_km": distance,
                    "hours": location.hours or "Уточняйте по телефону",
                    "phone": pharmacy.phone or "—",
                    "price_text": inv.price_text,
                    "in_stock": bool(inv.in_stock),
                    "updated_at": inv.updated_at,
                }
            )

        payload.sort(key=lambda row: row["distance_km"])
        return payload[:limit]
