from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Appointment,
    AppointmentStatus,
    AppointmentType,
    Clinic,
    ClinicSchedulerSettings,
    DoctorSchedule,
    MasterPet,
    Membership,
    MembershipStatus,
    NotificationChannel,
    NotificationType,
    PetOwnerLink,
    Reminder,
    ReminderType,
    RoleEnum,
    Service,
    User,
)
from src.services.notifications import create_notification
from src.services.audit import log_audit

router = APIRouter(prefix="/public/booking", tags=["public-booking"])


class BookingOwnerCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=128)
    email: EmailStr
    phone: str = Field(min_length=10, max_length=20)


class BookingPetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    species: str = Field(default="dog", max_length=32)
    breed: str | None = Field(default=None, max_length=64)


class BookingRequest(BaseModel):
    owner: BookingOwnerCreate
    pet: BookingPetCreate
    service_id: str | None = None
    appointment_type_id: str | None = None
    vet_id: str | None = None
    start_at: datetime
    notes: str | None = None


class BookingResponse(BaseModel):
    appointment_id: str
    clinic_name: str
    service_name: str
    vet_name: str
    start_at: datetime
    duration_minutes: int
    status: str


class AvailableSlot(BaseModel):
    start_at: datetime
    end_at: datetime
    vet_id: str
    vet_name: str
    duration_minutes: int


class ServiceInfo(BaseModel):
    id: str
    name: str
    price: int
    duration_minutes: int
    description: str | None = None


class VetInfo(BaseModel):
    id: str
    full_name: str
    specialization: str | None = None


