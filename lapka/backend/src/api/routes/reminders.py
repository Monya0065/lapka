from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import Reminder, ReminderType, RoleEnum
from src.security.deps import require_owner_of_pet, require_roles
from src.services.audit import log_audit

router = APIRouter(prefix="/reminders", tags=["reminders"])


class ReminderCreateRequest(BaseModel):
    pet_id: str
    reminder_type: ReminderType
    title: str = Field(min_length=1, max_length=255)
    due_at: datetime
    appointment_id: str | None = None
    remind_before_minutes: int | None = Field(default=None, ge=1, le=10080)
    channel: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=1000)


def _serialize_reminder(row: Reminder) -> dict:
    return {
        "id": str(row.id),
        "pet_id": str(row.pet_id),
        "owner_user_id": str(row.owner_user_id),
        "appointment_id": str(row.appointment_id) if row.appointment_id else None,
        "reminder_type": row.reminder_type,
        "remind_before_minutes": row.remind_before_minutes,
        "channel": row.channel,
        "title": row.title,
        "due_at": row.due_at,
        "notes": row.notes,
        "is_done": row.is_done,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("")
async def list_reminders(
    pet_id: str | None = Query(default=None),
    appointment_id: str | None = Query(default=None),
    reminder_type: ReminderType | None = Query(default=None),
    upcoming_days: int = Query(default=60, ge=1, le=365),
    include_done: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=500),
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    pet_uuid = None
    if pet_id:
        try:
            pet_uuid = uuid.UUID(pet_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": "Invalid pet_id format"},
            ) from exc
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    now = datetime.now(timezone.utc)
    until = now + timedelta(days=upcoming_days)

    query = select(Reminder).where(
        Reminder.owner_user_id == current_user.id,
        Reminder.due_at <= until,
    )
    if pet_uuid:
        query = query.where(Reminder.pet_id == pet_uuid)
    if appointment_id:
        try:
            appointment_uuid = uuid.UUID(appointment_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": "Invalid appointment_id format"},
            ) from exc
        query = query.where(Reminder.appointment_id == appointment_uuid)
    if reminder_type:
        query = query.where(Reminder.reminder_type == reminder_type)
    if not include_done:
        query = query.where(Reminder.is_done.is_(False))

    rows = (await db.scalars(query.order_by(Reminder.due_at.asc()).limit(limit))).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="reminder.list",
        target_type="reminder_collection",
        target_id=str(pet_uuid) if pet_uuid else None,
    )
    await db.commit()
    return [_serialize_reminder(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: ReminderCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_uuid = uuid.UUID(payload.pet_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid pet_id format"},
        ) from exc

    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    appointment_uuid = None
    if payload.appointment_id:
        try:
            appointment_uuid = uuid.UUID(payload.appointment_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": "Invalid appointment_id format"},
            ) from exc

    row = Reminder(
        pet_id=pet_uuid,
        owner_user_id=current_user.id,
        appointment_id=appointment_uuid,
        reminder_type=payload.reminder_type,
        remind_before_minutes=payload.remind_before_minutes,
        channel=payload.channel.strip() if payload.channel else None,
        title=payload.title.strip(),
        due_at=payload.due_at,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="reminder.create",
        target_type="reminder",
        target_id=str(row.id),
        metadata={"type": payload.reminder_type.value},
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_reminder(row)
