from __future__ import annotations

import uuid
from datetime import datetime, timezone
from threading import Lock
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.core.redis_client import get_redis_client
from src.models import (
    ConsentScope,
    Membership,
    MembershipStatus,
    Notification,
    NotificationChannel,
    NotificationType,
    PetOwnerLink,
    RoleEnum,
)
from src.security.deps import enforce_pet_scope, get_current_user, require_clinic_membership, require_owner_of_pet
from src.core.rate_limit import enforce_rate_limit
from src.core.metrics import record_security_event
from src.services.audit import log_audit
from src.services.notifications import create_notification

router = APIRouter(prefix="/messages", tags=["messages"])
_cooldown_lock = Lock()
_last_message_sent_at: dict[str, float] = {}
_ROLE_SEND_POLICY: dict[RoleEnum, dict[str, int]] = {
    RoleEnum.owner: {"limit": 12, "window_sec": 60, "min_interval_sec": 8},
    RoleEnum.vet: {"limit": 30, "window_sec": 60, "min_interval_sec": 3},
    RoleEnum.clinic_admin: {"limit": 24, "window_sec": 60, "min_interval_sec": 4},
    RoleEnum.network_admin: {"limit": 18, "window_sec": 60, "min_interval_sec": 5},
}


class SecureMessageSendRequest(BaseModel):
    pet_id: str
    clinic_id: str | None = None
    visit_id: str | None = None
    priority: str = Field(default="normal")
    template_key: str | None = None
    body: str = Field(min_length=1, max_length=2000)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "BAD_REQUEST", "message": message},
    )


def _serialize_message(row: Notification, current_user_id: uuid.UUID) -> dict:
    metadata = dict(row.metadata_json or {})
    return {
        "id": str(row.id),
        "pet_id": str(row.pet_id) if row.pet_id else None,
        "visit_id": str(row.visit_id) if row.visit_id else metadata.get("visit_id"),
        "body": row.body or "",
        "direction": "outgoing" if str(metadata.get("sender_user_id")) == str(current_user_id) else "incoming",
        "created_at": row.created_at,
        "is_read": row.is_read,
        "sender_role": metadata.get("sender_role"),
        "sender_label": metadata.get("sender_label"),
        "clinic_id": metadata.get("clinic_id"),
        "priority": metadata.get("priority", "normal"),
        "template_key": metadata.get("template_key"),
    }


def _enforce_send_policy(request: Request, *, user_id: uuid.UUID, role: RoleEnum) -> None:
    policy = _ROLE_SEND_POLICY.get(role, {"limit": 12, "window_sec": 60, "min_interval_sec": 8})
    enforce_rate_limit(
        request,
        scope=f"messages.send:{role.value}:{user_id}",
        limit=policy["limit"],
        window_sec=policy["window_sec"],
        message="Too many secure messages. Please wait before sending again.",
    )
    now = time.monotonic()
    key = str(user_id)
    with _cooldown_lock:
        last_sent = _last_message_sent_at.get(key)
        if last_sent is not None:
            delta = now - last_sent
            if delta < policy["min_interval_sec"]:
                wait_sec = max(1, int(policy["min_interval_sec"] - delta))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "code": "COOLDOWN_ACTIVE",
                        "message": f"Message cooldown is active. Try again in {wait_sec}s.",
                    },
                )
        _last_message_sent_at[key] = now


async def _enforce_send_policy_redis(*, user_id: uuid.UUID, role: RoleEnum) -> None:
    policy = _ROLE_SEND_POLICY.get(role, {"limit": 12, "window_sec": 60, "min_interval_sec": 8})
    redis_client = get_redis_client()
    window_key = f"ratelimit:messages:window:{role.value}:{user_id}"
    cooldown_key = f"ratelimit:messages:cooldown:{user_id}"

    window_lua = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current >= limit then
  return -1
end
current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, ttl)
end
return current
"""
    cooldown_lua = """
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
if redis.call('SET', key, '1', 'NX', 'EX', ttl) then
  return 1
