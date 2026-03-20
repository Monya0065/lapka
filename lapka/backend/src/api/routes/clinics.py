from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    AIClinicOverride,
    Appointment,
    AuditEvent,
    Clinic,
    ClinicLocation,
    ClinicResource,
    ClinicSchedulerSettings,
    ClinicService,
    ConsentGrant,
    ConsentScope,
    InpatientStay,
    MasterPet,
    Membership,
    MembershipStatus,
    PetOwnerLink,
    Review,
    RoleEnum,
    Template,
    User,
    VetProfile,
)
from src.security.deps import get_current_user, require_clinic_membership, require_roles

router = APIRouter(prefix="/clinics", tags=["clinics"])

CONSENT_SCOPE_RANK = {
    ConsentScope.prescriptions_only: 1,
    ConsentScope.basic_medical: 2,
    ConsentScope.full_record: 3,
    ConsentScope.inpatient_view: 4,
    ConsentScope.camera_view: 5,
}


def _serialize_clinic_location(row: ClinicLocation) -> dict:
    return {
        "id": str(row.id),
        "address": row.address,
        "city": row.city,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "hours": row.hours,
        "phone": row.phone,
        "is_primary": row.is_primary,
    }


def _select_primary_location(rows: list[ClinicLocation]) -> ClinicLocation | None:
    if not rows:
        return None
    primary = next((row for row in rows if row.is_primary), None)
    return primary or rows[0]


def _role_label(role: RoleEnum | str | None) -> str:
    value = role.value if isinstance(role, RoleEnum) else str(role or "")
    labels = {
        "owner": "Владелец",
        "vet": "Ветеринарный врач",
        "clinic_admin": "Администратор клиники",
        "network_admin": "Платформа",
    }
    return labels.get(value, value or "Роль не указана")


def _template_scope_label(scope: str | None) -> str:
    labels = {
        "system": "Платформа",
        "clinic": "Клиника",
        "branch": "Филиал",
        "personal": "Личный врач",
    }
    return labels.get(str(scope or ""), str(scope or "—"))


def _template_status_label(status_value: str | None) -> str:
    labels = {
        "draft": "Черновик",
        "published": "Опубликован",
        "archived": "Архив",
    }
    return labels.get(str(status_value or ""), str(status_value or "—"))


def _service_category_label(value: str | None) -> str:
    labels = {
        "consultation": "Консультация",
        "vaccination": "Вакцинация",
        "imaging": "Визуальная диагностика",
        "lab": "Лаборатория",
        "surgery": "Хирургия",
        "inpatient": "Стационар",
        "telemedicine": "Телемедицина",
        "other": "Другое",
    }
    return labels.get(str(value or ""), str(value or "—"))


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


def _appointment_status_label(value: str | None) -> str:
    labels = {
        "scheduled": "Запланирована",
        "confirmed": "Подтверждена",
        "waiting": "Ожидает приёма",
        "in_progress": "В работе",
        "completed": "Завершена",
        "cancelled": "Отменена",
        "no_show": "Не пришёл",
    }
    return labels.get(str(value or ""), str(value or "—"))


def _flow_stage_label(value: str | None) -> str:
    labels = {
        "scheduled": "План",
        "arrived": "Регистрация",
        "waiting": "Ожидание",
        "in_consult": "В кабинете",
        "diagnostics": "Диагностика",
        "inpatient": "Стационар",
        "ready_for_discharge": "Готов к выписке",
        "follow_up": "Контроль",
        "completed": "Завершено",
    }
    return labels.get(str(value or ""), str(value or "—"))


def _serialize_scheduler_scope(
    *,
    clinic_id: uuid.UUID,
    location_id: uuid.UUID,
    clinic_defaults: ClinicSchedulerSettings | None,
    branch_override: ClinicSchedulerSettings | None,
) -> dict:
    payload = {
        "clinic_id": str(clinic_id),
        "clinic_location_id": str(location_id),
        "default_buffer_minutes": 10,
        "day_start_hour": 8,
        "day_end_hour": 21,
        "slot_interval_minutes": 30,
        "source": "defaults",
        "clinic_default_id": str(clinic_defaults.id) if clinic_defaults else None,
        "scope_override_id": str(branch_override.id) if branch_override else None,
    }
    if clinic_defaults:
        payload.update(
            default_buffer_minutes=int(clinic_defaults.default_buffer_minutes or payload["default_buffer_minutes"]),
            day_start_hour=int(clinic_defaults.day_start_hour or payload["day_start_hour"]),
            day_end_hour=int(clinic_defaults.day_end_hour or payload["day_end_hour"]),
            slot_interval_minutes=int(clinic_defaults.slot_interval_minutes or payload["slot_interval_minutes"]),
            source="clinic_default",
        )
    if branch_override:
        payload.update(
            default_buffer_minutes=int(branch_override.default_buffer_minutes or payload["default_buffer_minutes"]),
            day_start_hour=int(branch_override.day_start_hour or payload["day_start_hour"]),
            day_end_hour=int(branch_override.day_end_hour or payload["day_end_hour"]),
            slot_interval_minutes=int(branch_override.slot_interval_minutes or payload["slot_interval_minutes"]),
            source="branch_override",
        )
    return payload


def _review_status_label(value: str | None) -> str:
    labels = {
        "published": "Опубликован",
        "pending": "На проверке",
        "rejected": "Отклонён",
    }
    return labels.get(str(value or ""), str(value or "—"))


def _audit_action_label(value: str | None) -> str:
    labels = {
        "template.create": "Создание шаблона",
        "template.update": "Обновление шаблона",
        "template.publish": "Публикация шаблона",
        "template.archive": "Архив шаблона",
        "template.use": "Использование шаблона",
        "document.view": "Просмотр документа",
        "document.upload": "Загрузка документа",
        "camera.view": "Просмотр камеры",
        "visit.finalize": "Завершение визита",
    }
    return labels.get(str(value or ""), str(value or "Событие"))


@router.get("")
async def list_clinics(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    rows = (await db.scalars(select(Clinic).order_by(Clinic.name.asc()))).all()
    locations = (await db.scalars(select(ClinicLocation).order_by(ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc()))).all()
    locations_by_clinic: dict[uuid.UUID, list[ClinicLocation]] = {}
    for row in locations:
        locations_by_clinic.setdefault(row.clinic_id, []).append(row)

    payload = []
    for row in rows:
        clinic_locations = locations_by_clinic.get(row.id, [])
        primary_location = _select_primary_location(clinic_locations)
        payload.append({
            "id": str(row.id),
            "name": row.name,
            "address": row.address,
            "city": row.city,
            "phone": row.phone,
            "hours": row.hours,
            "website": row.website,
            "logo_url": row.logo_url,
            "photos": row.photos_json or [],
            "emergency_available": row.emergency_available,
            "locations": [_serialize_clinic_location(location) for location in clinic_locations],
            "primary_location": _serialize_clinic_location(primary_location) if primary_location else None,
        })
    return payload


@router.get("/my/scopes")
async def my_clinic_scopes(
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role == RoleEnum.network_admin:
        rows = await list_clinics(current_user=current_user, db=db)
        return {
            "scope_mode": "platform",
            "default_clinic_id": rows[0]["id"] if rows else None,
            "clinics": [
                {
                    **row,
                    "access_label": "Платформенный доступ",
                    "role_in_clinic": "network_admin",
                    "role_label": "Платформа",
                }
                for row in rows
            ],
        }

    memberships = (
        await db.execute(
            select(Membership, Clinic)
            .join(Clinic, Clinic.id == Membership.clinic_id)
            .where(
                Membership.user_id == current_user.id,
                Membership.status == MembershipStatus.active,
            )
            .order_by(Clinic.name.asc(), Membership.created_at.asc())
        )
    ).all()
    if not memberships:
        return {
            "scope_mode": "membership",
            "default_clinic_id": None,
            "clinics": [],
        }

    clinic_ids = [clinic.id for _, clinic in memberships]
    locations = (
        await db.scalars(
            select(ClinicLocation)
            .where(ClinicLocation.clinic_id.in_(clinic_ids))
            .order_by(ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc())
        )
    ).all()
    locations_by_clinic: dict[uuid.UUID, list[ClinicLocation]] = {}
    for row in locations:
        locations_by_clinic.setdefault(row.clinic_id, []).append(row)

    payload: list[dict] = []
    for membership, clinic in memberships:
        clinic_locations = locations_by_clinic.get(clinic.id, [])
        primary_location = _select_primary_location(clinic_locations)
        payload.append(
            {
                "id": str(clinic.id),
                "name": clinic.name,
                "address": clinic.address,
                "city": clinic.city,
                "phone": clinic.phone,
                "hours": clinic.hours,
                "website": clinic.website,
                "logo_url": clinic.logo_url,
                "photos": clinic.photos_json or [],
                "emergency_available": clinic.emergency_available,
                "locations": [_serialize_clinic_location(location) for location in clinic_locations],
                "primary_location": _serialize_clinic_location(primary_location) if primary_location else None,
                "role_in_clinic": membership.role_in_clinic.value,
                "role_label": _role_label(membership.role_in_clinic),
                "access_label": f"{_role_label(membership.role_in_clinic)} · активный контур",
            }
        )

    return {
        "scope_mode": "membership",
        "default_clinic_id": payload[0]["id"],
        "clinics": payload,
    }


@router.get("/platform-registry")
async def platform_clinic_registry(
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinics = (await db.scalars(select(Clinic).order_by(Clinic.name.asc()))).all()
    if not clinics:
        return []

    clinic_ids = [row.id for row in clinics]
    locations = (
        await db.scalars(
            select(ClinicLocation)
            .where(ClinicLocation.clinic_id.in_(clinic_ids))
            .order_by(ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc())
        )
    ).all()
    memberships = (
        await db.scalars(
            select(Membership).where(
                Membership.clinic_id.in_(clinic_ids),
                Membership.status == MembershipStatus.active,
            )
        )
    ).all()
    consents = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.clinic_id.in_(clinic_ids),
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all()
    services = (
        await db.scalars(
            select(ClinicService).where(
                ClinicService.clinic_id.in_(clinic_ids),
                ClinicService.is_active.is_(True),
            )
        )
    ).all()
    inpatient = (
        await db.scalars(
            select(InpatientStay).where(
                InpatientStay.clinic_id.in_(clinic_ids),
                InpatientStay.status == "active",
            )
        )
    ).all()
    overrides = (
        await db.scalars(
            select(AIClinicOverride).where(
                AIClinicOverride.clinic_id.in_(clinic_ids),
                AIClinicOverride.enabled.is_(True),
            )
        )
    ).all()
    upcoming_appointments = (
        await db.scalars(
            select(Appointment).where(
                Appointment.clinic_id.in_(clinic_ids),
                Appointment.start_at >= datetime.now(timezone.utc),
            )
        )
    ).all()

    locations_by_clinic: dict[uuid.UUID, list[ClinicLocation]] = {}
    for row in locations:
        locations_by_clinic.setdefault(row.clinic_id, []).append(row)

    staff_by_clinic: dict[uuid.UUID, list[Membership]] = {}
    for row in memberships:
        staff_by_clinic.setdefault(row.clinic_id, []).append(row)

    services_by_clinic: dict[uuid.UUID, list[ClinicService]] = {}
    for row in services:
        services_by_clinic.setdefault(row.clinic_id, []).append(row)

    inpatient_by_clinic: dict[uuid.UUID, list[InpatientStay]] = {}
    for row in inpatient:
        inpatient_by_clinic.setdefault(row.clinic_id, []).append(row)

    overrides_by_clinic: dict[uuid.UUID, list[AIClinicOverride]] = {}
    for row in overrides:
        overrides_by_clinic.setdefault(row.clinic_id, []).append(row)

    appointments_by_clinic: dict[uuid.UUID, list[Appointment]] = {}
    for row in upcoming_appointments:
        appointments_by_clinic.setdefault(row.clinic_id, []).append(row)

    patient_count_by_clinic: dict[uuid.UUID, int] = {}
    now = datetime.now(timezone.utc)
    for row in consents:
        if row.expires_at and row.expires_at <= now:
            continue
        patient_count_by_clinic[row.clinic_id] = patient_count_by_clinic.get(row.clinic_id, 0) + 1

    payload: list[dict] = []
    for clinic in clinics:
        clinic_locations = locations_by_clinic.get(clinic.id, [])
        primary_location = _select_primary_location(clinic_locations)
        clinic_staff = staff_by_clinic.get(clinic.id, [])
        clinic_services = services_by_clinic.get(clinic.id, [])
        clinic_inpatient = inpatient_by_clinic.get(clinic.id, [])
        clinic_overrides = overrides_by_clinic.get(clinic.id, [])
        clinic_appointments = appointments_by_clinic.get(clinic.id, [])
        vets_count = sum(1 for row in clinic_staff if row.role_in_clinic == RoleEnum.vet)
        admins_count = sum(1 for row in clinic_staff if row.role_in_clinic == RoleEnum.clinic_admin)
        payload.append(
            {
                "id": str(clinic.id),
                "name": clinic.name,
                "city": clinic.city,
                "address": clinic.address,
                "phone": clinic.phone,
                "website": clinic.website,
                "logo_url": clinic.logo_url,
                "photos": clinic.photos_json or [],
                "emergency_available": clinic.emergency_available,
                "locations": [_serialize_clinic_location(row) for row in clinic_locations],
                "primary_location": _serialize_clinic_location(primary_location) if primary_location else None,
                "stats": {
                    "branches": max(0, len(clinic_locations) - 1),
                    "locations": len(clinic_locations),
                    "staff": len(clinic_staff),
                    "vets": vets_count,
                    "admins": admins_count,
                    "patients": patient_count_by_clinic.get(clinic.id, 0),
                    "active_inpatient": len(clinic_inpatient),
                    "services": len(clinic_services),
                    "upcoming_appointments": len(clinic_appointments),
                    "ai_overrides": len(clinic_overrides),
                },
            }
        )
    return payload


@router.get("/platform-branches")
async def platform_branch_registry(
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
    clinic_id: str | None = Query(default=None),
    city: str | None = Query(default=None),
) -> list[dict]:
    clinic_query = select(Clinic).order_by(Clinic.name.asc())
    clinic_uuid: uuid.UUID | None = None
    if clinic_id:
        try:
            clinic_uuid = uuid.UUID(clinic_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": "Invalid clinic_id format"},
            ) from exc
        clinic_query = clinic_query.where(Clinic.id == clinic_uuid)

    clinics = (await db.scalars(clinic_query)).all()
    if not clinics:
        return []

    clinic_ids = [row.id for row in clinics]
    location_query = (
        select(ClinicLocation)
        .where(ClinicLocation.clinic_id.in_(clinic_ids))
        .order_by(ClinicLocation.city.asc(), ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc())
    )
    if city:
        location_query = location_query.where(func.lower(ClinicLocation.city) == city.lower())
    locations = (await db.scalars(location_query)).all()
    if not locations:
        return []

    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=14)
    location_ids = [location.id for location in locations]
    appointments = (
        await db.scalars(
            select(Appointment)
            .where(
                Appointment.clinic_location_id.in_(location_ids),
                Appointment.start_at >= now,
                Appointment.start_at <= window_end,
            )
            .order_by(Appointment.start_at.asc())
        )
    ).all()
    memberships = (
        await db.scalars(
            select(Membership).where(
                Membership.clinic_id.in_(clinic_ids),
                Membership.status == MembershipStatus.active,
            )
        )
    ).all()
    inpatient = (
        await db.scalars(
            select(InpatientStay).where(
                InpatientStay.clinic_id.in_(clinic_ids),
                InpatientStay.status == "active",
            )
        )
    ).all()
    overrides = (
        await db.scalars(
            select(AIClinicOverride).where(
                AIClinicOverride.clinic_id.in_(clinic_ids),
                AIClinicOverride.enabled.is_(True),
            )
        )
    ).all()

    clinic_by_id = {clinic.id: clinic for clinic in clinics}
    memberships_by_clinic: dict[uuid.UUID, list[Membership]] = {}
    for row in memberships:
        memberships_by_clinic.setdefault(row.clinic_id, []).append(row)

    inpatient_by_clinic: dict[uuid.UUID, list[InpatientStay]] = {}
    for row in inpatient:
        inpatient_by_clinic.setdefault(row.clinic_id, []).append(row)

    overrides_by_clinic: dict[uuid.UUID, list[AIClinicOverride]] = {}
    for row in overrides:
        overrides_by_clinic.setdefault(row.clinic_id, []).append(row)

    active_flow_statuses = {"scheduled", "confirmed", "in_progress", "waiting"}
    stats_by_location: dict[uuid.UUID, dict[str, int]] = {
        location.id: {
            "appointments_14d": 0,
            "telemedicine_14d": 0,
            "active_flow": 0,
            "ready_for_discharge": 0,
            "blocked_flow": 0,
        }
        for location in locations
    }
    for row in appointments:
        if not row.clinic_location_id or row.clinic_location_id not in stats_by_location:
            continue
        stats = stats_by_location[row.clinic_location_id]
        stats["appointments_14d"] += 1
        if getattr(row, "visit_type", None) and getattr(row.visit_type, "value", "") == "video_consultation":
            stats["telemedicine_14d"] += 1
        if getattr(row, "status", None) and getattr(row.status, "value", "") in active_flow_statuses:
            stats["active_flow"] += 1
        if getattr(row, "discharge_ready", False):
            stats["ready_for_discharge"] += 1
        if getattr(row, "wait_minutes", 0) and row.wait_minutes and row.wait_minutes >= 30:
            stats["blocked_flow"] += 1

    payload: list[dict] = []
    for location in locations:
        clinic = clinic_by_id.get(location.clinic_id)
        if not clinic:
            continue
        clinic_staff = memberships_by_clinic.get(clinic.id, [])
        clinic_inpatient = inpatient_by_clinic.get(clinic.id, [])
        clinic_overrides = overrides_by_clinic.get(clinic.id, [])
        clinic_vets = sum(1 for row in clinic_staff if row.role_in_clinic == RoleEnum.vet)
        payload.append(
            {
                "id": str(location.id),
                "clinic_id": str(clinic.id),
                "clinic_name": clinic.name,
                "city": location.city,
                "address": location.address,
                "phone": location.phone or clinic.phone,
                "hours": location.hours or clinic.hours,
                "is_primary": location.is_primary,
                "emergency_available": clinic.emergency_available,
                "website": clinic.website,
                "cover_photo": (clinic.photos_json or [None])[0],
                "photos": clinic.photos_json or [],
                "stats": {
                    **stats_by_location.get(location.id, {}),
                    "clinic_staff": len(clinic_staff),
                    "clinic_vets": clinic_vets,
                    "clinic_inpatient": len(clinic_inpatient),
                    "clinic_ai_overrides": len(clinic_overrides),
                },
            }
        )
    return payload


@router.get("/platform-branches/{branch_id}")
async def platform_branch_detail(
    branch_id: str,
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        branch_uuid = uuid.UUID(branch_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid branch_id format"},
        ) from exc

    location = await db.scalar(select(ClinicLocation).where(ClinicLocation.id == branch_uuid))
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "BRANCH_NOT_FOUND", "message": "Branch not found"},
        )

    clinic = await db.scalar(select(Clinic).where(Clinic.id == location.clinic_id))
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CLINIC_NOT_FOUND", "message": "Clinic not found"},
        )

    locations = (
        await db.scalars(
            select(ClinicLocation)
            .where(ClinicLocation.clinic_id == clinic.id)
            .order_by(ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc())
        )
    ).all()

    resources = (
        await db.scalars(
            select(ClinicResource)
            .where(
                ClinicResource.clinic_id == clinic.id,
                ClinicResource.is_active.is_(True),
                ((ClinicResource.clinic_location_id == branch_uuid) | ClinicResource.clinic_location_id.is_(None)),
            )
            .order_by(ClinicResource.resource_type.asc(), ClinicResource.name.asc())
        )
    ).all()

    clinic_defaults = await db.scalar(
        select(ClinicSchedulerSettings).where(
            ClinicSchedulerSettings.clinic_id == clinic.id,
            ClinicSchedulerSettings.clinic_location_id.is_(None),
        )
    )
    branch_override = await db.scalar(
        select(ClinicSchedulerSettings).where(
            ClinicSchedulerSettings.clinic_id == clinic.id,
            ClinicSchedulerSettings.clinic_location_id == branch_uuid,
        )
    )

    memberships = (
        await db.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(
                Membership.clinic_id == clinic.id,
                Membership.status == MembershipStatus.active,
            )
            .order_by(Membership.role_in_clinic.asc(), User.full_name.asc())
        )
    ).all()

    vet_profiles = (
        await db.scalars(
            select(VetProfile)
            .where(VetProfile.clinic_id == clinic.id)
            .order_by(VetProfile.specialty.asc(), VetProfile.created_at.asc())
        )
    ).all()
    vet_profile_by_user = {profile.vet_id: profile for profile in vet_profiles}

    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=14)
    appointments = (
        await db.scalars(
            select(Appointment)
            .where(
                Appointment.clinic_id == clinic.id,
                Appointment.clinic_location_id == branch_uuid,
                Appointment.start_at >= now,
                Appointment.start_at <= window_end,
            )
            .order_by(Appointment.start_at.asc())
            .limit(40)
        )
    ).all()

    pet_ids = [row.pet_id for row in appointments if getattr(row, "pet_id", None)]
    vet_ids = [row.vet_id for row in appointments if getattr(row, "vet_id", None)]
    pets = (
        await db.scalars(select(MasterPet).where(MasterPet.id.in_(pet_ids)))
    ).all() if pet_ids else []
    pet_by_id = {row.id: row for row in pets}

    vet_users = (
        await db.scalars(select(User).where(User.id.in_(vet_ids)))
    ).all() if vet_ids else []
    vet_by_id = {row.id: row for row in vet_users}

    inpatient = (
        await db.scalars(
            select(InpatientStay)
            .where(
                InpatientStay.clinic_id == clinic.id,
                InpatientStay.status == "active",
            )
            .order_by(InpatientStay.admitted_at.desc())
            .limit(20)
        )
    ).all()
    overrides = (
        await db.scalars(
            select(AIClinicOverride)
            .where(
                AIClinicOverride.clinic_id == clinic.id,
                AIClinicOverride.enabled.is_(True),
            )
            .order_by(AIClinicOverride.created_at.desc())
        )
    ).all()

    active_flow_statuses = {"scheduled", "confirmed", "waiting", "in_progress"}
    stats = {
        "appointments_14d": 0,
        "telemedicine_14d": 0,
        "active_flow": 0,
        "ready_for_discharge": 0,
        "blocked_flow": 0,
        "active_resources": 0,
        "shared_resources": 0,
        "clinic_staff": len(memberships),
        "clinic_vets": sum(1 for member, _ in memberships if member.role_in_clinic == RoleEnum.vet),
        "active_inpatient": len(inpatient),
        "clinic_ai_overrides": len(overrides),
    }
    for resource in resources:
        if resource.clinic_location_id == branch_uuid:
            stats["active_resources"] += 1
        elif resource.clinic_location_id is None:
            stats["shared_resources"] += 1
    for row in appointments:
        stats["appointments_14d"] += 1
        if getattr(row, "visit_type", None) and getattr(row.visit_type, "value", "") == "video_consultation":
            stats["telemedicine_14d"] += 1
        if getattr(row, "status", None) and getattr(row.status, "value", "") in active_flow_statuses:
            stats["active_flow"] += 1
        if getattr(row, "discharge_ready", False):
            stats["ready_for_discharge"] += 1
        if getattr(row, "wait_minutes", 0) and row.wait_minutes and row.wait_minutes >= 30:
            stats["blocked_flow"] += 1

    staff_payload = []
    for membership, user in memberships:
        profile = vet_profile_by_user.get(user.id)
        staff_payload.append(
            {
                "membership_id": str(membership.id),
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role.value,
                "role_label": _role_label(membership.role_in_clinic),
                "role_in_clinic": membership.role_in_clinic.value,
                "specialty": profile.specialty if profile else None,
                "experience_years": profile.experience_years if profile else None,
                "photo_url": profile.photo_url if profile else None,
                "working_hours": profile.working_hours if profile else None,
            }
        )

    primary_location = _select_primary_location(locations)
    scheduler_settings = _serialize_scheduler_scope(
        clinic_id=clinic.id,
        location_id=branch_uuid,
        clinic_defaults=clinic_defaults,
        branch_override=branch_override,
    )
    clinic_photos = clinic.photos_json or []
    branch_cover_photo = clinic_photos[1] if len(clinic_photos) > 1 else (clinic_photos[0] if clinic_photos else None)

    return {
        "branch": {
            **_serialize_clinic_location(location),
            "clinic_id": str(clinic.id),
            "clinic_name": clinic.name,
            "cover_photo": branch_cover_photo,
            "photos": clinic_photos,
            "website": clinic.website,
            "emergency_available": clinic.emergency_available,
        },
        "clinic": {
            "id": str(clinic.id),
            "name": clinic.name,
            "city": clinic.city,
            "address": clinic.address,
            "phone": clinic.phone,
            "hours": clinic.hours,
            "website": clinic.website,
            "logo_url": clinic.logo_url,
            "photos": clinic_photos,
            "primary_location": _serialize_clinic_location(primary_location) if primary_location else None,
        },
        "scheduler_settings": scheduler_settings,
        "resources": [
            {
                **{
                    "id": str(row.id),
                    "clinic_id": str(row.clinic_id),
                    "clinic_location_id": str(row.clinic_location_id) if row.clinic_location_id else None,
                    "name": row.name,
                    "code": row.code,
                    "resource_type": row.resource_type,
                    "resource_type_label": _resource_type_label(row.resource_type),
                    "capacity": int(row.capacity or 1),
                    "is_active": bool(row.is_active),
                    "scope_label": "Филиал" if row.clinic_location_id == branch_uuid else "Общий ресурс",
                }
            }
            for row in resources
        ],
        "staff": staff_payload,
        "upcoming_appointments": [
            {
                "id": str(row.id),
                "pet_id": str(row.pet_id),
                "pet_name": pet_by_id.get(row.pet_id).name if pet_by_id.get(row.pet_id) else "Пациент",
                "vet_id": str(row.vet_id) if row.vet_id else None,
                "vet_name": vet_by_id.get(row.vet_id).full_name if vet_by_id.get(row.vet_id) else "Врач уточняется",
                "service_name": row.service_name,
                "start_at": row.start_at.isoformat(),
                "status": row.status.value,
                "status_label": _appointment_status_label(row.status.value),
                "flow_stage": row.flow_stage,
                "flow_stage_label": _flow_stage_label(row.flow_stage),
                "room_label": row.room_label,
                "visit_type": row.visit_type.value if hasattr(row.visit_type, "value") else row.visit_type,
            }
            for row in appointments
        ],
        "stats": stats,
        "signals": {
            "bottleneck": stats["blocked_flow"] > 0,
            "telemedicine_share": round((stats["telemedicine_14d"] / stats["appointments_14d"]) * 100, 1)
            if stats["appointments_14d"]
            else 0.0,
            "resource_pressure": max(0, stats["active_flow"] - stats["active_resources"]) if stats["active_resources"] else stats["active_flow"],
        },
    }


