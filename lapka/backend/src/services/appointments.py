import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Appointment, AppointmentStatus, Visit, VisitStatus
from src.repositories import (
    count_appointments,
    create_appointment as repo_create_appointment,
    delete_appointment as repo_delete_appointment,
    get_appointment as repo_get_appointment,
    list_appointments,
    list_appointments_for_clinic,
    list_appointments_for_owner,
    update_appointment as repo_update_appointment,
    get_latest_visit_for_pet,
)


class AppointmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_appointment(self, appointment_id: uuid.UUID) -> Appointment:
        appointment = await repo_get_appointment(self.db, appointment_id)
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "APPOINTMENT_NOT_FOUND", "message": "Appointment not found"},
            )
        return appointment

    async def list_my_appointments(
        self,
        *,
        owner_user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Appointment]:
        return await list_appointments_for_owner(
            self.db,
            owner_user_id=owner_user_id,
            limit=limit,
            offset=offset,
        )

    async def list_clinic_appointments(
        self,
        *,
        clinic_id: uuid.UUID,
        days: int = 14,
        limit: int = 100,
    ) -> List[Appointment]:
        from_date = datetime.utcnow()
        to_date = from_date + timedelta(days=days)
        return await list_appointments_for_clinic(
            self.db,
            clinic_id=clinic_id,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
        )

    async def create_appointment(
        self,
        *,
        pet_id: uuid.UUID,
        clinic_id: uuid.UUID,
        vet_id: uuid.UUID,
        scheduled_at: datetime,
        service_type: str,
        **kwargs,
    ) -> Appointment:
        existing = await list_appointments(
            self.db,
            vet_id=vet_id,
            from_date=scheduled_at - timedelta(minutes=60),
            to_date=scheduled_at + timedelta(minutes=60),
            limit=1,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "APPOINTMENT_CONFLICT",
                    "message": "Veterinarian has an appointment within 1 hour of this time",
                },
            )

        appointment = Appointment(
            pet_id=pet_id,
            clinic_id=clinic_id,
            vet_id=vet_id,
            scheduled_at=scheduled_at,
            service_type=service_type,
            **kwargs,
        )
        return await repo_create_appointment(self.db, appointment)

    async def update_appointment_status(
        self,
        appointment_id: uuid.UUID,
        new_status: AppointmentStatus,
    ) -> Appointment:
        appointment = await self.get_appointment(appointment_id)
        appointment.status = new_status

        if new_status == AppointmentStatus.completed:
            visit = await get_latest_visit_for_pet(self.db, pet_id=appointment.pet_id)
            if visit and visit.status == VisitStatus.in_progress:
                visit.status = VisitStatus.completed

        return await repo_update_appointment(self.db, appointment)

    async def cancel_appointment(
        self,
        appointment_id: uuid.UUID,
        reason: str | None = None,
    ) -> Appointment:
        appointment = await self.get_appointment(appointment_id)
        appointment.status = AppointmentStatus.cancelled
        if reason:
            appointment.notes = (appointment.notes or "") + f"\nCancellation: {reason}"
        return await repo_update_appointment(self.db, appointment)

    async def get_clinic_schedule(
        self,
        *,
        clinic_id: uuid.UUID,
        date: datetime,
    ) -> dict:
        from datetime import time
        from src.models import DoctorSchedule

        from sqlalchemy import and_, select

        weekday = date.weekday()
        schedules = await self.db.scalars(
            select(DoctorSchedule).where(
                and_(
                    DoctorSchedule.clinic_id == clinic_id,
                    DoctorSchedule.weekday == weekday,
                    DoctorSchedule.is_active == True,
                )
            )
        )
        schedule_list = list(schedules)

        slots = []
        for schedule in schedule_list:
            start_mins = schedule.start_time.hour * 60 + schedule.start_time.minute
            end_mins = schedule.end_time.hour * 60 + schedule.end_time.minute
            interval = schedule.slot_duration or 30

            current = start_mins
            while current < end_mins:
                hour = current // 60
                minute = current % 60
                slots.append(time(hour, minute))
                current += interval

        return {
            "date": date.date(),
            "available_slots": slots,
            "veterinarians": [s.vet_id for s in schedule_list],
        }