end
return 0
"""

    window_status = await redis_client.eval(window_lua, 1, window_key, policy["limit"], policy["window_sec"])
    if int(window_status) == -1:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMITED",
                "message": "Too many secure messages. Please wait before sending again.",
            },
        )

    cooldown_status = await redis_client.eval(cooldown_lua, 1, cooldown_key, policy["min_interval_sec"])
    if int(cooldown_status) != 1:
        ttl_left = await redis_client.ttl(cooldown_key)
        wait_sec = max(1, int(ttl_left if isinstance(ttl_left, int) and ttl_left > 0 else policy["min_interval_sec"]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "COOLDOWN_ACTIVE",
                "message": f"Message cooldown is active. Try again in {wait_sec}s.",
            },
        )


@router.get("")
async def list_messages(
    pet_id: str | None = Query(default=None),
    visit_id: str | None = Query(default=None),
    limit: int = Query(default=150, ge=1, le=300),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    pet_uuid = None
    if pet_id:
        try:
            pet_uuid = uuid.UUID(pet_id)
        except ValueError as exc:
            raise _bad_request("Invalid pet_id format") from exc

    if pet_uuid and current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    visit_uuid = None
    if visit_id:
        try:
            visit_uuid = uuid.UUID(visit_id)
        except ValueError as exc:
            raise _bad_request("Invalid visit_id format") from exc

    rows = (
        await db.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
    ).all()
    filtered = []
    for row in rows:
        meta = dict(row.metadata_json or {})
        if meta.get("kind") != "secure_message":
            continue
        if pet_uuid and row.pet_id != pet_uuid:
            continue
        if visit_uuid and row.visit_id != visit_uuid:
            continue
        filtered.append(row)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="message.list",
        target_type="message_collection",
        target_id=str(pet_uuid) if pet_uuid else None,
    )
    await db.commit()
    return [_serialize_message(row, current_user.id) for row in filtered]


@router.post("", status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: SecureMessageSendRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        await _enforce_send_policy_redis(user_id=current_user.id, role=current_user.role)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        code = str(detail.get("code") or "RATE_LIMITED")
        record_security_event(f"messages.{code.lower()}")
        await log_audit(
            db,
            actor_user_id=str(current_user.id),
            clinic_id=payload.clinic_id,
            action="message.send_blocked",
            target_type="message",
            target_id=None,
            metadata={"reason_code": code, "role": current_user.role.value},
        )
        await db.commit()
        raise
    except Exception:
        try:
            _enforce_send_policy(request, user_id=current_user.id, role=current_user.role)
        except HTTPException as exc:
            detail = exc.detail if isinstance(exc.detail, dict) else {}
            code = str(detail.get("code") or "RATE_LIMITED")
            record_security_event(f"messages.{code.lower()}")
            await log_audit(
                db,
                actor_user_id=str(current_user.id),
                clinic_id=payload.clinic_id,
                action="message.send_blocked",
                target_type="message",
                target_id=None,
                metadata={"reason_code": code, "role": current_user.role.value},
            )
            await db.commit()
            raise
    try:
        pet_uuid = uuid.UUID(payload.pet_id)
    except ValueError as exc:
        raise _bad_request("Invalid pet_id format") from exc

    visit_uuid = None
    if payload.visit_id:
        try:
            visit_uuid = uuid.UUID(payload.visit_id)
        except ValueError as exc:
            raise _bad_request("Invalid visit_id format") from exc

    sender_label = current_user.full_name or current_user.email
    message_body = payload.body.strip()
    if not message_body:
        raise _bad_request("Message body cannot be empty")
    priority = str(payload.priority or "normal").strip().lower()
    if priority not in {"low", "normal", "high"}:
        raise _bad_request("Invalid priority value")

    recipients: list[uuid.UUID] = []
    clinic_uuid: uuid.UUID | None = None
    if current_user.role == RoleEnum.owner:
        if not payload.clinic_id:
            raise _bad_request("clinic_id is required for owner messaging")
        try:
            clinic_uuid = uuid.UUID(payload.clinic_id)
        except ValueError as exc:
            raise _bad_request("Invalid clinic_id format") from exc

        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
        memberships = (
            await db.scalars(
                select(Membership).where(
                    Membership.clinic_id == clinic_uuid,
                    Membership.status == MembershipStatus.active,
                    Membership.role_in_clinic.in_([RoleEnum.vet, RoleEnum.clinic_admin]),
                )
            )
        ).all()
        recipients = [row.user_id for row in memberships]
    elif current_user.role in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        if not payload.clinic_id:
            raise _bad_request("clinic_id is required for clinic messaging")
        try:
            clinic_uuid = uuid.UUID(payload.clinic_id)
        except ValueError as exc:
            raise _bad_request("Invalid clinic_id format") from exc
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=pet_uuid,
            clinic_id=clinic_uuid,
            required_scope=ConsentScope.basic_medical,
        )
        owner_link = await db.scalar(
            select(PetOwnerLink)
            .where(PetOwnerLink.pet_id == pet_uuid)
            .order_by(PetOwnerLink.created_at.asc())
        )
        if owner_link:
            recipients = [owner_link.owner_user_id]
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role is not allowed to send messages"},
        )

    recipients = [recipient for recipient in recipients if recipient != current_user.id]
    if not recipients:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "RECIPIENT_NOT_FOUND", "message": "No recipients available for this message"},
        )

    metadata = {
        "kind": "secure_message",
        "sender_user_id": str(current_user.id),
        "sender_role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        "sender_label": sender_label,
        "clinic_id": str(clinic_uuid) if clinic_uuid else None,
        "priority": priority,
        "template_key": payload.template_key,
    }
    sent = 0
    for recipient_id in recipients:
        await create_notification(
            db,
            user_id=recipient_id,
            pet_id=pet_uuid,
            visit_id=visit_uuid,
            notification_type=NotificationType.inpatient_update,
            channel=NotificationChannel.in_app,
            title="Secure message",
            body=message_body,
            metadata=metadata,
        )
        sent += 1

    # Sender copy for local thread continuity.
    await create_notification(
        db,
        user_id=current_user.id,
        pet_id=pet_uuid,
        visit_id=visit_uuid,
        notification_type=NotificationType.inpatient_update,
        channel=NotificationChannel.in_app,
        title="Secure message",
        body=message_body,
        metadata={**metadata, "self_copy": True},
    )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid) if clinic_uuid else None,
        action="message.send",
        target_type="message",
        target_id=None,
        metadata={"pet_id": str(pet_uuid), "recipients": sent},
    )
    await db.commit()
    return {"status": "sent", "recipients": sent, "sent_at": datetime.now(timezone.utc)}
