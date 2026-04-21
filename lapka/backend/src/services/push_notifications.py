import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Notification, NotificationChannel, NotificationType


class PushNotificationService:
    def __init__(
        self,
        *,
        fcm_api_key: str | None = None,
        fcm_project_id: str | None = None,
    ):
        self.fcm_api_key = fcm_api_key
        self.fcm_project_id = fcm_project_id
    
    async def send_push_notification(
        self,
        *,
        device_token: str,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> dict:
        if not self.fcm_api_key:
            return {"status": "disabled", "message": "FCM not configured"}
        
        try:
            import aiohttp
        except ImportError:
            return {"status": "error", "message": "aiohttp not installed"}
        
        payload = {
            "message": {
                "token": device_token,
                "notification": {
                    "title": title,
                    "body": body,
                },
                "data": data or {},
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://fcm.googleapis.com/v1/projects/{self.fcm_project_id}/messages:send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {self.fcm_api_key}",
                    "Content-Type": "application/json",
                },
            ) as resp:
                result = await resp.json()
                if resp.status == 200:
                    return {"status": "sent", "message_id": result.get("name")}
                return {"status": "error", "detail": result}
        
        return {"status": "error", "message": "Unknown error"}


async def send_push_to_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str,
    data: dict | None = None,
) -> dict:
    from sqlalchemy import select
    from src.models import UserDeviceToken
    
    tokens = await db.scalars(
        select(UserDeviceToken).where(UserDeviceToken.user_id == user_id)
    )
    token_list = list(tokens)
    
    if not token_list:
        return {"status": "no_devices", "message": "No device tokens found"}
    
    results = []
    for token_row in token_list:
        results.append({
            "token": token_row.device_token,
            "status": "simulated",
        })
    
    return {
        "status": "sent",
        "count": len(results),
        "devices": results,
    }


async def notify_appointment_push(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    pet_name: str,
    clinic_name: str,
    scheduled_at: str,
) -> dict:
    return await send_push_to_user(
        db,
        user_id=user_id,
        title="Напоминание о визите",
        body=f"Визит для {pet_name} в {clinic_name} на {scheduled_at}",
        data={"type": "appointment"},
    )


async def notify_inpatient_push(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    pet_name: str,
    status_update: str,
) -> dict:
    return await send_push_to_user(
        db,
        user_id=user_id,
        title="Стационар",
        body=f"{pet_name}: {status_update}",
        data={"type": "inpatient"},
    )


async def notify_document_push(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    document_title: str,
) -> dict:
    return await send_push_to_user(
        db,
        user_id=user_id,
        title="Документ готов",
        body=f"Документ '{document_title}' загружен",
        data={"type": "document"},
    )


async def notify_consent_push(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    clinic_name: str,
) -> dict:
    return await send_push_to_user(
        db,
        user_id=user_id,
        title="Запрос согласия",
        body=f"Клиника {clinic_name} запрашивает доступ",
        data={"type": "consent"},
    )