"""MVP: Stripe Checkout for lost-pet listing boost + admin notify."""

from __future__ import annotations

import logging
import secrets
import smtplib
from email.mime.text import MIMEText

import requests
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.db.session import get_db_session
from src.models import RoleEnum, User
from src.security.deps import get_current_user, require_roles
from src.services.audit import log_audit

router = APIRouter(prefix="/mvp", tags=["mvp"])
logger = logging.getLogger("lapka.api")


class LostPetBoostCheckoutBody(BaseModel):
    lost_note: str = Field(default="", max_length=2000)
    invite_code: str = Field(default="", max_length=128)


class InviteValidateBody(BaseModel):
    code: str = Field(default="", max_length=128)


class PilotFeedbackBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    rating: int | None = Field(default=None, ge=1, le=5)
    context: str = Field(default="quick_triage", max_length=64)


def _invite_matches(provided: str | None) -> bool:
    settings = get_settings()
    expected = (settings.mvp_invite_code or "").strip()
    if not expected:
        return True
    got = (provided or "").strip()
    if len(got) != len(expected):
        return False
    return secrets.compare_digest(got.encode("utf-8"), expected.encode("utf-8"))


@router.get("/pilot-config")
async def mvp_pilot_config() -> dict:
    settings = get_settings()
    return {"invite_required": bool((settings.mvp_invite_code or "").strip())}


@router.post("/invite/validate")
async def mvp_invite_validate(payload: InviteValidateBody) -> dict:
    ok = _invite_matches(payload.code)
    return {"valid": ok}


@router.post("/pilot-feedback")
async def mvp_pilot_feedback(
    payload: PilotFeedbackBody,
    current_user: User = Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="mvp.pilot_feedback",
        target_type="mvp_quick_triage",
        target_id=str(current_user.id),
        metadata={
            "message": payload.message.strip()[:2000],
            "rating": payload.rating,
            "context": payload.context.strip()[:64],
            "email": (current_user.email or "")[:255],
        },
    )
    await db.commit()
    return {"ok": True}


def _notify_admin(metadata: dict, session_id: str | None) -> None:
    settings = get_settings()
    user_id = metadata.get("user_id", "")
    note = metadata.get("lost_note", "")
    email = metadata.get("user_email", "")
    text = (
        f"Lapka: оплата буста объявления (потеряшки).\n"
        f"Session: {session_id}\nUser: {user_id}\nEmail: {email}\nNote: {note[:800]}"
    )
    logger.info(text)

    notify_to = settings.mvp_admin_notify_email
    if notify_to and settings.smtp_host and settings.smtp_from:
        msg = MIMEText(text, "plain", "utf-8")
        msg["Subject"] = "Lapka MVP: оплата буста потеряшки"
        msg["From"] = settings.smtp_from
        msg["To"] = notify_to
        try:
            if settings.smtp_use_tls:
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                    smtp.starttls()
                    if settings.smtp_user and settings.smtp_password:
                        smtp.login(settings.smtp_user, settings.smtp_password)
                    smtp.sendmail(settings.smtp_from, [notify_to], msg.as_string())
            else:
                with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                    if settings.smtp_user and settings.smtp_password:
                        smtp.login(settings.smtp_user, settings.smtp_password)
                    smtp.sendmail(settings.smtp_from, [notify_to], msg.as_string())
        except Exception:
            logger.exception("mvp_boost admin email failed")

    token = settings.mvp_telegram_bot_token
    chat_id = settings.mvp_telegram_chat_id
    if token and chat_id:
        try:
            requests.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text[:4000]},
                timeout=10,
            )
        except Exception:
            logger.exception("mvp_boost telegram failed")


@router.post("/lost-pet-boost/checkout")
async def lost_pet_boost_checkout(
    payload: LostPetBoostCheckoutBody,
    current_user: User = Depends(require_roles(RoleEnum.owner)),
) -> dict:
    settings = get_settings()
    if not _invite_matches(payload.invite_code):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "INVITE_INVALID", "message": "Нужен действующий пилотный код."},
        )
    if not settings.stripe_secret_key or not settings.stripe_price_lost_pet_boost_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "STRIPE_NOT_CONFIGURED",
                "message": "Оплата не настроена. Укажите STRIPE_SECRET_KEY и STRIPE_PRICE_LOST_PET_BOOST_ID.",
            },
        )
    stripe.api_key = settings.stripe_secret_key
    base = settings.app_public_url.rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": settings.stripe_price_lost_pet_boost_id, "quantity": 1}],
            success_url=f"{base}/owner/quick-triage?boost=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base}/owner/quick-triage?boost=cancel",
            metadata={
                "user_id": str(current_user.id),
                "user_email": current_user.email or "",
                "lost_note": (payload.lost_note or "")[:500],
            },
            customer_email=current_user.email or None,
        )
    except stripe.StripeError as exc:
        logger.exception("Stripe checkout failed")
        msg = getattr(exc, "user_message", None) or str(exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "STRIPE_ERROR", "message": msg[:200]},
        ) from exc
    return {"url": session.url}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request) -> dict:
    settings = get_settings()
    if not settings.stripe_webhook_secret or not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "WEBHOOK_NOT_CONFIGURED", "message": "Webhook не настроен."},
        )
    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()
    sig = request.headers.get("stripe-signature") or ""
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload") from exc
    except stripe.SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature") from exc

    if event.get("type") == "checkout.session.completed":
        obj = event["data"]["object"]
        meta = obj.get("metadata") or {}
        _notify_admin(meta, obj.get("id"))

    return {"received": True}
