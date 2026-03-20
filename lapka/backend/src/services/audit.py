from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.models import AuditEvent


async def log_audit(
    db: AsyncSession,
    *,
    actor_user_id: str | None,
    clinic_id: str | None,
    action: str,
    target_type: str,
    target_id: str | None,
    metadata: dict | None = None,
) -> None:
    event = AuditEvent(
        actor_user_id=actor_user_id,
        clinic_id=clinic_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_json=metadata or {},
    )
    db.add(event)
