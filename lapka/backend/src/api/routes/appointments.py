from __future__ import annotations

import secrets
import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Appointment,
    AppointmentStatus,
    AppointmentType,
    ClinicLocation,
    ClinicResource,
    ClinicSchedulerSettings,
    ConsentScope,
    DoctorSchedule,
    Membership,
    MembershipStatus,
    NotificationType,
    PetOwnerLink,
    Reminder,
    ReminderType,
    RoleEnum,
    Service,
    Visit,
    VisitStatus,
)
from src.security.deps import (
    enforce_pet_scope,
    get_current_user,
    require_clinic_membership,
    require_owner_of_pet,
    get_clinic_context,
)
from src.services.audit import log_audit
from src.services.notifications import create_notification
from src.models import NotificationChannel

router = APIRouter(prefix="/appointments", tags=["appointments"])

ACTIVE_STATUSES = {
    AppointmentStatus.scheduled,
    AppointmentStatus.confirmed,
    AppointmentStatus.in_progress,
    AppointmentStatus.new,
    AppointmentStatus.waiting,
}

TERMINAL_STATUSES = {
    AppointmentStatus.completed,
    AppointmentStatus.cancelled,
    AppointmentStatus.no_show,
}

DEFAULT_SCHEDULER_SETTINGS = {
    "default_buffer_minutes": 10,
    "day_start_hour": 8,
    "day_end_hour": 21,
    "slot_interval_minutes": 30,
}


class AppointmentTypeCreateRequest(BaseModel):
    clinic_id: str
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=128)
    default_duration_minutes: int = Field(default=30, ge=10, le=240)
    is_telemedicine: bool = False


class AppointmentTypePatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    default_duration_minutes: int | None = Field(default=None, ge=10, le=240)
    is_telemedicine: bool | None = None
    is_active: bool | None = None


class DoctorScheduleCreateRequest(BaseModel):
    clinic_id: str
    vet_id: str
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    slot_duration: int = Field(default=30, ge=10, le=180)


class DoctorSchedulePatchRequest(BaseModel):
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    slot_duration: int | None = Field(default=None, ge=10, le=180)
    is_active: bool | None = None


class ClinicResourceCreateRequest(BaseModel):
    clinic_id: str
    clinic_location_id: str | None = None
    name: str = Field(min_length=2, max_length=128)
    code: str | None = Field(default=None, max_length=64)
    resource_type: str = Field(default="room", min_length=2, max_length=32)
    capacity: int = Field(default=1, ge=1, le=20)
    is_active: bool = True


class ClinicResourcePatchRequest(BaseModel):
    clinic_location_id: str | None = None
    name: str | None = Field(default=None, min_length=2, max_length=128)
    code: str | None = Field(default=None, max_length=64)
    resource_type: str | None = Field(default=None, min_length=2, max_length=32)
    capacity: int | None = Field(default=None, ge=1, le=20)
    is_active: bool | None = None


class ClinicSchedulerSettingsPatchRequest(BaseModel):
    clinic_id: str
    clinic_location_id: str | None = None
    default_buffer_minutes: int | None = Field(default=None, ge=0, le=180)
    day_start_hour: int | None = Field(default=None, ge=0, le=23)
    day_end_hour: int | None = Field(default=None, ge=1, le=24)
    slot_interval_minutes: int | None = Field(default=None, ge=10, le=180)


class AppointmentCreateRequest(BaseModel):
    clinic_id: str | None = None
    pet_id: str
    owner_user_id: str | None = None
    vet_id: str
    clinic_location_id: str | None = None
    clinic_resource_id: str | None = None
    appointment_type_id: str | None = None
    service_type: str = Field(min_length=2, max_length=128)
    scheduled_at: datetime
    duration_minutes: int | None = Field(default=None, ge=10, le=240)
    buffer_minutes: int | None = Field(default=None, ge=0, le=180)
    room_label: str | None = Field(default=None, max_length=128)
    visit_type: str = Field(default="clinic_visit", pattern="^(clinic_visit|video_consultation)$")
    flow_stage: str | None = Field(default=None, pattern="^(scheduled|arrived|waiting|in_consult|diagnostics|inpatient|ready_for_discharge|follow_up|completed)$")
    urgency_level: str | None = Field(default=None, pattern="^(routine|watch|urgent)$")
    protocol_status: str | None = Field(default=None, pattern="^(not_started|draft|ready|signed)$")
    discharge_ready: bool = False
    status: AppointmentStatus = AppointmentStatus.scheduled
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentPatchRequest(BaseModel):
    vet_id: str | None = None
    clinic_location_id: str | None = None
    clinic_resource_id: str | None = None
    appointment_type_id: str | None = None
    service_type: str | None = Field(default=None, min_length=2, max_length=128)
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=240)
    buffer_minutes: int | None = Field(default=None, ge=0, le=180)
    room_label: str | None = Field(default=None, max_length=128)
    visit_type: str | None = Field(default=None, pattern="^(clinic_visit|video_consultation)$")
    flow_stage: str | None = Field(default=None, pattern="^(scheduled|arrived|waiting|in_consult|diagnostics|inpatient|ready_for_discharge|follow_up|completed)$")
    urgency_level: str | None = Field(default=None, pattern="^(routine|watch|urgent)$")
    protocol_status: str | None = Field(default=None, pattern="^(not_started|draft|ready|signed)$")
    discharge_ready: bool | None = None
    status: AppointmentStatus | None = None
    notes: str | None = Field(default=None, max_length=2000)


class AppointmentStatusChangeRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=2000)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": message})


def _forbidden(message: str = "No access") -> HTTPException:
    return HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": message})


def _not_found(message: str = "Not found") -> HTTPException:
    return HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": message})


def _serialize_appointment_type(row: AppointmentType) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "code": row.code,
        "name": row.name,
        "default_duration_minutes": row.default_duration_minutes,
        "is_telemedicine": row.is_telemedicine,
        "is_active": row.is_active,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_schedule(row: DoctorSchedule) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "vet_id": str(row.vet_id),
        "weekday": row.weekday,
        "start_time": row.start_time.isoformat(timespec="minutes"),
        "end_time": row.end_time.isoformat(timespec="minutes"),
        "slot_duration": row.slot_duration,
        "is_active": row.is_active,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _resource_type_label(value: str | None) -> str:
    labels = {
        "room": "Кабинет",
        "diagnostics": "Диагностика",
        "procedure": "Процедурная",
        "telemedicine": "Телемедицина",
        "telemedicine_room": "Телемедицинская комната",
        "imaging": "Диагностика",
        "ultrasound": "УЗИ",
        "xray": "Рентген",
        "surgery": "Операционная",
        "lab": "Лаборатория",
        "icu": "Интенсивная терапия",
        "inpatient": "Стационар",
        "other": "Ресурс",
    }
    return labels.get(str(value or ""), str(value or "Ресурс"))


