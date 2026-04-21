"""Push notification router."""
import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.services import auth_service
from app.services.push_notification import push_service

router = APIRouter()


class DeviceTokenRequest(BaseModel):
    token: str
    device_type: str


class PushNotificationRequest(BaseModel):
    title: str
    body: str
    data: dict | None = None


@router.post("/devices")
async def register_device(
    data: DeviceTokenRequest,
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    from sqlalchemy import text
    session = await get_session()

    await session.execute(
        text("""
            INSERT INTO push_tokens (user_id, token, device_type, created_at)
            VALUES (:user_id, :token, :device_type, NOW())
            ON CONFLICT (token) DO UPDATE SET device_type = :device_type
        """),
        {"user_id": str(user_id), "token": data.token, "device_type": data.device_type}
    )
    await session.commit()

    return {"registered": True}


@router.delete("/devices")
async def unregister_device(
    token: str = Query(...),
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    from sqlalchemy import text
    session = await get_session()

    await session.execute(
        text("DELETE FROM push_tokens WHERE user_id = :user_id AND token = :token"),
        {"user_id": str(user_id), "token": token}
    )
    await session.commit()

    return {"unregistered": True}


@router.post("/test")
async def send_test_notification(
    data: PushNotificationRequest,
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    from sqlalchemy import text
    session = await get_session()

    result = await session.execute(
        text("SELECT token, device_type FROM push_tokens WHERE user_id = :user_id LIMIT 1"),
        {"user_id": str(user_id)}
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No device registered")

    sent = await push_service.send_notification(
        user_id=str(user_id),
        title=data.title,
        body=data.body,
        data=data.data,
        device_token=row.token,
        device_type=row.device_type,
    )

    return {"sent": sent}


@router.post("/broadcast")
async def broadcast_notification(
    data: PushNotificationRequest,
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    from sqlalchemy import text
    from app.database import get_session

    session = await get_session()
    
    result = await session.execute(
        text("SELECT DISTINCT user_id FROM push_tokens")
    )
    rows = result.fetchall()

    tasks = []
    for row in rows:
        tasks.append(
            push_service.send_notification(
                user_id=str(row.user_id),
                title=data.title,
                body=data.body,
                data=data.data,
            )
        )

    results = await asyncio.gather(*tasks, return_exceptions=True)
    sent = sum(1 for r in results if r is True)

    return {"sent": sent, "total": len(rows)}