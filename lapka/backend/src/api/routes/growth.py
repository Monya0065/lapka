from __future__ import annotations

import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_text
from src.db.session import get_db_session
from src.models import (
    ClinicInvite,
    ClinicInviteStatus,
    LostPetReport,
    LostPetSighting,
    LostPetStatus,
    MasterPet,
    Notification,
    NotificationType,
    PetPassport,
    Referral,
    ReferralStatus,
    RoleEnum,
    User,
)
from src.security.deps import get_current_user, require_owner_of_pet, require_roles
from src.services.audit import log_audit
from src.utils.demo_media import resolve_demo_pet_photo

router = APIRouter(tags=["growth"])

_public_rate_windows: dict[str, deque[float]] = defaultdict(deque)
_PUBLIC_RATE_LIMIT = 80
_PUBLIC_WINDOW_SEC = 60


class PassportGenerateRequest(BaseModel):
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    allow_unmasked_phone: bool = False
    allergies_summary: str | None = Field(default=None, max_length=500)
    include_microchip: bool = True


class LostPetCreateRequest(BaseModel):
    pet_id: str
    city: str = Field(min_length=1, max_length=128)
    last_seen_location: str = Field(min_length=1, max_length=255)
    last_seen_time: datetime
    description: str = Field(min_length=1, max_length=2000)
    photo_url: str | None = Field(default=None, max_length=512)


class LostPetSightingRequest(BaseModel):
    reporter_name: str | None = Field(default=None, max_length=255)
    reporter_contact: str | None = Field(default=None, max_length=255)
    location_note: str | None = Field(default=None, max_length=255)
    message: str = Field(min_length=3, max_length=2000)


class ReferralInviteRequest(BaseModel):
    invited_email: str = Field(min_length=5, max_length=255)


class ClinicInviteCreateRequest(BaseModel):
    clinic_name: str = Field(min_length=1, max_length=255)
    clinic_email: str = Field(min_length=5, max_length=255)
    message: str | None = Field(default=None, max_length=2000)


class ClinicInviteModerateRequest(BaseModel):
    status: ClinicInviteStatus
    reason: str | None = Field(default=None, max_length=1000)


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "BAD_REQUEST", "message": message},
    )


def _as_uuid(raw: str, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise _bad_request(f"Invalid {field} format") from exc


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = [char for char in phone if char.isdigit()]
    if len(digits) < 4:
        return "***"
    return f"***-***-{''.join(digits[-2:])}"


def _generate_public_token() -> str:
    return secrets.token_urlsafe(32)


def _enforce_public_rate_limit(request: Request, scope: str) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"{scope}:{ip}"
    now = time.monotonic()
    window = _public_rate_windows[key]
    horizon = now - _PUBLIC_WINDOW_SEC
    while window and window[0] < horizon:
        window.popleft()
    if len(window) >= _PUBLIC_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": "Too many requests. Try again later."},
        )
    window.append(now)


def _serialize_lost_pet(report: LostPetReport, pet: MasterPet, *, include_private: bool = False) -> dict:
    payload = {
        "id": str(report.id),
        "pet_id": str(report.pet_id),
        "pet_name": pet.name,
        "species": pet.species,
        "breed": pet.breed,
        "city": report.city,
        "last_seen_location": report.last_seen_location,
        "last_seen_time": report.last_seen_time,
        "description": report.description,
        "photo_url": resolve_demo_pet_photo(
            species=pet.species,
            breed=pet.breed,
            photo_url=report.photo_url or pet.photo_url,
        ),
        "status": report.status.value if hasattr(report.status, "value") else str(report.status),
        "created_at": report.created_at,
    }
    if include_private:
        payload["owner_id"] = str(report.owner_id)
    return payload


def _serialize_passport(passport: PetPassport, pet: MasterPet) -> dict:
    public_link = f"/api/v1/public/pet/{passport.public_token}" if passport.public_token else None
    return {
        "id": str(passport.id),
        "pet_id": str(passport.pet_id),
        "token": passport.public_token,
        "public_link": public_link,
        "created_at": passport.created_at,
        "revoked_at": passport.revoked_at,
        "emergency_contact_phone": passport.emergency_contact_phone,
        "allow_unmasked_phone": passport.allow_unmasked_phone,
        "allergies_summary": passport.allergies_summary,
        "include_microchip": passport.include_microchip,
        "pet": {
            "name": pet.name,
            "species": pet.species,
            "breed": pet.breed,
            "color": pet.color,
            "photo": resolve_demo_pet_photo(species=pet.species, breed=pet.breed, photo_url=pet.photo_url),
            "chip_id": pet.chip_id,
        },
    }