@router.get("/platform-registry/{clinic_id}")
async def platform_clinic_registry_detail(
    clinic_id: str,
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        clinic_uuid = uuid.UUID(clinic_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid clinic_id format"},
        ) from exc

    clinic = await db.scalar(select(Clinic).where(Clinic.id == clinic_uuid))
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CLINIC_NOT_FOUND", "message": "Clinic not found"},
        )

    locations = (
        await db.scalars(
            select(ClinicLocation)
            .where(ClinicLocation.clinic_id == clinic_uuid)
            .order_by(ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc())
        )
    ).all()
    primary_location = _select_primary_location(locations)

    memberships = (
        await db.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(
                Membership.clinic_id == clinic_uuid,
                Membership.status == MembershipStatus.active,
            )
            .order_by(Membership.role_in_clinic.asc(), User.full_name.asc())
        )
    ).all()

    vet_profiles = (
        await db.scalars(
            select(VetProfile)
            .where(VetProfile.clinic_id == clinic_uuid)
            .order_by(VetProfile.specialty.asc(), VetProfile.created_at.asc())
        )
    ).all()
    vet_profile_by_user = {profile.vet_id: profile for profile in vet_profiles}

    services = (
        await db.scalars(
            select(ClinicService)
            .where(ClinicService.clinic_id == clinic_uuid, ClinicService.is_active.is_(True))
            .order_by(ClinicService.category.asc(), ClinicService.name.asc())
        )
    ).all()
    templates = (
        await db.scalars(
            select(Template)
            .where(Template.clinic_id == clinic_uuid, Template.deleted_at.is_(None))
            .order_by(Template.updated_at.desc())
        )
    ).all()
    inpatient = (
        await db.scalars(
            select(InpatientStay)
            .where(InpatientStay.clinic_id == clinic_uuid, InpatientStay.status == "active")
            .order_by(InpatientStay.admitted_at.desc())
        )
    ).all()
    overrides = (
        await db.scalars(
            select(AIClinicOverride)
            .where(AIClinicOverride.clinic_id == clinic_uuid, AIClinicOverride.enabled.is_(True))
            .order_by(AIClinicOverride.created_at.desc())
        )
    ).all()
    now = datetime.now(timezone.utc)
    consents = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.clinic_id == clinic_uuid,
                ConsentGrant.revoked_at.is_(None),
                (ConsentGrant.expires_at.is_(None) | (ConsentGrant.expires_at > now)),
            )
        )
    ).all()
    upcoming_appointments = (
        await db.scalars(
            select(Appointment)
            .where(Appointment.clinic_id == clinic_uuid, Appointment.start_at >= now)
            .order_by(Appointment.start_at.asc())
            .limit(20)
        )
    ).all()
    branch_window_end = now + timedelta(days=14)
    branch_appointments = (
        await db.scalars(
            select(Appointment)
            .where(
                Appointment.clinic_id == clinic_uuid,
                Appointment.start_at >= now,
                Appointment.start_at <= branch_window_end,
            )
            .order_by(Appointment.start_at.asc())
        )
    ).all()
    reviews = (
        await db.scalars(
            select(Review)
            .where(Review.target_type == "clinic", Review.target_id == clinic_uuid)
            .order_by(Review.created_at.desc())
            .limit(50)
        )
    ).all()
    recent_audit = (
        await db.scalars(
            select(AuditEvent)
            .where(AuditEvent.clinic_id == clinic_uuid)
            .order_by(AuditEvent.created_at.desc())
            .limit(20)
        )
    ).all()

    consent_scope_counts: dict[str, int] = {}
    for row in consents:
        consent_scope_counts[row.scope_level.value] = consent_scope_counts.get(row.scope_level.value, 0) + 1

    branch_summary_by_location: dict[uuid.UUID, dict[str, int]] = {}
    for location in locations:
        branch_summary_by_location[location.id] = {
            "appointments_14d": 0,
            "telemedicine_14d": 0,
            "active_flow": 0,
            "ready_for_discharge": 0,
        }

    active_flow_statuses = {"scheduled", "confirmed", "in_progress", "waiting"}
    for row in branch_appointments:
        if not row.clinic_location_id or row.clinic_location_id not in branch_summary_by_location:
            continue
        stats = branch_summary_by_location[row.clinic_location_id]
        stats["appointments_14d"] += 1
        if getattr(row, "visit_type", None) and getattr(row.visit_type, "value", "") == "video_consultation":
            stats["telemedicine_14d"] += 1
        if getattr(row, "status", None) and getattr(row.status, "value", "") in active_flow_statuses:
            stats["active_flow"] += 1
        if getattr(row, "discharge_ready", False):
            stats["ready_for_discharge"] += 1

    staff_payload = []
    for membership, user in memberships:
        profile = vet_profile_by_user.get(user.id)
        staff_payload.append(
            {
                "membership_id": str(membership.id),
                "user_id": str(user.id),
                "full_name": user.full_name,
                "email": user.email,
                "phone": user.phone,
                "role": user.role.value,
                "role_label": _role_label(membership.role_in_clinic),
                "role_in_clinic": membership.role_in_clinic.value,
                "specialty": profile.specialty if profile else None,
                "experience_years": profile.experience_years if profile else None,
                "photo_url": profile.photo_url if profile else None,
                "working_hours": profile.working_hours if profile else None,
            }
        )

    return {
        "clinic": {
            "id": str(clinic.id),
            "name": clinic.name,
            "city": clinic.city,
            "address": clinic.address,
            "phone": clinic.phone,
            "hours": clinic.hours,
            "website": clinic.website,
            "logo_url": clinic.logo_url,
            "photos": clinic.photos_json or [],
            "emergency_available": clinic.emergency_available,
            "primary_location": _serialize_clinic_location(primary_location) if primary_location else None,
        },
        "locations": [_serialize_clinic_location(row) for row in locations],
        "location_summaries": [
            {
                "location_id": str(location.id),
                "address": location.address,
                "city": location.city,
                "is_primary": location.is_primary,
                **branch_summary_by_location.get(location.id, {
                    "appointments_14d": 0,
                    "telemedicine_14d": 0,
                    "active_flow": 0,
                    "ready_for_discharge": 0,
                }),
            }
            for location in locations
        ],
        "staff": staff_payload,
        "services": [
            {
                "id": str(row.id),
                "name": row.name,
                "category": row.category.value,
                "category_label": _service_category_label(row.category.value),
                "duration_minutes": row.duration_minutes,
                "price_cents": row.price_cents,
                "currency": row.currency,
            }
            for row in services
        ],
        "templates": [
            {
                "id": str(row.id),
                "name": row.name,
                "scope": row.scope,
                "scope_label": _template_scope_label(row.scope),
                "status": row.status,
                "status_label": _template_status_label(row.status),
                "template_type": row.template_type,
                "specialty": row.specialty,
                "usage_count": row.usage_count,
                "is_default": row.is_default,
            }
            for row in templates
        ],
        "ai_overrides": [
            {
                "id": str(row.id),
                "route_slug": row.route_slug,
                "route_label": row.route_slug.replace("-", " ").capitalize() if row.route_slug else "Маршрут AI",
                "provider_slug": row.provider_slug,
                "provider_label": (row.provider_slug or "provider").replace("-", " ").capitalize(),
                "model_key": row.model_key,
                "mode_label": row.mode_label,
            }
            for row in overrides
        ],
        "inpatient": [
            {
                "id": str(row.id),
                "pet_id": str(row.pet_id),
                "status": row.status,
                "public_status_label": row.public_status_label,
                "owner_visible_summary": row.owner_visible_summary,
            }
            for row in inpatient
        ],
        "upcoming_appointments": [
            {
                "id": str(row.id),
                "service_name": row.service_name,
                "start_at": row.start_at.isoformat(),
                "status": row.status.value,
                "flow_stage": row.flow_stage,
                "room_label": row.room_label,
            }
            for row in upcoming_appointments
        ],
        "reviews": {
            "count": len(reviews),
            "avg_rating": round(sum(row.rating for row in reviews) / len(reviews), 1) if reviews else None,
            "items": [
                {
                    "id": str(row.id),
                    "rating": row.rating,
                    "title": row.title,
                    "status": row.moderation_status.value,
                    "status_label": _review_status_label(row.moderation_status.value),
                    "target_label": "Клиника" if str(row.target_type.value) == "clinic" else "Врач",
                }
                for row in reviews[:20]
            ],
        },
        "audit": [
            {
                "id": str(row.id),
                "action": row.action,
                "action_label": _audit_action_label(row.action),
                "target_type": row.target_type,
                "actor_name": "Системный журнал",
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "created_at_label": row.created_at.astimezone(timezone.utc).strftime("%d.%m.%Y %H:%M") if row.created_at else "—",
            }
            for row in recent_audit
        ],
        "stats": {
            "branches": max(0, len(locations) - 1),
            "locations": len(locations),
            "staff": len(staff_payload),
            "vets": sum(1 for row in staff_payload if row["role_in_clinic"] == "vet"),
            "admins": sum(1 for row in staff_payload if row["role_in_clinic"] == "clinic_admin"),
            "patients": len(consents),
            "active_inpatient": len(inpatient),
            "services": len(services),
            "templates": len(templates),
            "upcoming_appointments": len(upcoming_appointments),
            "ai_overrides": len(overrides),
            "consent_scope_counts": consent_scope_counts,
        },
    }


