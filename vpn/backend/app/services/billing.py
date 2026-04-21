"""Billing Service."""
import uuid
from datetime import datetime, timedelta
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Payment, PaymentEvent, Subscription


PLANS = {
    "monthly": {"price": 299, "days": 30},
    "yearly": {"price": 2490, "days": 365},
    "trial": {"price": 0, "days": 7},
}


class BillingService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_subscription(self, user_id: uuid.UUID) -> Optional[Subscription]:
        result = await self.session.execute(
            select(Subscription)
            .where(Subscription.user_id == user_id)
            .order_by(Subscription.created_at.desc())
        )
        return result.scalar_one_or_none()

    async def create_checkout(
        self, user_id: uuid.UUID, plan_id: str, provider: str
    ) -> dict:
        plan = PLANS.get(plan_id, PLANS["monthly"])
        
        if provider == "yookassa":
            return await self._yookassa_create(user_id, plan, plan_id)
        elif provider == "cloudpayments":
            return await self._cloudpayments_create(user_id, plan, plan_id)
        elif provider == "tbank":
            return await self._tbank_create(user_id, plan, plan_id)
        raise ValueError(f"Unknown provider: {provider}")

    async def _yookassa_create(self, user_id: uuid.UUID, plan: dict, plan_id: str) -> dict:
        from sqlalchemy.ext.asyncio import AsyncSession
        session = self.session
        payment = Payment(
            id=uuid.uuid4(),
            user_id=user_id,
            subscription_id=uuid.uuid4(),
            provider="yookassa",
            order_id=f"order_{uuid.uuid4().hex[:8]}",
            amount=plan["price"],
            status="pending",
            idempotency_key=f"idem_{uuid.uuid4().hex}",
        )
        session.add(payment)
        await session.commit()
        await session.refresh(payment)
        
        return {
            "checkout_id": str(payment.id),
            "payment_url": f"https://checkout.yookassa.ru/payment/{payment.order_id}",
        }

    async def _cloudpayments_create(self, user_id: uuid.UUID, plan: dict, plan_id: str) -> dict:
        pass

    async def _tbank_create(self, user_id: uuid.UUID, plan: dict, plan_id: str) -> dict:
        pass

    async def handle_webhook(self, provider: str, payload: dict) -> bool:
        event_id = payload.get("event_id")
        if not event_id:
            return False
            
        result = await self.session.execute(
            select(PaymentEvent).where(
                PaymentEvent.provider == provider,
                PaymentEvent.event_id == str(event_id),
            )
        )
        if result.scalar_one_or_none():
            return False
            
        if provider == "yookassa":
            return await self._yookassa_process(payload)
        return False

    async def _yookassa_process(self, payload: dict) -> bool:
        event = PaymentEvent(
            provider="yookassa",
            event_id=payload.get("event_id", ""),
            event_hash=payload.get("hash", ""),
            processed_at=datetime.utcnow(),
        )
        self.session.add(event)
        await self.session.commit()
        return True

    async def update_subscription_status(self, user_id: uuid.UUID, status: str) -> Optional[Subscription]:
        subscription = await self.get_subscription(user_id)
        if subscription:
            subscription.status = status
            await self.session.commit()
            await self.session.refresh(subscription)
        return subscription