@router.get("/owner/pets/{pet_id}/passport")
async def get_pet_passport(
    pet_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pet_uuid = _as_uuid(pet_id, "pet_id")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    passport = await db.scalar(select(PetPassport).where(PetPassport.pet_id == pet.id))
    if not passport:
        return {"pet_id": str(pet.id), "passport": None}

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet_passport.view",
        target_type="pet_passport",
        target_id=str(passport.id),
    )
    await db.commit()
    return {"pet_id": str(pet.id), "passport": _serialize_passport(passport, pet)}


@router.post("/owner/pets/{pet_id}/passport/generate")
async def generate_pet_passport(
    pet_id: str,
    payload: PassportGenerateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pet_uuid = _as_uuid(pet_id, "pet_id")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    passport = await db.scalar(select(PetPassport).where(PetPassport.pet_id == pet.id))
    token = _generate_public_token()

    if passport:
        passport.public_token = token
        passport.revoked_at = None
        passport.emergency_contact_phone = sanitize_text(payload.emergency_contact_phone, max_len=32) or None
        passport.allow_unmasked_phone = payload.allow_unmasked_phone
        passport.allergies_summary = sanitize_text(payload.allergies_summary, max_len=500) or None
        passport.include_microchip = payload.include_microchip
    else:
        passport = PetPassport(
            pet_id=pet.id,
            public_token=token,
            emergency_contact_phone=sanitize_text(payload.emergency_contact_phone, max_len=32) or None,
            allow_unmasked_phone=payload.allow_unmasked_phone,
            allergies_summary=sanitize_text(payload.allergies_summary, max_len=500) or None,
            include_microchip=payload.include_microchip,
        )
        db.add(passport)

    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet_passport.generate",
        target_type="pet_passport",
        target_id=str(passport.id),
        metadata={"pet_id": str(pet.id)},
    )
    await db.commit()

    return {"status": "ok", "passport": _serialize_passport(passport, pet)}


@router.post("/owner/pets/{pet_id}/passport/revoke")
async def revoke_pet_passport(
    pet_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pet_uuid = _as_uuid(pet_id, "pet_id")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    passport = await db.scalar(select(PetPassport).where(PetPassport.pet_id == pet_uuid))
    if not passport:
        raise HTTPException(status_code=404, detail={"code": "PASSPORT_NOT_FOUND", "message": "Passport not found"})

    passport.revoked_at = datetime.now(timezone.utc)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet_passport.revoke",
        target_type="pet_passport",
        target_id=str(passport.id),
    )
    await db.commit()
    return {"status": "revoked", "id": str(passport.id)}


@router.get("/public/pet/{token}")
async def get_public_pet_profile(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _enforce_public_rate_limit(request, "pet_passport")

    passport = await db.scalar(select(PetPassport).where(PetPassport.public_token == token))
    if not passport or passport.revoked_at is not None:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Passport not found"})

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == passport.pet_id))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    await log_audit(
        db,
        actor_user_id=None,
        clinic_id=None,
        action="pet_passport.public_view",
        target_type="pet_passport",
        target_id=str(passport.id),
        metadata={"ip": request.client.host if request.client else "unknown"},
    )
    await db.commit()

    return {
        "pet_name": pet.name,
        "species": pet.species,
        "breed": pet.breed,
        "color": pet.color,
        "photo": resolve_demo_pet_photo(species=pet.species, breed=pet.breed, photo_url=pet.photo_url),
        "allergies_summary": passport.allergies_summary,
        "microchip_id": pet.chip_id if passport.include_microchip else None,
        "emergency_contact_phone": (
            passport.emergency_contact_phone
            if passport.allow_unmasked_phone
            else _mask_phone(passport.emergency_contact_phone)
        ),
        "contact_action": "report_sighting",
        "disclaimer": "Публичный паспорт содержит только безопасный профиль питомца и контакт для связи.",
    }


@router.post("/owner/lost-pets")
async def create_lost_pet_report(
    payload: LostPetCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    pet_uuid = _as_uuid(payload.pet_id, "pet_id")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    report = LostPetReport(
        pet_id=pet.id,
        owner_id=current_user.id,
        city=sanitize_text(payload.city, max_len=128),
        last_seen_location=sanitize_text(payload.last_seen_location, max_len=255),
        last_seen_time=payload.last_seen_time,
        description=sanitize_text(payload.description, max_len=2000),
        photo_url=sanitize_text(payload.photo_url, max_len=512) or None,
        status=LostPetStatus.active,
    )
    db.add(report)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="lost_pet.create",
        target_type="lost_pet_report",
        target_id=str(report.id),
        metadata={"pet_id": str(pet.id)},
    )
    await db.commit()

    return {"status": "ok", "report": _serialize_lost_pet(report, pet, include_private=True)}