async def _resolve_my_clinic(
    db: AsyncSession,
    *,
    user_id,
    clinic_id: str | None = None,
) -> Membership:
    membership_query = select(Membership).where(
        Membership.user_id == user_id,
        Membership.status == MembershipStatus.active,
    )
    if clinic_id:
        try:
            clinic_uuid = uuid.UUID(clinic_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": "Invalid clinic_id format"},
            ) from exc
        membership_query = membership_query.where(Membership.clinic_id == clinic_uuid)

    membership = await db.scalar(membership_query.order_by(Membership.created_at.asc()))
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CLINIC_MEMBERSHIP_NOT_FOUND", "message": "No active clinic membership found"},
        )
    return membership


@router.get("/me")
async def my_clinic(
    clinic_id: str | None = None,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    membership = await _resolve_my_clinic(db, user_id=current_user.id, clinic_id=clinic_id)
    clinic = await db.scalar(select(Clinic).where(Clinic.id == membership.clinic_id))
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CLINIC_NOT_FOUND", "message": "Clinic not found"},
        )
    clinic_locations = (
        await db.scalars(
            select(ClinicLocation)
            .where(ClinicLocation.clinic_id == clinic.id)
            .order_by(ClinicLocation.is_primary.desc(), ClinicLocation.created_at.asc())
        )
    ).all()
    primary_location = _select_primary_location(clinic_locations)
    return {
        "id": str(clinic.id),
        "name": clinic.name,
        "address": clinic.address,
        "role_in_clinic": membership.role_in_clinic.value,
        "membership_status": membership.status.value,
        "website": clinic.website,
        "logo_url": clinic.logo_url,
        "photos": clinic.photos_json or [],
        "locations": [_serialize_clinic_location(location) for location in clinic_locations],
        "primary_location": _serialize_clinic_location(primary_location) if primary_location else None,
    }


@router.get("/me/members")
async def my_clinic_members(
    clinic_id: str | None = None,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    membership = await _resolve_my_clinic(db, user_id=current_user.id, clinic_id=clinic_id)
    members = (
        await db.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(Membership.clinic_id == membership.clinic_id)
            .order_by(User.full_name.asc())
        )
    ).all()
    return [
        {
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role.value,
            "role_in_clinic": member_row.role_in_clinic.value,
            "status": member_row.status.value,
        }
        for member_row, user in members
    ]


@router.get("/me/patients")
async def my_clinic_patients(
    clinic_id: str | None = None,
    q: str | None = None,
    limit: int = 500,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    membership = await _resolve_my_clinic(db, user_id=current_user.id, clinic_id=clinic_id)
    now = datetime.now(timezone.utc)

    grants = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.clinic_id == membership.clinic_id,
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all()

    pet_scope_map: dict[uuid.UUID, ConsentScope] = {}
    for grant in grants:
        if grant.expires_at and grant.expires_at <= now:
            continue
        existing_scope = pet_scope_map.get(grant.pet_id)
        if not existing_scope or CONSENT_SCOPE_RANK[grant.scope_level] > CONSENT_SCOPE_RANK[existing_scope]:
            pet_scope_map[grant.pet_id] = grant.scope_level

    if not pet_scope_map:
        return []

    pet_ids = list(pet_scope_map.keys())
    pets = (
        await db.scalars(
            select(MasterPet)
            .where(MasterPet.id.in_(pet_ids))
            .order_by(MasterPet.name.asc())
            .limit(max(1, min(limit, 1000)))
        )
    ).all()

    owner_rows = (
        await db.execute(
            select(PetOwnerLink, User)
            .join(User, User.id == PetOwnerLink.owner_user_id)
            .where(PetOwnerLink.pet_id.in_(pet_ids))
        )
    ).all()
    owner_by_pet: dict[uuid.UUID, User] = {}
    for link, owner_user in owner_rows:
        if link.pet_id not in owner_by_pet:
            owner_by_pet[link.pet_id] = owner_user

    rows = []
    for pet in pets:
        owner_user = owner_by_pet.get(pet.id)
        scope = pet_scope_map.get(pet.id)
        rows.append(
            {
                "pet_id": str(pet.id),
                "pet_name": pet.name,
                "species": pet.species,
                "breed": pet.breed,
                "chip_id": pet.chip_id,
                "passport_id": pet.passport_id,
                "owner_user_id": str(owner_user.id) if owner_user else None,
                "owner_name": owner_user.full_name if owner_user else None,
                "owner_email": owner_user.email if owner_user else None,
                "consent_scope": scope.value if scope else None,
            }
        )

    if q:
        query = q.strip().lower()
        if query:
            rows = [
                row
                for row in rows
                if any(
                    query in str(value).lower()
                    for value in (
                        row["pet_name"],
                        row["species"],
                        row["breed"],
                        row["chip_id"],
                        row["owner_name"],
                        row["owner_email"],
                    )
                    if value
                )
            ]

    return rows[: max(1, min(limit, 1000))]


@router.get("/{clinic_id}/overview")
async def clinic_overview(
    clinic_id: str,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin, RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        clinic_uuid = uuid.UUID(clinic_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid clinic_id format"},
        ) from exc

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    clinic = await db.scalar(select(Clinic).where(Clinic.id == clinic_uuid))
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CLINIC_NOT_FOUND", "message": "Clinic not found"},
        )

    members = (
        await db.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(Membership.clinic_id == clinic_uuid)
            .order_by(User.full_name.asc())
        )
    ).all()

    now = datetime.now(timezone.utc)
    active_consents_count = await db.scalar(
        select(func.count(ConsentGrant.id)).where(
            ConsentGrant.clinic_id == clinic_uuid,
            ConsentGrant.revoked_at.is_(None),
            (ConsentGrant.expires_at.is_(None) | (ConsentGrant.expires_at > now)),
        )
    )
    appointments_count = await db.scalar(select(func.count(Appointment.id)).where(Appointment.clinic_id == clinic_uuid))

    staff = [
        {
            "user_id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role.value,
            "role_in_clinic": membership.role_in_clinic.value,
            "status": membership.status.value,
        }
        for membership, user in members
    ]

    return {
        "clinic": {
            "id": str(clinic.id),
            "name": clinic.name,
            "address": clinic.address,
        },
        "staff": staff,
        "stats": {
            "staff_count": len(staff),
            "active_consents": int(active_consents_count or 0),
            "appointments_count": int(appointments_count or 0),
        },
    }


@router.get("/{clinic_id}/vets")
async def clinic_vets(
    clinic_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        clinic_uuid = uuid.UUID(clinic_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid clinic_id format"},
        ) from exc

    if current_user.role in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    rows = (
        await db.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(
                Membership.clinic_id == clinic_uuid,
                Membership.status == MembershipStatus.active,
                Membership.role_in_clinic == RoleEnum.vet,
            )
            .order_by(User.full_name.asc())
        )
    ).all()

    return [
        {
            "id": str(user.id),
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role.value,
            "role_in_clinic": member.role_in_clinic.value,
            "status": member.status.value,
        }
        for member, user in rows
    ]