def _serialize_resource(row: ClinicResource) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "clinic_location_id": str(row.clinic_location_id) if row.clinic_location_id else None,
        "name": row.name,
        "code": row.code,
        "resource_type": row.resource_type,
        "resource_type_label": _resource_type_label(row.resource_type),
        "capacity": int(row.capacity or 1),
        "is_active": bool(row.is_active),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_scheduler_settings(
    *,
    clinic_uuid: uuid.UUID,
    location_uuid: uuid.UUID | None,
    clinic_defaults: ClinicSchedulerSettings | None,
    scoped_override: ClinicSchedulerSettings | None,
) -> dict:
    merged = dict(DEFAULT_SCHEDULER_SETTINGS)
    if clinic_defaults:
        merged.update(
            default_buffer_minutes=int(clinic_defaults.default_buffer_minutes or DEFAULT_SCHEDULER_SETTINGS["default_buffer_minutes"]),
            day_start_hour=int(clinic_defaults.day_start_hour or DEFAULT_SCHEDULER_SETTINGS["day_start_hour"]),
            day_end_hour=int(clinic_defaults.day_end_hour or DEFAULT_SCHEDULER_SETTINGS["day_end_hour"]),
            slot_interval_minutes=int(clinic_defaults.slot_interval_minutes or DEFAULT_SCHEDULER_SETTINGS["slot_interval_minutes"]),
        )
    if scoped_override:
        merged.update(
            default_buffer_minutes=int(scoped_override.default_buffer_minutes or merged["default_buffer_minutes"]),
            day_start_hour=int(scoped_override.day_start_hour or merged["day_start_hour"]),
            day_end_hour=int(scoped_override.day_end_hour or merged["day_end_hour"]),
            slot_interval_minutes=int(scoped_override.slot_interval_minutes or merged["slot_interval_minutes"]),
        )
    source = "defaults"
    if clinic_defaults and scoped_override:
        source = "branch_override"
    elif scoped_override:
        source = "branch_override"
    elif clinic_defaults:
        source = "clinic_default"

    return {
        "clinic_id": str(clinic_uuid),
        "clinic_location_id": str(location_uuid) if location_uuid else None,
        "default_buffer_minutes": merged["default_buffer_minutes"],
        "day_start_hour": merged["day_start_hour"],
        "day_end_hour": merged["day_end_hour"],
        "slot_interval_minutes": merged["slot_interval_minutes"],
        "source": source,
        "clinic_default_id": str(clinic_defaults.id) if clinic_defaults else None,
        "scope_override_id": str(scoped_override.id) if scoped_override else None,
    }


def _normalize_status(value: AppointmentStatus | str) -> str:
    return value.value if isinstance(value, AppointmentStatus) else str(value)


def _is_active_status(value: AppointmentStatus | str) -> bool:
    normalized = _normalize_status(value)
    return normalized in {status.value for status in ACTIVE_STATUSES}


def _default_flow_stage_for_status(value: AppointmentStatus | str) -> str:
    normalized = _normalize_status(value)
    mapping = {
        "confirmed": "arrived",
        "waiting": "waiting",
        "in_progress": "in_consult",
        "completed": "completed",
        "cancelled": "completed",
        "no_show": "completed",
        "new": "scheduled",
        "scheduled": "scheduled",
    }
    return mapping.get(normalized, "scheduled")


def _flow_stage_for_appointment(row: Appointment) -> str:
    return row.flow_stage or _default_flow_stage_for_status(row.status)


def _appointment_end_with_buffer(row: Appointment, fallback_buffer: int = 0) -> datetime:
    duration_minutes = max(10, int(row.duration_minutes or 30))
    buffer_minutes = max(0, int(row.buffer_minutes if row.buffer_minutes is not None else fallback_buffer))
    return row.start_at + timedelta(minutes=duration_minutes + buffer_minutes)


def _peak_parallel_appointments(rows: list[Appointment], fallback_buffer: int = 0) -> int:
    if not rows:
        return 0
    events: list[tuple[datetime, int]] = []
    for row in rows:
        start_at = row.start_at
        end_at = _appointment_end_with_buffer(row, fallback_buffer)
        events.append((start_at, 1))
        events.append((end_at, -1))
    events.sort(key=lambda item: (item[0], item[1]))

    peak = 0
    active = 0
    for _, delta in events:
        active += delta
        peak = max(peak, active)
    return peak


def _wait_minutes_for_appointment(row: Appointment, target_date: date) -> int:
    stage = _flow_stage_for_appointment(row)
    if stage not in {"arrived", "waiting"}:
        return 0
    current_time = datetime.now(timezone.utc)
    if row.start_at.date() > target_date:
        return 0
    return max(0, int((current_time - row.start_at).total_seconds() // 60))


def _build_room_utilization_summary(
    appointments: list[Appointment],
    resources: list[ClinicResource],
    fallback_buffer: int = 0,
) -> list[dict]:
    resources_by_id: dict[uuid.UUID, ClinicResource] = {row.id: row for row in resources}
    grouped: dict[str, dict] = {}

    for resource in resources:
        grouped[resource.name] = {
            "room_name": resource.name,
            "resource_id": str(resource.id),
            "resource_type": resource.resource_type,
            "resource_type_label": _resource_type_label(resource.resource_type),
            "clinic_location_id": str(resource.clinic_location_id) if resource.clinic_location_id else None,
            "capacity": int(resource.capacity or 1),
            "appointments": 0,
            "urgent": 0,
            "inpatient": 0,
            "conflicts": 0,
            "peak_parallel": 0,
            "over_capacity": False,
        }

    room_rows: dict[str, list[Appointment]] = {}
    for appointment in appointments:
        resource = resources_by_id.get(appointment.clinic_resource_id) if appointment.clinic_resource_id else None
        room_name = resource.name if resource and resource.name else appointment.room_label or "Кабинет 1"
        current = grouped.setdefault(
            room_name,
            {
                "room_name": room_name,
                "resource_id": str(resource.id) if resource else None,
                "resource_type": resource.resource_type if resource else "room",
                "resource_type_label": _resource_type_label(resource.resource_type if resource else "room"),
                "clinic_location_id": str(resource.clinic_location_id) if resource and resource.clinic_location_id else None,
                "capacity": int(resource.capacity or 1) if resource else 1,
                "appointments": 0,
                "urgent": 0,
                "inpatient": 0,
                "conflicts": 0,
                "peak_parallel": 0,
                "over_capacity": False,
            },
        )
        current["appointments"] += 1
        if appointment.urgency_level == "urgent":
            current["urgent"] += 1
        if _flow_stage_for_appointment(appointment) == "inpatient":
            current["inpatient"] += 1
        room_rows.setdefault(room_name, []).append(appointment)

    for room_name, rows in room_rows.items():
        sorted_rows = sorted(rows, key=lambda item: item.start_at)
        conflict_count = 0
        for current, next_row in zip(sorted_rows, sorted_rows[1:]):
            current_end = _appointment_end_with_buffer(current, fallback_buffer)
            next_end = _appointment_end_with_buffer(next_row, fallback_buffer)
            if current.start_at < next_end and next_row.start_at < current_end:
                conflict_count += 1
        grouped[room_name]["conflicts"] = conflict_count
        grouped[room_name]["peak_parallel"] = _peak_parallel_appointments(sorted_rows, fallback_buffer)
        grouped[room_name]["over_capacity"] = grouped[room_name]["peak_parallel"] > max(1, int(grouped[room_name]["capacity"] or 1))

    return sorted(grouped.values(), key=lambda item: (-item["appointments"], item["room_name"]))


def _build_resource_type_summary(room_utilization: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for room in room_utilization:
        resource_type = room.get("resource_type") or "room"
        current = grouped.setdefault(
            resource_type,
            {
                "resource_type": resource_type,
                "resource_type_label": room.get("resource_type_label") or _resource_type_label(resource_type),
                "rooms": 0,
                "appointments": 0,
                "urgent": 0,
                "inpatient": 0,
                "conflicts": 0,
                "over_capacity": 0,
                "max_peak_parallel": 0,
            },
        )
        current["rooms"] += 1
        current["appointments"] += int(room.get("appointments") or 0)
        current["urgent"] += int(room.get("urgent") or 0)
        current["inpatient"] += int(room.get("inpatient") or 0)
        current["conflicts"] += int(room.get("conflicts") or 0)
        current["over_capacity"] += 1 if room.get("over_capacity") else 0
        current["max_peak_parallel"] = max(current["max_peak_parallel"], int(room.get("peak_parallel") or 0))
    return sorted(grouped.values(), key=lambda item: (-item["appointments"], item["resource_type_label"]))


def _serialize_appointment(row: Appointment) -> dict:
    status_value = _normalize_status(row.status)
    service_type = row.service_type or row.service_name
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "pet_id": str(row.pet_id),
        "owner_user_id": str(row.owner_user_id),
        "owner_id": str(row.owner_user_id),
        "vet_id": str(row.vet_id),
        "clinic_location_id": str(row.clinic_location_id) if row.clinic_location_id else None,
        "clinic_resource_id": str(row.clinic_resource_id) if row.clinic_resource_id else None,
        "appointment_type_id": str(row.appointment_type_id) if row.appointment_type_id else None,
        "service_type": service_type,
        "service_name": row.service_name,
        "scheduled_at": row.start_at,
        "start_at": row.start_at,
        "duration_minutes": row.duration_minutes,
        "buffer_minutes": int(row.buffer_minutes or 0),
        "room_label": row.room_label,
        "visit_type": row.visit_type,
        "flow_stage": row.flow_stage or _default_flow_stage_for_status(status_value),
        "urgency_level": row.urgency_level or "routine",
        "protocol_status": row.protocol_status or "not_started",
        "discharge_ready": bool(row.discharge_ready),
        "video_link": row.video_link,
        "meeting_token": row.meeting_token,
        "status": status_value,
        "notes": row.notes,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "is_telemedicine": row.visit_type == "video_consultation",
        "can_join_video": row.visit_type == "video_consultation" and status_value in {"scheduled", "confirmed", "in_progress"},
    }


def _serialize_visit_draft(row: Visit) -> dict:
    return {
        "id": str(row.id),
        "appointment_id": str(row.appointment_id) if row.appointment_id else None,
        "pet_id": str(row.pet_id),
        "clinic_id": str(row.clinic_id),
        "vet_id": str(row.vet_id),
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "complaints": row.complaints,
        "created_at": row.created_at,
        "started_at": row.started_at,
        "finalized_at": row.finalized_at,
        "finalized_flag": row.finalized_flag,
    }


def _parse_uuid(value: str, *, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise _bad_request(f"Invalid {field_name} format") from exc


async def _resolve_clinic_context_for_staff(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    clinic_id: str | None,
) -> uuid.UUID:
    if clinic_id:
        clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
        await require_clinic_membership(db, user_id=user_id, clinic_id=clinic_uuid)
        return clinic_uuid

    membership = await db.scalar(
        select(Membership)
        .where(Membership.user_id == user_id, Membership.status == MembershipStatus.active)
        .order_by(Membership.created_at.asc())
    )
    if not membership:
        raise _forbidden("No active clinic membership")
    return membership.clinic_id


async def _ensure_staff_or_owner_access(
    db: AsyncSession,
    *,
    current_user,
    appointment: Appointment,
    require_vet_match: bool = False,
) -> None:
    if current_user.role == RoleEnum.owner:
        if appointment.owner_user_id != current_user.id:
            raise _forbidden()
        return

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=appointment.clinic_id)

    if require_vet_match and current_user.role == RoleEnum.vet and appointment.vet_id != current_user.id:
        raise _forbidden("Vet can update only own appointments")


async def _resolve_appointment_type(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    appointment_type_id: str | None,
) -> AppointmentType | None:
    if not appointment_type_id:
        return None
    type_uuid = _parse_uuid(appointment_type_id, field_name="appointment_type_id")
    row = await db.scalar(
        select(AppointmentType).where(
            AppointmentType.id == type_uuid,
            AppointmentType.clinic_id == clinic_id,
            AppointmentType.is_active.is_(True),
        )
    )
    if not row:
        raise _not_found("Appointment type not found for clinic")
    return row


async def _resolve_service_duration(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    service_type: str,
    fallback: int,
) -> int:
    row = await db.scalar(
        select(Service).where(
            Service.clinic_id == clinic_id,
            Service.is_active.is_(True),
            Service.name == service_type,
        )
    )
    if row and row.duration_min:
        return int(row.duration_min)
    return fallback


async def _resolve_clinic_location(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    clinic_location_id: str | None,
) -> ClinicLocation | None:
    if not clinic_location_id:
        return None
    location_uuid = _parse_uuid(clinic_location_id, field_name="clinic_location_id")
    row = await db.scalar(
        select(ClinicLocation).where(
            ClinicLocation.id == location_uuid,
            ClinicLocation.clinic_id == clinic_id,
        )
    )
    if not row:
        raise _not_found("Clinic location not found for clinic")
    return row


async def _load_scheduler_settings(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    clinic_location_id: uuid.UUID | None,
) -> dict:
    clinic_default = await db.scalar(
        select(ClinicSchedulerSettings).where(
            ClinicSchedulerSettings.clinic_id == clinic_id,
            ClinicSchedulerSettings.clinic_location_id.is_(None),
        )
    )
    scoped_override = None
    if clinic_location_id:
        scoped_override = await db.scalar(
            select(ClinicSchedulerSettings).where(
                ClinicSchedulerSettings.clinic_id == clinic_id,
                ClinicSchedulerSettings.clinic_location_id == clinic_location_id,
            )
        )
    return _serialize_scheduler_settings(
        clinic_uuid=clinic_id,
        location_uuid=clinic_location_id,
        clinic_defaults=clinic_default,
        scoped_override=scoped_override,
    )


async def _resolve_clinic_resource(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    clinic_location_id: uuid.UUID | None,
    clinic_resource_id: str | None,
) -> ClinicResource | None:
    if not clinic_resource_id:
        return None
    resource_uuid = _parse_uuid(clinic_resource_id, field_name="clinic_resource_id")
    row = await db.scalar(
        select(ClinicResource).where(
            ClinicResource.id == resource_uuid,
            ClinicResource.clinic_id == clinic_id,
            ClinicResource.is_active.is_(True),
        )
    )
    if not row:
        raise _not_found("Clinic resource not found for clinic")
    if clinic_location_id and row.clinic_location_id and row.clinic_location_id != clinic_location_id:
        raise _bad_request("Clinic resource does not belong to selected clinic location")
    return row


async def _resolve_clinic_resource_by_name(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    clinic_location_id: uuid.UUID | None,
    room_label: str | None,
) -> ClinicResource | None:
    if not room_label:
        return None
    normalized_name = room_label.strip()
    if not normalized_name:
        return None
    query = select(ClinicResource).where(
        ClinicResource.clinic_id == clinic_id,
        ClinicResource.name == normalized_name,
        ClinicResource.is_active.is_(True),
    )
    if clinic_location_id:
        scoped_row = await db.scalar(query.where(ClinicResource.clinic_location_id == clinic_location_id))
        if scoped_row:
            return scoped_row
    fallback_row = await db.scalar(query.where(ClinicResource.clinic_location_id.is_(None)))
    if fallback_row:
        return fallback_row
    return await db.scalar(query.limit(1))


async def _check_conflict(
    db: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    vet_id: uuid.UUID,
    scheduled_at: datetime,
    duration_minutes: int,
    buffer_minutes: int = 0,
    clinic_resource_id: uuid.UUID | None = None,
    exclude_id: uuid.UUID | None = None,
) -> None:
    window_start = scheduled_at - timedelta(hours=12)
    window_end = scheduled_at + timedelta(hours=12)

    resource_scope = Appointment.clinic_resource_id == clinic_resource_id if clinic_resource_id else None
    participant_scope = or_(Appointment.vet_id == vet_id, resource_scope) if resource_scope is not None else (Appointment.vet_id == vet_id)

    query = select(Appointment).where(
        Appointment.clinic_id == clinic_id,
        participant_scope,
        Appointment.start_at >= window_start,
        Appointment.start_at <= window_end,
    )
    if exclude_id is not None:
        query = query.where(Appointment.id != exclude_id)

    rows = (await db.scalars(query)).all()
    new_end = scheduled_at + timedelta(minutes=duration_minutes + max(0, int(buffer_minutes or 0)))

    for row in rows:
        if not _is_active_status(row.status):
            continue
        row_start = row.start_at
        row_end = row.start_at + timedelta(
            minutes=max(10, int(row.duration_minutes or 30)) + max(0, int(row.buffer_minutes or 0))
        )
        if scheduled_at < row_end and row_start < new_end:
            conflict_scopes: list[str] = []
            if row.vet_id == vet_id:
                conflict_scopes.append("vet")
            if clinic_resource_id and row.clinic_resource_id == clinic_resource_id:
                conflict_scopes.append("resource")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "SLOT_CONFLICT",
                    "message": (
                        "Selected slot overlaps an existing appointment for the assigned veterinarian and room"
                        if len(conflict_scopes) == 2
                        else "Selected slot overlaps an existing appointment for the assigned room"
                        if conflict_scopes == ["resource"]
                        else "Selected slot overlaps an existing appointment for the assigned veterinarian"
                    ),
                    "conflict_scopes": conflict_scopes or ["vet"],
                    "conflicting_appointment_id": str(row.id),
                    "clinic_resource_id": str(row.clinic_resource_id) if row.clinic_resource_id else None,
                    "room_label": row.room_label,
                },
            )