@router.get("/{clinic_id}/services", response_model=list[ServiceInfo])
async def get_public_services(
    clinic_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[ServiceInfo]:
    """Get available services for online booking (public endpoint)."""
    clinic = await db.get(Clinic, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="CLINIC_NOT_FOUND")

    services = await db.scalars(
        select(Service).where(
            Service.clinic_id == clinic.id,
            Service.is_active == True,
        )
    )
    return [
        ServiceInfo(
            id=str(s.id),
            name=s.name,
            price=s.price or 0,
            duration_minutes=s.duration_min or 30,
            description=None,
        )
        for s in services.all()
    ]


@router.get("/{clinic_id}/vets", response_model=list[VetInfo])
async def get_public_vets(
    clinic_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[VetInfo]:
    """Get available veterinarians for online booking (public endpoint)."""
    clinic = await db.get(Clinic, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="CLINIC_NOT_FOUND")

    memberships = await db.scalars(
        select(Membership).where(
            Membership.clinic_id == clinic.id,
            Membership.role == RoleEnum.vet,
            Membership.status == MembershipStatus.active,
        )
    )
    vet_ids = [m.user_id for m in memberships.all()]
    if not vet_ids:
        return []

    users = await db.scalars(select(User).where(User.id.in_(vet_ids)))
    return [
        VetInfo(
            id=str(u.id),
            full_name=u.full_name or u.email,
            specialization=u.specialization,
        )
        for u in users.all()
    ]


@router.get("/{clinic_id}/slots", response_model=list[AvailableSlot])
async def get_public_slots(
    clinic_id: str,
    target_date: date = Query(...),
    appointment_type_id: str | None = Query(None),
    vet_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db_session),
) -> list[AvailableSlot]:
    """Get available time slots for a specific date (public endpoint)."""
    clinic = await db.get(Clinic, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="CLINIC_NOT_FOUND")

    # Get scheduler settings
    settings = await db.scalar(
        select(ClinicSchedulerSettings).where(ClinicSchedulerSettings.clinic_id == clinic.id)
    )
    day_start = settings.default_day_start_hour if settings else 9
    day_end = settings.default_day_end_hour if settings else 18
    slot_duration = settings.default_slot_duration_minutes if settings else 30

    # Get appointment type duration if specified
    if appointment_type_id:
        apt_type = await db.get(AppointmentType, uuid.UUID(appointment_type_id))
        if apt_type:
            slot_duration = apt_type.default_duration_minutes

    # Get doctors working on this weekday
    weekday = target_date.weekday()
    schedules = await db.scalars(
        select(DoctorSchedule).where(
            DoctorSchedule.clinic_id == clinic.id,
            DoctorSchedule.weekday == weekday,
            DoctorSchedule.is_active == True,
        )
    )
    schedule_list = schedules.all()

    if vet_id:
        schedule_list = [s for s in schedule_list if str(s.vet_id) == vet_id]

    if not schedule_list:
        return []

    # Get existing appointments for this date
    start_of_day = datetime.combine(target_date, time(0, 0), tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    existing = await db.scalars(
        select(Appointment).where(
            Appointment.clinic_id == clinic.id,
            Appointment.start_at >= start_of_day,
            Appointment.start_at < end_of_day,
            Appointment.status.in_([
                AppointmentStatus.scheduled,
                AppointmentStatus.confirmed,
                AppointmentStatus.in_progress,
                AppointmentStatus.new,
                AppointmentStatus.waiting,
            ]),
        )
    )
    booked = {a.start_at: a.vet_id for a in existing.all()}

    # Get vet names
    vet_ids = [s.vet_id for s in schedule_list]
    vets = await db.scalars(select(User).where(User.id.in_(vet_ids)))
    vet_names = {v.id: v.full_name or v.email for v in vets.all()}

    # Generate available slots
    slots = []
    for schedule in schedule_list:
        vet_name = vet_names.get(schedule.vet_id, "Unknown")
        current = datetime.combine(target_date, schedule.start_time, tzinfo=timezone.utc)
        end_time = datetime.combine(target_date, schedule.end_time, tzinfo=timezone.utc)

        while current + timedelta(minutes=slot_duration) <= end_time:
            if current not in booked or booked[current] != schedule.vet_id:
                slots.append(AvailableSlot(
                    start_at=current,
                    end_at=current + timedelta(minutes=slot_duration),
                    vet_id=str(schedule.vet_id),
                    vet_name=vet_name,
                    duration_minutes=slot_duration,
                ))
            current += timedelta(minutes=schedule.slot_duration or slot_duration)

    return sorted(slots, key=lambda s: s.start_at)


@router.post("/{clinic_id}/book", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_public_booking(
    clinic_id: str,
    payload: BookingRequest,
    db: AsyncSession = Depends(get_db_session),
) -> BookingResponse:
    """Create a new appointment via public booking (no auth required)."""
    clinic = await db.get(Clinic, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="CLINIC_NOT_FOUND")

    # Get service or appointment type info
    service_name = "Консультация"
    duration_minutes = 30

    if payload.service_id:
        service = await db.get(Service, uuid.UUID(payload.service_id))
        if service:
            service_name = service.name
            duration_minutes = service.duration_min or 30

    if payload.appointment_type_id:
        apt_type = await db.get(AppointmentType, uuid.UUID(payload.appointment_type_id))
        if apt_type:
            service_name = apt_type.name
            duration_minutes = apt_type.default_duration_minutes

    # Validate vet
    vet_id = None
    vet_name = "Любой врач"
    if payload.vet_id:
        vet = await db.get(User, uuid.UUID(payload.vet_id))
        if not vet:
            raise HTTPException(status_code=404, detail="VET_NOT_FOUND")
        vet_id = vet.id
        vet_name = vet.full_name or vet.email

        # Check vet membership
        membership = await db.scalar(
            select(Membership).where(
                Membership.clinic_id == clinic.id,
                Membership.user_id == vet.id,
                Membership.role_in_clinic == RoleEnum.vet,
                Membership.status == MembershipStatus.active,
            )
        )
        if not membership:
            raise HTTPException(status_code=404, detail="VET_NOT_IN_CLINIC")

    if not vet_id:
        # Find first available vet
        membership = await db.scalar(
            select(Membership).where(
                Membership.clinic_id == clinic.id,
                Membership.role_in_clinic == RoleEnum.vet,
                Membership.status == MembershipStatus.active,
            )
        )
        if membership:
            vet_id = membership.user_id
            vet_user = await db.get(User, vet_id)
            vet_name = vet_user.full_name or vet_user.email if vet_user else "Unknown"

    if not vet_id:
        raise HTTPException(status_code=400, detail="NO_AVAILABLE_VET")

    # Check slot availability
    existing = await db.scalar(
        select(Appointment).where(
            Appointment.vet_id == vet_id,
            Appointment.start_at == payload.start_at,
            Appointment.status.in_([
                AppointmentStatus.scheduled,
                AppointmentStatus.confirmed,
                AppointmentStatus.in_progress,
                AppointmentStatus.new,
                AppointmentStatus.waiting,
            ]),
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="SLOT_TAKEN")

    # Find or create owner user
    owner = await db.scalar(select(User).where(User.email == payload.owner.email))
    if not owner:
        owner = User(
            id=uuid.uuid4(),
            email=payload.owner.email,
            full_name=payload.owner.full_name,
            phone=payload.owner.phone,
            role=RoleEnum.owner,
            password_hash="public_booking_no_password",
            is_active=True,
        )
        db.add(owner)
        await db.flush()

    # Find or create pet
    pet = await db.scalar(
        select(MasterPet).join(PetOwnerLink).where(
            PetOwnerLink.owner_user_id == owner.id,
            MasterPet.name == payload.pet.name,
        )
    )
    if not pet:
        pet = MasterPet(
            id=uuid.uuid4(),
            lapka_id=f"PUB-{uuid.uuid4().hex[:8].upper()}",
            name=payload.pet.name,
            species=payload.pet.species,
            breed=payload.pet.breed,
        )
        db.add(pet)
        await db.flush()

        link = PetOwnerLink(
            pet_id=pet.id,
            owner_user_id=owner.id,
        )
        db.add(link)
        await db.flush()

    # Create appointment
    appointment = Appointment(
        id=uuid.uuid4(),
        clinic_id=clinic.id,
        pet_id=pet.id,
        owner_user_id=owner.id,
        vet_id=vet_id,
        service_name=service_name,
        service_type=service_name,
        start_at=payload.start_at,
        duration_minutes=duration_minutes,
        status=AppointmentStatus.scheduled,
        notes=payload.notes,
    )
    db.add(appointment)

    # Create reminder
    reminder = Reminder(
        id=uuid.uuid4(),
        pet_id=pet.id,
        owner_user_id=owner.id,
        appointment_id=appointment.id,
        reminder_type=ReminderType.checkup,
        remind_before_minutes=60,
        title=f"Напоминание о приёме: {service_name}",
        due_at=payload.start_at - timedelta(hours=1),
        notes=f"Приём в {clinic.name}",
    )
    db.add(reminder)
    await db.flush()

    await db.commit()

    # Create notification
    await create_notification(
        db,
        user_id=owner.id,
        title="Запись подтверждена",
        body=f"Вы записаны на {service_name} к {vet_name} в {payload.start_at.strftime('%d.%m.%Y %H:%M')}",
        notification_type=NotificationType.appointment_confirmed,
        channel=NotificationChannel.in_app,
        pet_id=pet.id,
        appointment_id=appointment.id,
    )

    return BookingResponse(
        appointment_id=str(appointment.id),
        clinic_name=clinic.name,
        service_name=service_name,
        vet_name=vet_name,
        start_at=payload.start_at,
        duration_minutes=duration_minutes,
        status="scheduled",
    )


@router.get("/{clinic_id}/appointments/{appointment_id}", response_model=BookingResponse)
async def get_public_appointment(
    clinic_id: str,
    appointment_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> BookingResponse:
    """Get appointment status (public endpoint)."""
    clinic = await db.get(Clinic, uuid.UUID(clinic_id))
    if not clinic:
        raise HTTPException(status_code=404, detail="CLINIC_NOT_FOUND")

    appointment = await db.get(Appointment, uuid.UUID(appointment_id))
    if not appointment or str(appointment.clinic_id) != clinic_id:
        raise HTTPException(status_code=404, detail="APPOINTMENT_NOT_FOUND")

    vet = await db.get(User, appointment.vet_id)
    vet_name = vet.full_name or vet.email if vet else "Unknown"

    return BookingResponse(
        appointment_id=str(appointment.id),
        clinic_name=clinic.name,
        service_name=appointment.service_name,
        vet_name=vet_name,
        start_at=appointment.start_at,
        duration_minutes=appointment.duration_minutes,
        status=appointment.status.value,
    )