@router.get("/lost-pets")
async def list_lost_pets(
    request: Request,
    city: str | None = Query(default=None),
    include_found: bool = Query(default=False),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _enforce_public_rate_limit(request, "lost_pets")

    query = select(LostPetReport).order_by(LostPetReport.created_at.desc()).limit(200)
    if city:
        query = query.where(LostPetReport.city.ilike(f"%{city.strip()}%"))
    if not include_found:
        query = query.where(LostPetReport.status == LostPetStatus.active)

    reports = (await db.scalars(query)).all()
    if not reports:
        return []

    pet_ids = [row.pet_id for row in reports]
    pets = (await db.scalars(select(MasterPet).where(MasterPet.id.in_(pet_ids)))).all()
    pet_map = {pet.id: pet for pet in pets}

    rows = []
    for report in reports:
        pet = pet_map.get(report.pet_id)
        if not pet:
            continue
        rows.append(_serialize_lost_pet(report, pet))
    return rows


@router.get("/lost-pets/{report_id}")
async def get_lost_pet_report(
    report_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _enforce_public_rate_limit(request, "lost_pet_detail")
    report_uuid = _as_uuid(report_id, "report_id")

    report = await db.scalar(select(LostPetReport).where(LostPetReport.id == report_uuid))
    if not report:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lost pet report not found"})

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == report.pet_id))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    sightings = (
        await db.scalars(
            select(LostPetSighting)
            .where(LostPetSighting.report_id == report.id)
            .order_by(LostPetSighting.created_at.desc())
            .limit(20)
        )
    ).all()

    return {
        **_serialize_lost_pet(report, pet),
        "sightings": [
            {
                "id": str(item.id),
                "reporter_name": item.reporter_name,
                "location_note": item.location_note,
                "message": item.message,
                "created_at": item.created_at,
            }
            for item in sightings
        ],
    }


