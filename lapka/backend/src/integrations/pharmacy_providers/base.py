from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


class PharmacyProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def search_online_offers(
        self,
        db: AsyncSession,
        *,
        drug_id: uuid.UUID,
        city: str | None = None,
        limit: int = 12,
    ) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
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
        raise NotImplementedError
