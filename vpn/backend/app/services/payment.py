"""Payment service with YooKassa integration."""
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import text

from app.database import create_session

YOOKASSA_SHOP_ID = "YOUR_SHOP_ID"
YOOKASSA_SECRET_KEY = "YOUR_SECRET_KEY"
YOOKASSA_URL = "https://checkout.yookassa.ru/api/v3"


async def create_yookassa_payment(
    user_id: str,
    amount: int,
    plan_id: str,
) -> dict:
    """Create payment in YooKassa."""
    payment_id = str(uuid.uuid4())
    idempotency_key = f"{user_id}_{secrets.token_urlsafe(8)}"
    
    payment_data = {
        "amount": {
            "value": f"{amount}.00",
            "currency": "RUB"
        },
        "confirmation": {
            "type": "redirect",
            "return_url": "http://localhost:3001/payment/success"
        },
        "capture": True,
        "description": f"Lapka VPN - {plan_id}",
        "metadata": {
            "user_id": user_id,
            "payment_id": payment_id,
            "plan_id": plan_id
        }
    }
    
    session = await create_session()
    await session.execute(
        text("""
            INSERT INTO payments (id, user_id, provider, order_id, amount, status, idempotency_key)
            VALUES (:id, :user_id, 'yookassa', :order_id, :amount, 'pending', :idempotency_key)
        """),
        {
            "id": payment_id,
            "user_id": user_id,
            "order_id": f"order_{payment_id[:8]}",
            "amount": amount,
            "idempotency_key": idempotency_key,
        }
    )
    await session.commit()
    
    return {
        "payment_id": payment_id,
        "payment_url": f"https://checkout.yookassa.ru/payment/{payment_id}",
    }


async def verify_yookassa_signature(
    notification_signature: str,
    notification_body: str,
) -> bool:
    """Verify YooKassa webhook signature."""
    if not YOOKASSA_SECRET_KEY:
        return True
    
    signature = hmac.new(
        YOOKASSA_SECRET_KEY.encode(),
        notification_body.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, notification_signature)


async def process_yookassa_webhook(event_data: dict):
    """Process YooKassa webhook."""
    event_type = event_data.get("event")
    object_data = event_data.get("object", {})
    
    if event_type == "payment.succeeded":
        payment_id = object_data.get("metadata", {}).get("payment_id")
        if payment_id:
            await update_payment_status(payment_id, "succeeded")
    
    elif event_type == "payment.canceled":
        payment_id = object_data.get("metadata", {}).get("payment_id")
        if payment_id:
            await update_payment_status(payment_id, "canceled")


async def update_payment_status(payment_id: str, status: str):
    """Update payment status in DB."""
    session = await create_session()
    
    result = await session.execute(
        text("SELECT * FROM payments WHERE id = :id"),
        {"id": payment_id}
    )
    payment = result.fetchone()
    if not payment:
        return
    
    await session.execute(
        text("UPDATE payments SET status = :status WHERE id = :id"),
        {"status": status, "id": payment_id}
    )
    
    if status == "succeeded":
        user_id = payment.user_id
        amount = payment.amount
        
        plan_id = "monthly" if amount <= 500 else "yearly"
        renew_at = datetime.utcnow() + timedelta(days=30 if amount <= 500 else 365)
        
        result = await session.execute(
            text("SELECT * FROM subscriptions WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1"),
            {"user_id": user_id}
        )
        existing = result.fetchone()
        
        if existing:
            await session.execute(
                text("""
                    UPDATE subscriptions 
                    SET status = 'active', plan_id = :plan_id, renew_at = :renew_at, updated_at = NOW()
                    WHERE id = :id
                """),
                {"plan_id": plan_id, "renew_at": renew_at, "id": existing.id}
            )
        else:
            sub_id = str(uuid.uuid4())
            await session.execute(
                text("""
                    INSERT INTO subscriptions (id, user_id, plan_id, provider, status, renew_at)
                    VALUES (:id, :user_id, :plan_id, 'yookassa', 'active', :renew_at)
                """),
                {"id": sub_id, "user_id": user_id, "plan_id": plan_id, "renew_at": renew_at}
            )
    
    await session.commit()


class PaymentService:
    async def create_checkout(self, user_id: str, plan_id: str, provider: str = "yookassa"):
        plans = {
            "monthly": {"price": 299, "days": 30},
            "yearly": {"price": 2490, "days": 365},
            "trial": {"price": 0, "days": 7},
        }
        
        plan = plans.get(plan_id, plans["monthly"])
        
        if provider == "yookassa":
            return await create_yookassa_payment(user_id, plan["price"], plan_id)
        elif provider == "cloudpayments":
            return await create_cloudpayments_payment(user_id, plan["price"], plan_id)
        
        raise ValueError(f"Unknown provider: {provider}")


payment_service = PaymentService()