async def _sync_appointment_reminders(db: AsyncSession, *, row: Appointment) -> None:
    reminders = (
        await db.scalars(
            select(Reminder).where(
                Reminder.appointment_id == row.id,
                Reminder.owner_user_id == row.owner_user_id,
            )
        )
    ).all()
    reminder_map = {int(rem.remind_before_minutes or 0): rem for rem in reminders}

    if _normalize_status(row.status) in {status.value for status in TERMINAL_STATUSES}:
        for rem in reminders:
            rem.is_done = True
        return

    offsets = [1440, 120]
    for offset in offsets:
        due_at = row.start_at - timedelta(minutes=offset)
        title_suffix = "24 часа" if offset == 1440 else "2 часа"
        title = f"Напоминание о визите ({title_suffix})"
        notes = f"Визит: {row.service_type or row.service_name}. Статус: {_normalize_status(row.status)}."

        existing = reminder_map.get(offset)
        if existing:
            existing.pet_id = row.pet_id
            existing.due_at = due_at
            existing.title = title
            existing.notes = notes
            existing.reminder_type = ReminderType.checkup
            existing.channel = "in_app"
            existing.is_done = False
        else:
            db.add(
                Reminder(
                    pet_id=row.pet_id,
                    owner_user_id=row.owner_user_id,
                    appointment_id=row.id,
                    reminder_type=ReminderType.checkup,
                    remind_before_minutes=offset,
                    channel="in_app",
                    title=title,
                    due_at=due_at,
                    notes=notes,
                    is_done=False,
                )
            )

    for rem in reminders:
        if int(rem.remind_before_minutes or 0) not in offsets:
            rem.is_done = True


def _generate_video_session() -> tuple[str, str]:
    token = secrets.token_urlsafe(24)
    link = f"https://telemed.lapka.demo/meeting/{token}"
    return token, link


