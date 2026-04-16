from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import Appointment, MasterPet, PetOwnerLink, Reminder, RoleEnum, VaccineEntry
from src.security.deps import get_current_user, require_current_legal_ack, require_owner_of_pet, require_roles
from src.services.audit import log_audit

router = APIRouter(
    prefix="/owner",
    tags=["owner-care"],
    dependencies=[Depends(require_current_legal_ack)],
)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "BAD_REQUEST", "message": message},
    )


def _format_task(title: str, due_at: datetime | None, source: str, pet_id: uuid.UUID | None = None) -> dict:
    return {
        "title": title,
        "due_at": due_at,
        "source": source,
        "pet_id": str(pet_id) if pet_id else None,
    }


@router.get("/care-plan")
async def owner_care_plan(
    pet_id: str | None = Query(default=None),
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pet_uuid: uuid.UUID | None = None
    if pet_id:
        try:
            pet_uuid = uuid.UUID(pet_id)
        except ValueError as exc:
            raise _bad_request("Invalid pet_id format") from exc
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    now = datetime.now(timezone.utc)
    today_end = now + timedelta(days=1)
    week_end = now + timedelta(days=7)
    month_end = now + timedelta(days=30)

    owned_pet_ids = (
        [pet_uuid]
        if pet_uuid
        else list(
            (await db.scalars(select(PetOwnerLink.pet_id).where(PetOwnerLink.owner_user_id == current_user.id))).all()
        )
    )
    if not owned_pet_ids:
        return {"today": [], "week": [], "month": [], "upcoming": [], "overdue_count": 0, "risk_level": "low"}

    reminders = (
        await db.scalars(
            select(Reminder)
            .where(
                Reminder.owner_user_id == current_user.id,
                Reminder.pet_id.in_(owned_pet_ids),
            )
            .order_by(Reminder.due_at.asc())
            .limit(500)
        )
    ).all()
    vaccines = (
        await db.scalars(
            select(VaccineEntry)
            .where(VaccineEntry.pet_id.in_(owned_pet_ids))
            .order_by(VaccineEntry.next_due_date.asc())
            .limit(500)
        )
    ).all()

    today: list[dict] = []
    week: list[dict] = []
    month: list[dict] = []
    upcoming: list[dict] = []
    overdue_count = 0

    for row in reminders:
        due_at = row.due_at
        title = row.title or "Напоминание"
        task = _format_task(title, due_at, "reminder", row.pet_id)
        if due_at and due_at < now and not row.is_done:
            overdue_count += 1
        if due_at and due_at <= today_end:
            today.append(task)
        elif due_at and due_at <= week_end:
            week.append(task)
        elif due_at and due_at <= month_end:
            month.append(task)
        if due_at and due_at >= now:
            upcoming.append(task)

    for row in vaccines:
        if not row.next_due_date:
            continue
        task = _format_task(
            f"Вакцина: {row.vaccine_name or 'плановая вакцинация'}",
            row.next_due_date,
            "vaccine",
            row.pet_id,
        )
        if row.next_due_date < now:
            overdue_count += 1
        if row.next_due_date <= today_end:
            today.append(task)
        elif row.next_due_date <= week_end:
            week.append(task)
        elif row.next_due_date <= month_end:
            month.append(task)
        if row.next_due_date >= now:
            upcoming.append(task)

    risk_level = "low"
    if overdue_count >= 5:
        risk_level = "high"
    elif overdue_count >= 2:
        risk_level = "medium"

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="owner.care_plan.view",
        target_type="pet" if pet_uuid else "pet_collection",
        target_id=str(pet_uuid) if pet_uuid else None,
    )
    await db.commit()

    pets_payload = (
        await db.scalars(
            select(MasterPet)
            .where(MasterPet.id.in_(owned_pet_ids))
            .order_by(MasterPet.name.asc())
        )
    ).all()
    return {
        "today": today[:20],
        "week": week[:20],
        "month": month[:20],
        "upcoming": sorted(upcoming, key=lambda row: row.get("due_at") or now)[:30],
        "overdue_count": overdue_count,
        "risk_level": risk_level,
        "pets": [{"id": str(row.id), "name": row.name, "species": row.species, "breed": row.breed} for row in pets_payload],
    }
