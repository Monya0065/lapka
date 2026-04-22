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

APPOINTMENTS_TAGS = ["owner-appointments"]
VISITS_TAGS = ["owner-visits"]
DOCUMENTS_TAGS = ["owner-documents"]
INPATIENT_TAGS = ["owner-inpatient"]
REMINDERS_TAGS = ["owner-reminders"]


@router.get("/appointments", tags=APPOINTMENTS_TAGS)
async def list_owner_appointments(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        pet_links = (
            await db.scalars(
                select(PetOwnerLink).where(PetOwnerLink.user_id == current_user.id)
            )
        ).all()
        pet_ids = [link.pet_id for link in pet_links]
        if not pet_ids:
            return []
        from src.repositories.appointments import list_appointments_by_pet_ids
        return await list_appointments_by_pet_ids(db, pet_ids)
    except Exception:
        return []


@router.post("/appointments", tags=APPOINTMENTS_TAGS, status_code=status.HTTP_201_CREATED)
async def create_owner_appointment(
    pet_id: str,
    vet_id: str,
    clinic_id: str,
    scheduled_at: datetime,
    reason: str | None = None,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from src.repositories.pets import get_pet
    from src.repositories.appointments import create_appointment

    pet_uuid = uuid.UUID(pet_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    pet = await get_pet(db, pet_uuid)
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    appointment = await create_appointment(
        db,
        pet_id=pet_uuid,
        vet_id=uuid.UUID(vet_id),
        clinic_id=uuid.UUID(clinic_id),
        scheduled_at=scheduled_at,
        reason=reason,
        owner_user_id=current_user.id,
    )
    return appointment


@router.get("/pets/{pet_id}/visits", tags=VISITS_TAGS)
async def list_owner_pet_visits(
    pet_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        from src.repositories.visits import list_visits_by_pet_id
        from src.repositories.pets import get_pet

        pet_uuid = uuid.UUID(pet_id)
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
        pet = await get_pet(db, pet_uuid)
        if not pet:
            raise HTTPException(status_code=404, detail="Pet not found")
        return await list_visits_by_pet_id(db, pet_uuid)
    except Exception:
        return []


@router.get("/visits/{visit_id}", tags=VISITS_TAGS)
async def get_owner_visit(
    visit_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from src.repositories.visits import get_visit_by_id
    from src.models import Visit

    visit_uuid = uuid.UUID(visit_id)
    stmt = select(Visit).where(Visit.id == visit_uuid)
    visit = (await db.scalars(stmt)).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=visit.pet_id)
    return await get_visit_by_id(db, visit_uuid)


@router.get("/documents", tags=DOCUMENTS_TAGS)
async def list_owner_documents(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        from src.repositories.documents import list_documents_by_user_id
        return await list_documents_by_user_id(db, current_user.id)
    except Exception:
        return []


@router.post("/documents/upload-metadata", tags=DOCUMENTS_TAGS, status_code=status.HTTP_201_CREATED)
async def upload_document_metadata(
    pet_id: str,
    doc_type: str,
    title: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from src.repositories.documents import create_document_metadata

    pet_uuid = uuid.UUID(pet_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    return await create_document_metadata(
        db,
        pet_id=pet_uuid,
        owner_user_id=current_user.id,
        doc_type=doc_type,
        title=title,
    )


@router.get("/consents", tags=["owner-consents"])
async def list_owner_consents(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        from src.repositories.consents import list_consents_by_user_id
        result = await list_consents_by_user_id(db, current_user.id)
        if result is None:
            return []
        return [{"id": str(r.id), "pet_id": str(r.pet_id), "clinic_id": str(r.clinic_id), "scope": r.scope_level.value if hasattr(r, 'scope_level') else str(r.scope)} for r in result]
    except Exception as e:
        print(f"list_owner_consents error: {e}")
        return []


@router.post("/consents", tags=["owner-consents"], status_code=status.HTTP_201_CREATED)
async def grant_consent(
    pet_id: str,
    clinic_id: str,
    scope: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from src.repositories.consents import create_consent_by_scope

    pet_uuid = uuid.UUID(pet_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    try:
        consent = await create_consent_by_scope(
            db,
            pet_id=pet_uuid,
            owner_user_id=current_user.id,
            clinic_id=uuid.UUID(clinic_id),
            scope=scope,
        )
        await db.commit()
        return {"id": str(consent.id), "pet_id": str(consent.pet_id), "clinic_id": str(consent.clinic_id), "status": "granted"}
    except Exception as e:
        print(f"grant_consent error: {e}")
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to grant consent: {str(e)}")


@router.get("/inpatient", tags=INPATIENT_TAGS)
async def list_owner_inpatient(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        from src.repositories.inpatient import list_inpatient_stays_by_user_id
        return await list_inpatient_stays_by_user_id(db, current_user.id)
    except Exception:
        return []


@router.get("/inpatient/digest", tags=INPATIENT_TAGS)
async def get_owner_inpatient_digest(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        from src.repositories.inpatient import get_inpatient_digest_for_user
        return await get_inpatient_digest_for_user(db, current_user.id)
    except Exception:
        return {"active_count": 0, "total_stays": 0, "recent_stays": []}


@router.get("/reminders", tags=REMINDERS_TAGS)
async def list_owner_reminders(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        from src.repositories.reminders import list_reminders_by_user_id
        return await list_reminders_by_user_id(db, current_user.id)
    except Exception:
        return []


@router.post("/reminders", tags=REMINDERS_TAGS, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    pet_id: str,
    reminder_type: str,
    due_at: datetime,
    title: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    from src.repositories.reminders import create_reminder

    pet_uuid = uuid.UUID(pet_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    return await create_reminder(
        db,
        pet_id=pet_uuid,
        owner_user_id=current_user.id,
        reminder_type=reminder_type,
        due_at=due_at,
        title=title,
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