@router.get("/types")
async def list_appointment_types(
    clinic_id: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    if current_user.role == RoleEnum.owner:
        if not clinic_id:
            raise _bad_request("clinic_id is required for owner")
        clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
    else:
        clinic_uuid = await _resolve_clinic_context_for_staff(db, user_id=current_user.id, clinic_id=clinic_id)

    query = select(AppointmentType).where(AppointmentType.clinic_id == clinic_uuid)
    if not include_inactive:
        query = query.where(AppointmentType.is_active.is_(True))

    rows = (await db.scalars(query.order_by(AppointmentType.name.asc()))).all()
    return [_serialize_appointment_type(row) for row in rows]


@router.post("/types", status_code=status.HTTP_201_CREATED)
async def create_appointment_type(
    payload: AppointmentTypeCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can create appointment types")

    clinic_uuid = _parse_uuid(payload.clinic_id, field_name="clinic_id")
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    existing = await db.scalar(
        select(AppointmentType).where(
            AppointmentType.clinic_id == clinic_uuid,
            AppointmentType.code == payload.code.strip(),
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "CONFLICT", "message": "Appointment type code already exists"},
        )

    row = AppointmentType(
        clinic_id=clinic_uuid,
        code=payload.code.strip(),
        name=payload.name.strip(),
        default_duration_minutes=payload.default_duration_minutes,
        is_telemedicine=payload.is_telemedicine,
        is_active=True,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="appointment_type.create",
        target_type="appointment_type",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_appointment_type(row)


@router.patch("/types/{appointment_type_id}")
async def patch_appointment_type(
    appointment_type_id: str,
    payload: AppointmentTypePatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can update appointment types")

    type_uuid = _parse_uuid(appointment_type_id, field_name="appointment_type_id")
    row = await db.scalar(select(AppointmentType).where(AppointmentType.id == type_uuid))
    if not row:
        raise _not_found("Appointment type not found")

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=row.clinic_id)

    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.default_duration_minutes is not None:
        row.default_duration_minutes = payload.default_duration_minutes
    if payload.is_telemedicine is not None:
        row.is_telemedicine = payload.is_telemedicine
    if payload.is_active is not None:
        row.is_active = payload.is_active

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="appointment_type.update",
        target_type="appointment_type",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_appointment_type(row)


@router.get("/doctor-schedules")
async def list_doctor_schedules(
    clinic_id: str | None = Query(default=None),
    vet_id: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    if current_user.role == RoleEnum.owner:
        if not clinic_id:
            raise _bad_request("clinic_id is required for owner")
        clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
    else:
        clinic_uuid = await _resolve_clinic_context_for_staff(db, user_id=current_user.id, clinic_id=clinic_id)

    query = select(DoctorSchedule).where(DoctorSchedule.clinic_id == clinic_uuid)
    if vet_id:
        query = query.where(DoctorSchedule.vet_id == _parse_uuid(vet_id, field_name="vet_id"))
    if not include_inactive:
        query = query.where(DoctorSchedule.is_active.is_(True))

    rows = (await db.scalars(query.order_by(DoctorSchedule.weekday.asc(), DoctorSchedule.start_time.asc()))).all()
    return [_serialize_schedule(row) for row in rows]


@router.post("/doctor-schedules", status_code=status.HTTP_201_CREATED)
async def create_doctor_schedule(
    payload: DoctorScheduleCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can manage schedules")

    clinic_uuid = _parse_uuid(payload.clinic_id, field_name="clinic_id")
    vet_uuid = _parse_uuid(payload.vet_id, field_name="vet_id")

    if payload.start_time >= payload.end_time:
        raise _bad_request("start_time must be before end_time")

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
    await require_clinic_membership(db, user_id=vet_uuid, clinic_id=clinic_uuid)

    row = DoctorSchedule(
        clinic_id=clinic_uuid,
        vet_id=vet_uuid,
        weekday=payload.weekday,
        start_time=payload.start_time,
        end_time=payload.end_time,
        slot_duration=payload.slot_duration,
        is_active=True,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="doctor_schedule.create",
        target_type="doctor_schedule",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_schedule(row)


@router.patch("/doctor-schedules/{schedule_id}")
async def patch_doctor_schedule(
    schedule_id: str,
    payload: DoctorSchedulePatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can manage schedules")

    row = await db.scalar(select(DoctorSchedule).where(DoctorSchedule.id == _parse_uuid(schedule_id, field_name="schedule_id")))
    if not row:
        raise _not_found("Schedule not found")

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=row.clinic_id)

    if payload.weekday is not None:
        row.weekday = payload.weekday
    if payload.start_time is not None:
        row.start_time = payload.start_time
    if payload.end_time is not None:
        row.end_time = payload.end_time
    if row.start_time >= row.end_time:
        raise _bad_request("start_time must be before end_time")
    if payload.slot_duration is not None:
        row.slot_duration = payload.slot_duration
    if payload.is_active is not None:
        row.is_active = payload.is_active

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="doctor_schedule.update",
        target_type="doctor_schedule",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_schedule(row)


@router.get("/resources")
async def list_clinic_resources(
    clinic_id: str | None = Query(default=None),
    clinic_location_id: str | None = Query(default=None),
    include_inactive: bool = Query(default=False),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    if current_user.role == RoleEnum.owner:
        if not clinic_id:
            raise _bad_request("clinic_id is required for owner")
        clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
    else:
        clinic_uuid = await _resolve_clinic_context_for_staff(db, user_id=current_user.id, clinic_id=clinic_id)

    query = select(ClinicResource).where(ClinicResource.clinic_id == clinic_uuid)
    if clinic_location_id:
        query = query.where(
            ClinicResource.clinic_location_id == _parse_uuid(clinic_location_id, field_name="clinic_location_id")
        )
    if not include_inactive:
        query = query.where(ClinicResource.is_active.is_(True))

    rows = (
        await db.scalars(
            query.order_by(
                ClinicResource.resource_type.asc(),
                ClinicResource.name.asc(),
            )
        )
    ).all()
    return [_serialize_resource(row) for row in rows]


@router.post("/resources", status_code=status.HTTP_201_CREATED)
async def create_clinic_resource(
    payload: ClinicResourceCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can manage clinic resources")

    clinic_uuid = _parse_uuid(payload.clinic_id, field_name="clinic_id")
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    location = await _resolve_clinic_location(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=payload.clinic_location_id,
    )

    existing = await db.scalar(
        select(ClinicResource).where(
            ClinicResource.clinic_id == clinic_uuid,
            ClinicResource.clinic_location_id == (location.id if location else None),
            ClinicResource.name == payload.name.strip(),
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "CONFLICT", "message": "Clinic resource with this name already exists in scope"},
        )

    row = ClinicResource(
        clinic_id=clinic_uuid,
        clinic_location_id=location.id if location else None,
        name=payload.name.strip(),
        code=payload.code.strip() if payload.code else None,
        resource_type=payload.resource_type.strip(),
        capacity=payload.capacity,
        is_active=payload.is_active,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="clinic_resource.create",
        target_type="clinic_resource",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_resource(row)


@router.patch("/resources/{resource_id}")
async def patch_clinic_resource(
    resource_id: str,
    payload: ClinicResourcePatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can manage clinic resources")

    resource_uuid = _parse_uuid(resource_id, field_name="resource_id")
    row = await db.scalar(select(ClinicResource).where(ClinicResource.id == resource_uuid))
    if not row:
        raise _not_found("Clinic resource not found")

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=row.clinic_id)

    if "clinic_location_id" in payload.model_fields_set:
        location = await _resolve_clinic_location(
            db,
            clinic_id=row.clinic_id,
            clinic_location_id=payload.clinic_location_id,
        )
        row.clinic_location_id = location.id if location else None

    if payload.name is not None:
        row.name = payload.name.strip()
    if "code" in payload.model_fields_set:
        row.code = payload.code.strip() if payload.code else None
    if payload.resource_type is not None:
        row.resource_type = payload.resource_type.strip()
    if payload.capacity is not None:
        row.capacity = payload.capacity
    if payload.is_active is not None:
        row.is_active = payload.is_active

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="clinic_resource.update",
        target_type="clinic_resource",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_resource(row)


@router.get("/settings")
async def get_scheduler_settings(
    clinic_id: str | None = Query(default=None),
    clinic_location_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role == RoleEnum.owner:
        if not clinic_id:
            raise _bad_request("clinic_id is required for owner")
        clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
    else:
        clinic_uuid = await _resolve_clinic_context_for_staff(db, user_id=current_user.id, clinic_id=clinic_id)

    location = await _resolve_clinic_location(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=clinic_location_id,
    )
    return await _load_scheduler_settings(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=location.id if location else None,
    )


@router.patch("/settings")
async def patch_scheduler_settings(
    payload: ClinicSchedulerSettingsPatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic admin can manage scheduler settings")

    clinic_uuid = _parse_uuid(payload.clinic_id, field_name="clinic_id")
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    location = await _resolve_clinic_location(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=payload.clinic_location_id,
    )
    location_uuid = location.id if location else None

    row = await db.scalar(
        select(ClinicSchedulerSettings).where(
            ClinicSchedulerSettings.clinic_id == clinic_uuid,
            ClinicSchedulerSettings.clinic_location_id == location_uuid,
        )
    )
    if not row:
        row = ClinicSchedulerSettings(
            clinic_id=clinic_uuid,
            clinic_location_id=location_uuid,
            default_buffer_minutes=DEFAULT_SCHEDULER_SETTINGS["default_buffer_minutes"],
            day_start_hour=DEFAULT_SCHEDULER_SETTINGS["day_start_hour"],
            day_end_hour=DEFAULT_SCHEDULER_SETTINGS["day_end_hour"],
            slot_interval_minutes=DEFAULT_SCHEDULER_SETTINGS["slot_interval_minutes"],
        )
        db.add(row)
        await db.flush()

    if payload.default_buffer_minutes is not None:
        row.default_buffer_minutes = payload.default_buffer_minutes
    if payload.day_start_hour is not None:
        row.day_start_hour = payload.day_start_hour
    if payload.day_end_hour is not None:
        row.day_end_hour = payload.day_end_hour
    if payload.slot_interval_minutes is not None:
        row.slot_interval_minutes = payload.slot_interval_minutes

    if int(row.day_end_hour) <= int(row.day_start_hour):
        raise _bad_request("day_end_hour must be greater than day_start_hour")

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="scheduler_settings.update",
        target_type="clinic_scheduler_settings",
        target_id=str(row.id),
        metadata={"clinic_location_id": str(location_uuid) if location_uuid else None},
    )
    await db.commit()

    return await _load_scheduler_settings(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=location_uuid,
    )


@router.get("/slots")
async def list_available_slots(
    clinic_id: str,
    vet_id: str,
    date_value: str = Query(alias="date"),
    appointment_type_id: str | None = Query(default=None),
    duration_minutes: int | None = Query(default=None, ge=10, le=240),
    buffer_minutes: int | None = Query(default=None, ge=0, le=180),
    clinic_location_id: str | None = Query(default=None),
    clinic_resource_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
    vet_uuid = _parse_uuid(vet_id, field_name="vet_id")

    if current_user.role != RoleEnum.owner:
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    try:
        target_date = date.fromisoformat(date_value)
    except ValueError as exc:
        raise _bad_request("Invalid date format. Use YYYY-MM-DD") from exc

    weekday = target_date.weekday()
    location = await _resolve_clinic_location(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=clinic_location_id,
    )
    scheduler_settings = await _load_scheduler_settings(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=location.id if location else None,
    )
    resource = await _resolve_clinic_resource(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=location.id if location else None,
        clinic_resource_id=clinic_resource_id,
    )
    schedules = (
        await db.scalars(
            select(DoctorSchedule).where(
                DoctorSchedule.clinic_id == clinic_uuid,
                DoctorSchedule.vet_id == vet_uuid,
                DoctorSchedule.weekday == weekday,
                DoctorSchedule.is_active.is_(True),
            )
        )
    ).all()
    if not schedules:
        return []

    slot_duration = duration_minutes
    if appointment_type_id and slot_duration is None:
        appt_type = await _resolve_appointment_type(db, clinic_id=clinic_uuid, appointment_type_id=appointment_type_id)
        if appt_type:
            slot_duration = int(appt_type.default_duration_minutes)
    if slot_duration is None:
        slot_duration = int(schedules[0].slot_duration)
    effective_buffer_minutes = int(
        scheduler_settings["default_buffer_minutes"] if buffer_minutes is None else buffer_minutes
    )

    day_start = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

    resource_scope = Appointment.clinic_resource_id == resource.id if resource else None
    participant_scope = or_(Appointment.vet_id == vet_uuid, resource_scope) if resource_scope is not None else (Appointment.vet_id == vet_uuid)
    existing = (
        await db.scalars(
            select(Appointment).where(
                Appointment.clinic_id == clinic_uuid,
                participant_scope,
                Appointment.start_at >= day_start,
                Appointment.start_at <= day_end,
            )
        )
    ).all()

    slots: list[dict] = []
    for schedule in schedules:
        cursor = datetime.combine(target_date, schedule.start_time).replace(tzinfo=timezone.utc)
        schedule_end = datetime.combine(target_date, schedule.end_time).replace(tzinfo=timezone.utc)

        while cursor + timedelta(minutes=slot_duration) <= schedule_end:
            slot_end = cursor + timedelta(minutes=slot_duration + max(0, effective_buffer_minutes))
            conflict = None
            conflict_scopes: list[str] = []
            for appt in existing:
                if not _is_active_status(appt.status):
                    continue
                appt_end = appt.start_at + timedelta(
                    minutes=max(10, int(appt.duration_minutes or 30)) + max(0, int(appt.buffer_minutes or 0))
                )
                if cursor < appt_end and appt.start_at < slot_end:
                    conflict = appt
                    if appt.vet_id == vet_uuid:
                        conflict_scopes.append("vet")
                    if resource and appt.clinic_resource_id == resource.id:
                        conflict_scopes.append("resource")
                    break

            slots.append(
                {
                    "start_at": cursor,
                    "end_at": slot_end,
                    "available": conflict is None,
                    "appointment_id": str(conflict.id) if conflict else None,
                    "status": _normalize_status(conflict.status) if conflict else None,
                    "conflict_scopes": conflict_scopes,
                    "clinic_location_id": str(location.id) if location else None,
                    "clinic_resource_id": str(resource.id) if resource else None,
                    "room_label": resource.name if resource else (conflict.room_label if conflict else None),
                    "buffer_minutes": effective_buffer_minutes,
                }
            )
            cursor += timedelta(minutes=schedule.slot_duration)

    return slots


@router.get("")
async def list_appointments(
    clinic_id: str | None = Query(default=None),
    pet_id: str | None = Query(default=None),
    vet_id: str | None = Query(default=None),
    clinic_location_id: str | None = Query(default=None),
    clinic_resource_id: str | None = Query(default=None),
    status_filter: AppointmentStatus | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    mine: bool = Query(default=True),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query = select(Appointment)

    if current_user.role == RoleEnum.owner:
        query = query.where(Appointment.owner_user_id == current_user.id)
    else:
        clinic_uuid = await _resolve_clinic_context_for_staff(db, user_id=current_user.id, clinic_id=clinic_id)
        query = query.where(Appointment.clinic_id == clinic_uuid)

        if current_user.role == RoleEnum.vet and mine and not vet_id:
            query = query.where(Appointment.vet_id == current_user.id)

    if pet_id:
        query = query.where(Appointment.pet_id == _parse_uuid(pet_id, field_name="pet_id"))
    if vet_id:
        query = query.where(Appointment.vet_id == _parse_uuid(vet_id, field_name="vet_id"))
    if clinic_location_id:
        query = query.where(
            Appointment.clinic_location_id == _parse_uuid(clinic_location_id, field_name="clinic_location_id")
        )
    if clinic_resource_id:
        query = query.where(
            Appointment.clinic_resource_id == _parse_uuid(clinic_resource_id, field_name="clinic_resource_id")
        )
    if status_filter is not None:
        query = query.where(Appointment.status == status_filter)
    if date_from is not None:
        query = query.where(Appointment.start_at >= date_from)
    if date_to is not None:
        query = query.where(Appointment.start_at <= date_to)

    rows = (await db.scalars(query.order_by(Appointment.start_at.asc()).limit(400))).all()
    return [_serialize_appointment(row) for row in rows]


@router.get("/flowboard/summary")
async def get_flowboard_summary(
    clinic_id: str,
    date_value: str = Query(alias="date"),
    clinic_location_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic staff can access flowboard summary")

    clinic_uuid = _parse_uuid(clinic_id, field_name="clinic_id")
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    try:
        target_date = date.fromisoformat(date_value)
    except ValueError as exc:
        raise _bad_request("Invalid date format. Use YYYY-MM-DD") from exc

    location = await _resolve_clinic_location(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=clinic_location_id,
    )
    scheduler_settings = await _load_scheduler_settings(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=location.id if location else None,
    )

    day_start = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
    day_end = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

    appointments_query = select(Appointment).where(
        Appointment.clinic_id == clinic_uuid,
        Appointment.start_at >= day_start,
        Appointment.start_at <= day_end,
    )
    if location:
        appointments_query = appointments_query.where(Appointment.clinic_location_id == location.id)
    appointment_rows = (await db.scalars(appointments_query.order_by(Appointment.start_at.asc()))).all()

    resources_query = select(ClinicResource).where(
        ClinicResource.clinic_id == clinic_uuid,
        ClinicResource.is_active.is_(True),
    )
    if location:
        resources_query = resources_query.where(
            or_(
                ClinicResource.clinic_location_id == location.id,
                ClinicResource.clinic_location_id.is_(None),
            )
        )
    resource_rows = (await db.scalars(resources_query.order_by(ClinicResource.resource_type.asc(), ClinicResource.name.asc()))).all()

    metrics = {column_id: 0 for column_id in (
        "scheduled",
        "arrived",
        "waiting",
        "in_consult",
        "diagnostics",
        "inpatient",
        "ready_for_discharge",
        "follow_up",
        "completed",
    )}
    for row in appointment_rows:
        metrics[_flow_stage_for_appointment(row)] += 1

    room_utilization = _build_room_utilization_summary(
        appointment_rows,
        resource_rows,
        fallback_buffer=int(scheduler_settings["default_buffer_minutes"] or 0),
    )

    bottlenecks = {
        "waiting_over_30": sum(1 for row in appointment_rows if _wait_minutes_for_appointment(row, target_date) >= 30),
        "diagnostics_backlog": sum(1 for row in appointment_rows if _flow_stage_for_appointment(row) == "diagnostics"),
        "discharge_queue": sum(1 for row in appointment_rows if _flow_stage_for_appointment(row) == "ready_for_discharge" or bool(row.discharge_ready)),
        "inpatient_load": sum(1 for row in appointment_rows if _flow_stage_for_appointment(row) == "inpatient"),
        "urgent_cases": sum(1 for row in appointment_rows if row.urgency_level == "urgent"),
        "draft_protocols": sum(1 for row in appointment_rows if row.protocol_status == "draft"),
        "unsigned_ready": sum(1 for row in appointment_rows if row.protocol_status == "ready" and not bool(row.discharge_ready)),
    }

    resource_pressure = [
        item for item in room_utilization
        if item["appointments"] >= 3 or item["conflicts"] > 0 or item["urgent"] > 0 or item["over_capacity"]
    ]
    resource_type_summary = _build_resource_type_summary(room_utilization)

    return {
        "clinic_id": str(clinic_uuid),
        "clinic_location_id": str(location.id) if location else None,
        "date": target_date.isoformat(),
        "scheduler_settings": scheduler_settings,
        "metrics": metrics,
        "bottlenecks": bottlenecks,
        "room_utilization": room_utilization,
        "resource_pressure": resource_pressure,
        "resource_type_summary": resource_type_summary,
        "appointments_count": len(appointment_rows),
        "resources_count": len(resource_rows),
    }


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Appointment).where(Appointment.id == _parse_uuid(appointment_id, field_name="appointment_id")))
    if not row:
        raise _not_found("Appointment not found")

    await _ensure_staff_or_owner_access(db, current_user=current_user, appointment=row)
    return _serialize_appointment(row)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreateRequest,
    current_user=Depends(get_current_user),
    clinic_id: str | None = Depends(get_clinic_context),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # clinic may come from body or resolved context
    clinic_uuid = _parse_uuid(payload.clinic_id or clinic_id, field_name="clinic_id")
    pet_uuid = _parse_uuid(payload.pet_id, field_name="pet_id")
    vet_uuid = _parse_uuid(payload.vet_id, field_name="vet_id")

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
        owner_uuid = current_user.id
    else:
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
        if not payload.owner_user_id:
            owner_link = await db.scalar(
                select(PetOwnerLink)
                .where(PetOwnerLink.pet_id == pet_uuid)
                .order_by(PetOwnerLink.created_at.asc())
            )
            if not owner_link:
                raise _bad_request("owner_user_id is required for clinic booking when pet has no owner link")
            owner_uuid = owner_link.owner_user_id
        else:
            owner_uuid = _parse_uuid(payload.owner_user_id, field_name="owner_user_id")

    await require_clinic_membership(db, user_id=vet_uuid, clinic_id=clinic_uuid)

    appointment_type = await _resolve_appointment_type(
        db,
        clinic_id=clinic_uuid,
        appointment_type_id=payload.appointment_type_id,
    )

    duration = payload.duration_minutes
    if duration is None and appointment_type:
        duration = appointment_type.default_duration_minutes
    duration = await _resolve_service_duration(
        db,
        clinic_id=clinic_uuid,
        service_type=payload.service_type.strip(),
        fallback=duration or 30,
    )
    location = await _resolve_clinic_location(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=payload.clinic_location_id,
    )
    resource = await _resolve_clinic_resource(
        db,
        clinic_id=clinic_uuid,
        clinic_location_id=location.id if location else None,
        clinic_resource_id=payload.clinic_resource_id,
    )
    if resource is None and payload.room_label:
        resource = await _resolve_clinic_resource_by_name(
            db,
            clinic_id=clinic_uuid,
            clinic_location_id=location.id if location else None,
            room_label=payload.room_label,
        )
    buffer_minutes = max(0, int(payload.buffer_minutes or 0))

    visit_type = payload.visit_type
    if appointment_type and appointment_type.is_telemedicine:
        visit_type = "video_consultation"

    await _check_conflict(
        db,
        clinic_id=clinic_uuid,
        vet_id=vet_uuid,
        scheduled_at=payload.scheduled_at,
        duration_minutes=duration,
        buffer_minutes=buffer_minutes,
        clinic_resource_id=resource.id if resource else None,
    )

    meeting_token = None
    video_link = None
    if visit_type == "video_consultation":
        meeting_token, video_link = _generate_video_session()

    row = Appointment(
        clinic_id=clinic_uuid,
        pet_id=pet_uuid,
        owner_user_id=owner_uuid,
        vet_id=vet_uuid,
        clinic_location_id=location.id if location else None,
        clinic_resource_id=resource.id if resource else None,
        appointment_type_id=appointment_type.id if appointment_type else None,
        service_type=payload.service_type.strip(),
        service_name=payload.service_type.strip(),
        start_at=payload.scheduled_at,
        duration_minutes=duration,
        buffer_minutes=buffer_minutes,
        room_label=payload.room_label.strip() if payload.room_label else (resource.name if resource else None),
        visit_type=visit_type,
        flow_stage=payload.flow_stage or _default_flow_stage_for_status(payload.status),
        urgency_level=payload.urgency_level or "routine",
        protocol_status=payload.protocol_status or ("signed" if _normalize_status(payload.status) == "completed" else "not_started"),
        discharge_ready=bool(payload.discharge_ready),
        video_link=video_link,
        meeting_token=meeting_token,
        status=payload.status,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(row)
    await db.flush()

    await _sync_appointment_reminders(db, row=row)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="appointment.create",
        target_type="appointment",
        target_id=str(row.id),
    )

    await db.commit()
    await db.refresh(row)
    return _serialize_appointment(row)


@router.patch("/{appointment_id}")
async def patch_appointment(
    appointment_id: str,
    payload: AppointmentPatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Appointment).where(Appointment.id == _parse_uuid(appointment_id, field_name="appointment_id")))
    if not row:
        raise _not_found("Appointment not found")

    await _ensure_staff_or_owner_access(
        db,
        current_user=current_user,
        appointment=row,
        require_vet_match=True,
    )

    if current_user.role == RoleEnum.owner:
        allowed = {"status", "notes"}
        owner_payload_fields = {k for k, v in payload.model_dump(exclude_none=True).items() if v is not None}
        if not owner_payload_fields.issubset(allowed):
            raise _forbidden("Owner can only cancel appointment or update note")

    original_start = row.start_at
    original_duration = int(row.duration_minutes or 30)
    original_buffer = int(row.buffer_minutes or 0)
    original_vet = row.vet_id
    original_location = row.clinic_location_id
    original_resource = row.clinic_resource_id

    appointment_type = None
    if payload.appointment_type_id is not None:
        appointment_type = await _resolve_appointment_type(
            db,
            clinic_id=row.clinic_id,
            appointment_type_id=payload.appointment_type_id,
        )
        row.appointment_type_id = appointment_type.id if appointment_type else None

    if payload.vet_id is not None:
        vet_uuid = _parse_uuid(payload.vet_id, field_name="vet_id")
        await require_clinic_membership(db, user_id=vet_uuid, clinic_id=row.clinic_id)
        row.vet_id = vet_uuid

    if "clinic_location_id" in payload.model_fields_set:
        location = await _resolve_clinic_location(
            db,
            clinic_id=row.clinic_id,
            clinic_location_id=payload.clinic_location_id,
        )
        row.clinic_location_id = location.id if location else None

    if "clinic_resource_id" in payload.model_fields_set or "clinic_location_id" in payload.model_fields_set:
        resource = await _resolve_clinic_resource(
            db,
            clinic_id=row.clinic_id,
            clinic_location_id=row.clinic_location_id,
            clinic_resource_id=payload.clinic_resource_id if "clinic_resource_id" in payload.model_fields_set else (
                str(row.clinic_resource_id) if row.clinic_resource_id else None
            ),
        )
        row.clinic_resource_id = resource.id if resource else None
        if "room_label" not in payload.model_fields_set and resource:
            row.room_label = resource.name

    if payload.service_type is not None:
        row.service_type = payload.service_type.strip()
        row.service_name = payload.service_type.strip()

    if payload.duration_minutes is not None:
        row.duration_minutes = payload.duration_minutes

    if payload.buffer_minutes is not None:
        row.buffer_minutes = payload.buffer_minutes

    if "room_label" in payload.model_fields_set:
        row.room_label = payload.room_label.strip() if payload.room_label else None
        if "clinic_resource_id" not in payload.model_fields_set:
            inferred_resource = await _resolve_clinic_resource_by_name(
                db,
                clinic_id=row.clinic_id,
                clinic_location_id=row.clinic_location_id,
                room_label=row.room_label,
            )
            row.clinic_resource_id = inferred_resource.id if inferred_resource else None

    if payload.scheduled_at is not None:
        row.start_at = payload.scheduled_at

    if payload.visit_type is not None:
        row.visit_type = payload.visit_type

    if payload.flow_stage is not None:
        row.flow_stage = payload.flow_stage

    if payload.urgency_level is not None:
        row.urgency_level = payload.urgency_level

    if payload.protocol_status is not None:
        row.protocol_status = payload.protocol_status

    if payload.discharge_ready is not None:
        row.discharge_ready = payload.discharge_ready

    if appointment_type and appointment_type.is_telemedicine:
        row.visit_type = "video_consultation"

    if row.visit_type == "video_consultation" and not row.video_link:
        row.meeting_token, row.video_link = _generate_video_session()

    if payload.status is not None:
        row.status = payload.status
        if "flow_stage" not in payload.model_fields_set:
            row.flow_stage = _default_flow_stage_for_status(payload.status)
        if "protocol_status" not in payload.model_fields_set and _normalize_status(payload.status) == "completed":
            row.protocol_status = "signed"
        if "discharge_ready" not in payload.model_fields_set and _normalize_status(payload.status) == "completed":
            row.discharge_ready = True

    if payload.notes is not None:
        row.notes = payload.notes.strip() if payload.notes else None

    changed_time_fields = (
        row.start_at != original_start
        or int(row.duration_minutes or 30) != original_duration
        or int(row.buffer_minutes or 0) != original_buffer
        or row.vet_id != original_vet
        or row.clinic_location_id != original_location
        or row.clinic_resource_id != original_resource
    )
    if changed_time_fields:
        await _check_conflict(
            db,
            clinic_id=row.clinic_id,
            vet_id=row.vet_id,
            scheduled_at=row.start_at,
            duration_minutes=int(row.duration_minutes or 30),
            buffer_minutes=int(row.buffer_minutes or 0),
            clinic_resource_id=row.clinic_resource_id,
            exclude_id=row.id,
        )

    await _sync_appointment_reminders(db, row=row)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="appointment.update",
        target_type="appointment",
        target_id=str(row.id),
    )

    await db.commit()
    await db.refresh(row)
    return _serialize_appointment(row)


@router.post("/{appointment_id}/checkin")
async def checkin_appointment(
    appointment_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic staff can perform reception check-in")

    row = await db.scalar(select(Appointment).where(Appointment.id == _parse_uuid(appointment_id, field_name="appointment_id")))
    if not row:
        raise _not_found("Appointment not found")

    await _ensure_staff_or_owner_access(
        db,
        current_user=current_user,
        appointment=row,
        require_vet_match=(current_user.role == RoleEnum.vet),
    )
    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=row.pet_id,
        clinic_id=row.clinic_id,
        required_scope=ConsentScope.basic_medical,
    )

    if _normalize_status(row.status) in {status.value for status in TERMINAL_STATUSES}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "APPOINTMENT_TERMINAL", "message": "Cannot check-in a completed/cancelled appointment"},
        )

    existing_visit = await db.scalar(
        select(Visit)
        .where(Visit.appointment_id == row.id)
        .order_by(Visit.created_at.desc())
    )

    if not existing_visit:
        existing_visit = Visit(
            appointment_id=row.id,
            pet_id=row.pet_id,
            clinic_id=row.clinic_id,
            vet_id=row.vet_id,
            status=VisitStatus.draft,
            complaints=row.notes or row.service_type or row.service_name,
            chief_complaint=row.notes or row.service_type or row.service_name,
        )
        db.add(existing_visit)
        await db.flush()
        await log_audit(
            db,
            actor_user_id=str(current_user.id),
            clinic_id=str(row.clinic_id),
            action="visit.draft.create",
            target_type="visit",
            target_id=str(existing_visit.id),
            metadata={"appointment_id": str(row.id)},
        )

    row.status = AppointmentStatus.waiting

    await create_notification(
        db,
        user_id=row.owner_user_id,
        pet_id=row.pet_id,
        appointment_id=row.id,
        visit_id=existing_visit.id,
        notification_type=NotificationType.appointment_confirmed,
        title="Check-in выполнен",
        body="Клиника зарегистрировала вас на ресепшн. Врач скоро начнёт приём.",
        metadata={"appointment_status": "waiting"},
        channel=NotificationChannel.email,
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="appointment.checkin",
        target_type="appointment",
        target_id=str(row.id),
        metadata={"visit_id": str(existing_visit.id)},
    )
    await db.commit()
    await db.refresh(row)
    await db.refresh(existing_visit)
    return {
        "status": "checked_in",
        "appointment": _serialize_appointment(row),
        "visit": _serialize_visit_draft(existing_visit),
    }


async def _set_status(
    db: AsyncSession,
    *,
    appointment_id: str,
    current_user,
    status_value: AppointmentStatus,
    notes: str | None,
    action: str,
    require_vet_match: bool = False,
) -> dict:
    row = await db.scalar(select(Appointment).where(Appointment.id == _parse_uuid(appointment_id, field_name="appointment_id")))
    if not row:
        raise _not_found("Appointment not found")

    await _ensure_staff_or_owner_access(
        db,
        current_user=current_user,
        appointment=row,
        require_vet_match=require_vet_match,
    )

    if current_user.role == RoleEnum.owner and status_value not in {AppointmentStatus.cancelled}:
        raise _forbidden("Owner can only cancel own appointments")

    row.status = status_value
    if notes is not None:
        row.notes = notes.strip() if notes else None

    await _sync_appointment_reminders(db, row=row)

    if status_value == AppointmentStatus.confirmed:
        await create_notification(
            db,
            user_id=row.owner_user_id,
            pet_id=row.pet_id,
            appointment_id=row.id,
            notification_type=NotificationType.appointment_confirmed,
            title="Запись подтверждена",
            body=f"Клиника подтвердила запись на {row.start_at.strftime('%d.%m.%Y %H:%M')}.",
            metadata={"status": "confirmed"},
            channel=NotificationChannel.email,
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action=action,
        target_type="appointment",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_appointment(row)


@router.post("/{appointment_id}/confirm")
async def confirm_appointment(
    appointment_id: str,
    payload: AppointmentStatusChangeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic staff can confirm appointments")
    return await _set_status(
        db,
        appointment_id=appointment_id,
        current_user=current_user,
        status_value=AppointmentStatus.confirmed,
        notes=payload.notes,
        action="appointment.confirm",
        require_vet_match=(current_user.role == RoleEnum.vet),
    )


@router.post("/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: str,
    payload: AppointmentStatusChangeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await _set_status(
        db,
        appointment_id=appointment_id,
        current_user=current_user,
        status_value=AppointmentStatus.cancelled,
        notes=payload.notes,
        action="appointment.cancel",
        require_vet_match=(current_user.role == RoleEnum.vet),
    )


@router.post("/{appointment_id}/start")
async def start_appointment(
    appointment_id: str,
    payload: AppointmentStatusChangeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic staff can start appointments")
    return await _set_status(
        db,
        appointment_id=appointment_id,
        current_user=current_user,
        status_value=AppointmentStatus.in_progress,
        notes=payload.notes,
        action="appointment.start",
        require_vet_match=(current_user.role == RoleEnum.vet),
    )


@router.post("/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: str,
    payload: AppointmentStatusChangeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise _forbidden("Only clinic staff can complete appointments")
    return await _set_status(
        db,
        appointment_id=appointment_id,
        current_user=current_user,
        status_value=AppointmentStatus.completed,
        notes=payload.notes,
        action="appointment.complete",
        require_vet_match=(current_user.role == RoleEnum.vet),
    )
