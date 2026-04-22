from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.repositories.notifications import get_notification_preferences, upsert_notification_preferences
from src.security.deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class NotificationPrefsRequest(BaseModel):
    email: bool | None = None
    push: bool | None = None
    sms: bool | None = None
    appointment_reminder: bool | None = None
    document_alerts: bool | None = None
    marketing: bool | None = None


@router.get("/me/preferences")
async def get_preferences(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        return await get_notification_preferences(db, user_id=current_user.id)
    except Exception as e:
        print(f"Error getting preferences: {e}")
        return {"email": True, "push": True, "sms": False, "appointment_reminder": True, "document_alerts": True, "marketing": False}


@router.patch("/me/preferences")
async def update_preferences(
    payload: NotificationPrefsRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await upsert_notification_preferences(
        db,
        user_id=current_user.id,
        email_enabled=payload.email,
        push_enabled=payload.push,
        sms_enabled=payload.sms,
        appointment_reminder=payload.appointment_reminder,
        document_alerts=payload.document_alerts,
        marketing=payload.marketing,
    )
    await db.commit()
    return await get_notification_preferences(db, user_id=current_user.id)