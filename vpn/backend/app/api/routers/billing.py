"""Billing router with payment integration."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status

from app.database import get_session
from app.schemas import CheckoutCreateRequest, CheckoutResponse, PaymentStatusResponse, SubscriptionResponse
from app.services import get_current_user_id
from app.services.payment import payment_service

router = APIRouter()


@router.get("/subscription")
async def get_subscription(user_id: uuid.UUID = Depends(get_current_user_id)):
    """Get user's subscription."""
    session = await get_session()
    from sqlalchemy import text
    result = await session.execute(
        text("SELECT * FROM subscriptions WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 1"),
        {"user_id": str(user_id)}
    )
    sub = result.fetchone()
    if not sub:
        return None
    return {
        "id": str(sub.id),
        "user_id": str(sub.user_id),
        "plan_id": sub.plan_id,
        "provider": sub.provider,
        "status": sub.status,
        "renew_at": sub.renew_at.isoformat() if sub.renew_at else None,
    }


@router.post("/checkout")
async def create_checkout(
    data: CheckoutCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Create payment checkout."""
    result = await payment_service.create_checkout(str(user_id), data.plan_id, data.provider)
    return result


@router.post("/webhook/{provider}")
async def webhook(
    provider: str,
    payload: dict,
    x_yookassa_signature: str = Header(None),
):
    """Handle payment provider webhooks."""
    from app.services.payment import process_yookassa_webhook
    
    if provider == "yookassa":
        await process_yookassa_webhook(payload)
    elif provider == "cloudpayments":
        pass
    
    return {"ok": True}


@router.get("/checkout/{checkout_id}/status")
async def checkout_status(checkout_id: str):
    """Get checkout status."""
    session = await get_session()
    from sqlalchemy import text
    result = await session.execute(
        text("SELECT * FROM payments WHERE id = :id"),
        {"id": checkout_id}
    )
    payment = result.fetchone()
    if not payment:
        return {"checkout_id": checkout_id, "status": "not_found", "amount": 0}
    return {
        "checkout_id": checkout_id,
        "status": payment.status,
        "amount": payment.amount,
    }