@router.post("/lost-pets/{report_id}/sightings", status_code=status.HTTP_201_CREATED)
async def create_lost_pet_sighting(
    report_id: str,
    payload: LostPetSightingRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _enforce_public_rate_limit(request, "lost_pet_sighting")
    report_uuid = _as_uuid(report_id, "report_id")

    report = await db.scalar(select(LostPetReport).where(LostPetReport.id == report_uuid))
    if not report:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lost pet report not found"})
    if report.status != LostPetStatus.active:
        raise HTTPException(
            status_code=409,
            detail={"code": "REPORT_CLOSED", "message": "Lost pet report is not active"},
        )

    sighting = LostPetSighting(
        report_id=report.id,
        reporter_name=sanitize_text(payload.reporter_name, max_len=255) or None,
        reporter_contact=sanitize_text(payload.reporter_contact, max_len=255) or None,
        location_note=sanitize_text(payload.location_note, max_len=255) or None,
        message=sanitize_text(payload.message, max_len=2000),
    )
    db.add(sighting)
    db.add(
        Notification(
            user_id=report.owner_id,
            pet_id=report.pet_id,
            notification_type=NotificationType.inpatient_update,
            title="Есть новое сообщение по пропавшему питомцу",
            body="Поступила новая информация о местонахождении питомца. Откройте раздел Lost Pet.",
            metadata_json={
                "report_id": str(report.id),
                "sighting_message": payload.message[:160],
                "source": "lost_pet",
            },
            is_read=False,
        )
    )

    await log_audit(
        db,
        actor_user_id=None,
        clinic_id=None,
        action="lost_pet.sighting.create",
        target_type="lost_pet_report",
        target_id=str(report.id),
        metadata={"ip": request.client.host if request.client else "unknown"},
    )
    await db.commit()

    return {"status": "ok", "id": str(sighting.id)}


@router.post("/owner/lost-pets/{report_id}/mark-found")
async def mark_lost_pet_found(
    report_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    report_uuid = _as_uuid(report_id, "report_id")
    report = await db.scalar(select(LostPetReport).where(LostPetReport.id == report_uuid))
    if not report:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lost pet report not found"})
    if report.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Access denied"})

    report.status = LostPetStatus.found
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="lost_pet.mark_found",
        target_type="lost_pet_report",
        target_id=str(report.id),
    )
    await db.commit()
    return {"status": "found", "id": str(report.id)}


@router.post("/referrals/invite", status_code=status.HTTP_201_CREATED)
async def invite_referral(
    payload: ReferralInviteRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    email = sanitize_text(payload.invited_email, max_len=255).lower()
    if "@" not in email:
        raise _bad_request("Invalid invited_email")

    referral = Referral(
        inviter_user_id=current_user.id,
        invited_email=email,
        referral_code=f"LPK-{secrets.token_hex(6).upper()}",
        status=ReferralStatus.sent,
    )
    db.add(referral)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="referral.invite",
        target_type="referral",
        target_id=str(referral.id),
        metadata={"invited_email": email},
    )
    await db.commit()

    return {
        "id": str(referral.id),
        "invited_email": referral.invited_email,
        "referral_code": referral.referral_code,
        "status": referral.status.value,
        "created_at": referral.created_at,
    }


@router.get("/referrals/my")
async def list_my_referrals(
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    rows = (
        await db.scalars(
            select(Referral)
            .where(Referral.inviter_user_id == current_user.id)
            .order_by(Referral.created_at.desc())
            .limit(200)
        )
    ).all()

    return [
        {
            "id": str(row.id),
            "invited_email": row.invited_email,
            "referral_code": row.referral_code,
            "status": row.status.value if hasattr(row.status, "value") else str(row.status),
            "created_at": row.created_at,
            "registered_at": row.registered_at,
        }
        for row in rows
    ]


@router.post("/clinic-invites", status_code=status.HTTP_201_CREATED)
async def create_clinic_invite(
    payload: ClinicInviteCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_email = sanitize_text(payload.clinic_email, max_len=255).lower()
    if "@" not in clinic_email:
        raise _bad_request("Invalid clinic_email")

    invite = ClinicInvite(
        inviter_user_id=current_user.id,
        clinic_name=sanitize_text(payload.clinic_name, max_len=255),
        clinic_email=clinic_email,
        message=sanitize_text(payload.message, max_len=2000) if payload.message else None,
        status=ClinicInviteStatus.pending,
    )
    db.add(invite)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="clinic_invite.create",
        target_type="clinic_invite",
        target_id=str(invite.id),
        metadata={"clinic_email": clinic_email},
    )
    await db.commit()

    return {
        "id": str(invite.id),
        "clinic_name": invite.clinic_name,
        "clinic_email": invite.clinic_email,
        "status": invite.status.value,
        "created_at": invite.created_at,
    }


@router.get("/admin/clinic-invites")
async def list_clinic_invites(
    status_filter: ClinicInviteStatus | None = Query(default=None, alias="status"),
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query = select(ClinicInvite).order_by(ClinicInvite.created_at.desc()).limit(300)
    if status_filter is not None:
        query = query.where(ClinicInvite.status == status_filter)

    rows = (await db.scalars(query)).all()
    inviter_ids = {row.inviter_user_id for row in rows}
    inviter_rows = (
        await db.scalars(
            select(User).where(User.id.in_(inviter_ids))
        )
    ).all() if inviter_ids else []
    inviter_map = {row.id: row for row in inviter_rows}

    return [
        {
            "id": str(row.id),
            "clinic_name": row.clinic_name,
            "clinic_email": row.clinic_email,
            "message": row.message,
            "status": row.status.value if hasattr(row.status, "value") else str(row.status),
            "created_at": row.created_at,
            "inviter_user_id": str(row.inviter_user_id),
            "inviter_email": inviter_map.get(row.inviter_user_id).email if inviter_map.get(row.inviter_user_id) else None,
            "inviter_name": inviter_map.get(row.inviter_user_id).full_name if inviter_map.get(row.inviter_user_id) else None,
            "reviewed_at": row.reviewed_at,
            "review_note": row.review_note,
        }
        for row in rows
    ]


@router.patch("/admin/clinic-invites/{invite_id}/moderate")
async def moderate_clinic_invite(
    invite_id: str,
    payload: ClinicInviteModerateRequest,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    invite_uuid = _as_uuid(invite_id, "invite_id")
    invite = await db.scalar(select(ClinicInvite).where(ClinicInvite.id == invite_uuid))
    if not invite:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Clinic invite not found"})

    if payload.status not in {ClinicInviteStatus.approved, ClinicInviteStatus.rejected}:
        raise _bad_request("Only approved or rejected statuses are allowed")

    invite.status = payload.status
    invite.review_note = sanitize_text(payload.reason, max_len=1000) if payload.reason else None
    invite.reviewed_by_user_id = current_user.id
    invite.reviewed_at = datetime.now(timezone.utc)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="clinic_invite.moderate",
        target_type="clinic_invite",
        target_id=str(invite.id),
        metadata={"status": invite.status.value},
    )
    await db.commit()

    return {
        "id": str(invite.id),
        "status": invite.status.value,
        "review_note": invite.review_note,
        "reviewed_at": invite.reviewed_at,
    }
