from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from src.integrations.labs_providers.base import LabsProvider
from src.models import LabOrder


class DemoLabsProvider(LabsProvider):
    name = "demo"

    async def send_order(self, db: AsyncSession, *, order: LabOrder) -> dict:
        external_ref = f"LAB-DEMO-{str(order.id)[:8].upper()}"
        return {
            "provider": self.name,
            "external_ref": external_ref,
            "status": "sent",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }

    async def import_result(
        self,
        db: AsyncSession,
        *,
        order: LabOrder,
        species: str | None = None,
    ) -> dict:
        safe_species = species or "пациента"
        result_text = (
            f"Демо-результат лаборатории для {safe_species}. "
            "Отмечены показатели для обсуждения с лечащим ветеринарным врачом. "
            "Рекомендовано сопоставить данные с клинической картиной."
        )
        attachments = [
            f"https://picsum.photos/seed/lapka-lab-{order.id}-1/1200/900",
            f"https://picsum.photos/seed/lapka-lab-{order.id}-2/1200/900",
        ]
        return {
            "provider": self.name,
            "status": "received",
            "result_text": result_text,
            "attachments": attachments,
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }
