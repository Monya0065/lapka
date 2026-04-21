"""Telegram integration router."""
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.database import get_session
from app.services.email import email_service

router = APIRouter()


@router.post("/link-start")
async def start_link(telegram_user_id: str):
    """Start linking Telegram to account."""
    session = await get_session()
    
    token = secrets.token_urlsafe(16)
    token_hash = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)
    
    await session.execute(
        text("""
            INSERT INTO device_claim_tokens (id, user_id, token_hash, expires_at, type)
            VALUES (:id, NULL, :token_hash, :expires_at, 'telegram_activation')
        """),
        {
            "id": str(uuid.uuid4()),
            "token_hash": token_hash,
            "expires_at": expires_at,
        }
    )
    await session.commit()
    
    link = f"http://localhost:3001/claim?token={token}.{token_hash}"
    
    return {"link": link, "expires_at": expires_at.isoformat()}


@router.post("/link-confirm")
async def confirm_link(telegram_user_id: str, user_id: str):
    """Confirm linking Telegram to account."""
    session = await get_session()
    
    await session.execute(
        text("""
            INSERT INTO telegram_links (id, user_id, telegram_user_id, verified_at)
            VALUES (:id, :user_id, :telegram_id, NOW())
            ON CONFLICT (telegram_user_id) DO UPDATE SET verified_at = NOW()
        """),
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "telegram_id": telegram_user_id,
        }
    )
    await session.commit()
    
    return {"status": "linked"}


@router.get("/status/{telegram_user_id}")
async def get_status(telegram_user_id: str):
    """Get user status by Telegram ID."""
    session = await get_session()
    
    result = await session.execute(
        text("""
            SELECT u.email, s.status as sub_status, s.plan_id
            FROM telegram_links tl
            JOIN users u ON tl.user_id = u.id
            LEFT JOIN subscriptions s ON u.id = s.user_id
            WHERE tl.telegram_user_id = :tg_id AND tl.verified_at IS NOT NULL
            ORDER BY s.created_at DESC LIMIT 1
        """),
        {"tg_id": telegram_user_id}
    )
    row = result.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "email": row.email,
        "subscription_status": row.sub_status or "none",
        "plan_id": row.plan_id,
    }


router2 = APIRouter()


@router2.post("/activation")
async def create_activation(telegram_user_id: str = None):
    """Create activation token via Telegram."""
    token = secrets.token_urlsafe(16)
    return {"token": token, "link": f"http://localhost:3001/activate/{token}"}
