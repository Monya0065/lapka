from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.models import LabOrder


class LabsProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def send_order(self, db: AsyncSession, *, order: LabOrder) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def import_result(
        self,
        db: AsyncSession,
        *,
        order: LabOrder,
        species: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError
