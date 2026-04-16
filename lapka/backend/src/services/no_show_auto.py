from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Appointment, AppointmentStatus, AuditEvent
from src.services.audit import log_audit


@dataclass
class AutoRunResult:
    clinic_id: str
    batch_id: str
    applied: int
    skipped_due_cooldown: int
    considered: int
    actions: dict[str, int]


async def run_no_show_auto_for_clinic(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    days: int = 90,
    cooldown_hours: int = 72,
    limit: int = 120,
    dry_run: bool = False,
) -> AutoRunResult:
    since = datetime.now(timezone.utc) - timedelta(days=max(7, min(365, int(days))))
    cooldown_since = datetime.now(timezone.utc) - timedelta(hours=max(1, min(24 * 14, int(cooldown_hours))))
    cap = max(1, min(500, int(limit)))

    rows = (
        await db.execute(
            select(
                Appointment.owner_user_id,
                func.count(Appointment.id).label("total"),
                func.sum(case((Appointment.status == AppointmentStatus.no_show, 1), else_=0)).label("no_show"),
            )
            .where(
                Appointment.clinic_id == clinic_id,
                Appointment.start_at >= since,
                Appointment.owner_user_id.is_not(None),
            )
            .group_by(Appointment.owner_user_id)
        )
    ).all()

    cooldown_rows = (
        await db.scalars(
            select(AuditEvent).where(
                AuditEvent.clinic_id == clinic_id,
                AuditEvent.action == "analytics.no_show_risk.action",
                AuditEvent.created_at >= cooldown_since,
            )
        )
    ).all()
    cooldown_pairs = {
        (str(row.target_id or ""), str((row.metadata_json or {}).get("action") or "").strip().lower())
        for row in cooldown_rows
    }

    planned: list[tuple[str, str, str]] = []
    skipped_due_cooldown = 0
    actions_count = {"call_owner": 0, "soft_reminder": 0}
    for owner_user_id, total, no_show in rows:
        total_i = int(total or 0)
        no_show_i = int(no_show or 0)
        if total_i <= 0:
            continue
        rate = no_show_i / total_i
        action = ""
        segment = "low"
        if rate >= 0.4 or no_show_i >= 3:
            action = "call_owner"
            segment = "high"
        elif rate >= 0.2 or no_show_i >= 2:
            action = "soft_reminder"
            segment = "medium"
        if not action:
            continue

        owner_id = str(owner_user_id)
        if (owner_id, action) in cooldown_pairs:
            skipped_due_cooldown += 1
            continue
        planned.append((owner_id, action, segment))
        actions_count[action] = actions_count.get(action, 0) + 1
        if len(planned) >= cap:
            break

    batch_id = str(uuid.uuid4())
    if not dry_run:
        for owner_id, action, segment in planned:
            await log_audit(
                db,
                actor_user_id=None,
                clinic_id=str(clinic_id),
                action="analytics.no_show_risk.action",
                target_type="owner",
                target_id=owner_id,
                metadata={
                    "action": action,
                    "note": "auto_nightly_campaign",
                    "batch": True,
                    "segment": segment,
                    "batch_id": batch_id,
                    "auto": True,
                },
            )
        await log_audit(
            db,
            actor_user_id=None,
            clinic_id=str(clinic_id),
            action="analytics.no_show_risk.batch.auto",
            target_type="batch",
            target_id=batch_id,
            metadata={
                "applied": len(planned),
                "skipped_due_cooldown": skipped_due_cooldown,
                "considered": len(rows),
                "days": days,
                "cooldown_hours": cooldown_hours,
                "limit": cap,
                "actions": actions_count,
            },
        )
        await db.commit()

    return AutoRunResult(
        clinic_id=str(clinic_id),
        batch_id=batch_id,
        applied=len(planned),
        skipped_due_cooldown=skipped_due_cooldown,
        considered=len(rows),
        actions=actions_count,
    )
