from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Invoice


class PaymentsProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def charge_invoice(
        self,
        db: AsyncSession,
        *,
        invoice: Invoice,
        simulate_result: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError
