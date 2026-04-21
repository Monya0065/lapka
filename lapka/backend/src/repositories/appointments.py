import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Appointment, AppointmentStatus, PetOwnerLink, Membership, MembershipStatus


async def get_appointment(db: AsyncSession, appointment_id: uuid.UUID) -> Appointment | None:
    return await db.scalar(select(Appointment).where(Appointment.id == appointment_id))


async def list_appointments(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID | None = None,
    clinic_id: uuid.UUID | None = None,
    vet_id: uuid.UUID | None = None,
    owner_user_id: uuid.UUID | None = None,
    status: AppointmentStatus | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Appointment]:
    conditions = []
    
    if pet_id:
        conditions.append(Appointment.pet_id == pet_id)
    if clinic_id:
        conditions.append(Appointment.clinic_id == clinic_id)
    if vet_id:
        conditions.append(Appointment.vet_id == vet_id)
    if owner_user_id:
        conditions.append(Appointment.owner_user_id == owner_user_id)
    if status:
        conditions.append(Appointment.status == status)
    if from_date:
        conditions.append(Appointment.scheduled_at >= from_date)
    if to_date:
        conditions.append(Appointment.scheduled_at <= to_date)
    
    query = select(Appointment).order_by(Appointment.scheduled_at.desc())
    
    if conditions:
        query = query.where(and_(*conditions))
    
    query = query.limit(limit).offset(offset)
    return list((await db.scalars(query)).all())


async def list_appointments_for_owner(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    limit: int = 100,
    offset: int = 0,
) -> List[Appointment]:
    pet_ids_subquery = (
        select(PetOwnerLink.pet_id)
        .where(PetOwnerLink.user_id == owner_user_id)
    )
    query = (
        select(Appointment)
        .where(Appointment.pet_id.in_(pet_ids_subquery))
        .order_by(Appointment.scheduled_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def list_appointments_for_clinic(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Appointment]:
    conditions = [Appointment.clinic_id == clinic_id]
    
    if from_date:
        conditions.append(Appointment.scheduled_at >= from_date)
    if to_date:
        conditions.append(Appointment.scheduled_at <= to_date)
    
    query = (
        select(Appointment)
        .where(and_(*conditions))
        .order_by(Appointment.scheduled_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.scalars(query)).all())


async def count_appointments(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID | None = None,
    status: AppointmentStatus | None = None,
) -> int:
    conditions = []
    if clinic_id:
        conditions.append(Appointment.clinic_id == clinic_id)
    if status:
        conditions.append(Appointment.status == status)
    
    query = select(func.count(Appointment.id))
    if conditions:
        query = query.where(and_(*conditions))
    
    return int((await db.scalar(query)) or 0)


async def create_appointment(db: AsyncSession, appointment: Appointment) -> Appointment:
    db.add(appointment)
    await db.flush()
    await db.refresh(appointment)
    return appointment


async def update_appointment(db: AsyncSession, appointment: Appointment) -> Appointment:
    await db.flush()
    await db.refresh(appointment)
    return appointment


async def delete_appointment(db: AsyncSession, appointment: Appointment) -> None:
    await db.delete(appointment)
    await db.flush()


async def get_upcoming_appointments_for_clinic(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    days: int = 14,
    limit: int = 50,
) -> List[Appointment]:
    from datetime import timedelta
    now = datetime.utcnow()
    end_date = now + timedelta(days=days)
    
    query = (
        select(Appointment)
        .where(
            and_(
                Appointment.clinic_id == clinic_id,
                Appointment.scheduled_at >= now,
                Appointment.scheduled_at <= end_date,
                Appointment.status.in_([
                    AppointmentStatus.scheduled,
                    AppointmentStatus.confirmed,
                    AppointmentStatus.new,
                ]),
            )
        )
        .order_by(Appointment.scheduled_at.asc())
        .limit(limit)
    )
    return list((await db.scalars(query)).all())