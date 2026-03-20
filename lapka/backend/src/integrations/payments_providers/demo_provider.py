from __future__ import annotations

import random
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from src.integrations.payments_providers.base import PaymentsProvider
from src.models import Invoice


class DemoPaymentsProvider(PaymentsProvider):
    name = "demo"

    async def charge_invoice(
        self,
        db: AsyncSession,
        *,
        invoice: Invoice,
        simulate_result: str | None = None,
    ) -> dict:
        status = (simulate_result or "").strip().lower()
        if status not in {"succeeded", "failed"}:
            status = "succeeded" if random.random() < 0.88 else "failed"

        now = datetime.now(timezone.utc)
        receipt = (
            f"Demo receipt #{str(invoice.id)[:8]} · "
            f"{invoice.total_cents / 100:.2f} {invoice.currency} · "
            f"{now.strftime('%Y-%m-%d %H:%M:%S %Z')}"
        )

        return {
            "provider": self.name,
            "status": status,
            "amount_cents": int(invoice.total_cents or 0),
            "currency": invoice.currency or "RUB",
            "receipt_text": receipt,
        }
