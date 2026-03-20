from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.security.deps import get_current_user
from src.services.audit import log_audit
from src.services.notifications import list_user_notifications, mark_notifications_read

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationMarkReadRequest(BaseModel):
    notification_ids: list[str] = Field(default_factory=list)
    mark_all: bool = False


def _serialize_notification(row) -> dict:
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "pet_id": str(row.pet_id) if row.pet_id else None,
        "appointment_id": str(row.appointment_id) if row.appointment_id else None,
        "visit_id": str(row.visit_id) if row.visit_id else None,
        "notification_type": row.notification_type.value if hasattr(row.notification_type, "value") else str(row.notification_type),
        "channel": row.channel.value if hasattr(row.channel, "value") else str(row.channel),
        "title": row.title,
        "body": row.body,
        "metadata": row.metadata_json or {},
        "is_read": row.is_read,
        "read_at": row.read_at,
        "created_at": row.created_at,
    }


@router.get("")
async def get_notifications(
    limit: int = Query(default=50, ge=1, le=300),
    unread_only: bool = Query(default=False),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    rows = await list_user_notifications(
        db,
        user_id=current_user.id,
        limit=limit,
        unread_only=unread_only,
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="notification.list",
        target_type="notification_collection",
        target_id=None,
    )
    await db.commit()
    return [_serialize_notification(row) for row in rows]


@router.post("/mark-read")
async def mark_read(
    payload: NotificationMarkReadRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    notification_ids: list[uuid.UUID] = []
    for raw in payload.notification_ids:
        try:
            notification_ids.append(uuid.UUID(raw))
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": f"Invalid notification id: {raw}"},
            ) from exc

    if not payload.mark_all and not notification_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Provide notification_ids or mark_all=true"},
        )

    marked = await mark_notifications_read(
        db,
        user_id=current_user.id,
        notification_ids=notification_ids,
        mark_all=payload.mark_all,
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="notification.mark_read",
        target_type="notification_collection",
        target_id=None,
        metadata={"count": marked, "mark_all": payload.mark_all},
    )
    await db.commit()
    return {"status": "ok", "marked": marked}
