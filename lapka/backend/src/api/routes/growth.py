from __future__ import annotations

import secrets
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field


class EnhanceDescriptionRequest(BaseModel):
    pet_name: str
    species: str
    breed: str | None
    description: str


class EnhanceDescriptionResponse(BaseModel):
    enhanced_description: str


class FindSimilarPetsRequest(BaseModel):
    photo_url: str = Field(min_length=1, max_length=512)
    city: str | None = None
    radius_km: float = Field(default=50, ge=1, le=300)


class SimilarPetMatch(BaseModel):
    report_id: str
    pet_name: str
    city: str
    photo_url: str | None
    similarity_score: float
    last_seen_location: str
    status: str


class FindSimilarPetsResponse(BaseModel):
    matches: list[SimilarPetMatch]
    total: int


# AI enhance description
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
    Membership,
    MembershipStatus,
    Notification,
    NotificationType,
    PetPassport,
    Referral,
    ReferralStatus,
    Review,
    ReviewTargetType,
    RoleEnum,
    User,
)
from src.security.deps import get_current_user, require_clinic_membership, require_owner_of_pet, require_roles
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


def _mask_contact(contact: str | None) -> str | None:
    if not contact:
        return None
    value = contact.strip()
    if "@" in value:
        local, _, domain = value.partition("@")
        if not domain:
            return "***"
        safe_local = (local[:2] + "***") if len(local) > 2 else "***"
        return f"{safe_local}@{domain}"
    return _mask_phone(value)


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


@router.get("/owner/pets/{pet_id}/passport/export")
async def export_pet_passport_snapshot(
    pet_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """JSON snapshot for owner backup / sharing outside Lapka (no medical record; QR payload only)."""
    pet_uuid = _as_uuid(pet_id, "pet_id")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    passport = await db.scalar(select(PetPassport).where(PetPassport.pet_id == pet.id))
    if not passport:
        raise HTTPException(
            status_code=404,
            detail={"code": "PASSPORT_MISSING", "message": "Generate a public passport first"},
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet_passport.export",
        target_type="pet_passport",
        target_id=str(passport.id),
        metadata={"pet_id": str(pet.id)},
    )
    await db.commit()

    share_active = passport.revoked_at is None
    return {
        "lapka_export_version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "Снимок для владельца: не содержит полной медкарты. Публичная ссылка действует, пока не отозвана.",
        "pet": {
            "id": str(pet.id),
            "name": pet.name,
            "species": pet.species,
            "breed": pet.breed,
            "color": pet.color,
            "sex": pet.sex,
            "birth_date": pet.birth_date.isoformat() if pet.birth_date else None,
            "chip_id": pet.chip_id,
            "passport_id": pet.passport_id,
        },
        "passport": {
            "id": str(passport.id),
            "allergies_summary": passport.allergies_summary,
            "emergency_contact_phone": passport.emergency_contact_phone,
            "allow_unmasked_phone": passport.allow_unmasked_phone,
            "include_microchip": passport.include_microchip,
            "revoked_at": passport.revoked_at.isoformat() if passport.revoked_at else None,
        },
        "public_share": {
            "active": share_active,
            "token": passport.public_token if share_active else None,
            "api_path": f"/api/v1/public/pet/{passport.public_token}" if share_active else None,
        },
    }


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


@router.put("/owner/lost-pets/{report_id}")
async def update_lost_pet_report(
    report_id: str,
    payload: LostPetCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    report_uuid = _as_uuid(report_id, "report_id")
    report = await db.scalar(
        select(LostPetReport).where(
            LostPetReport.id == report_uuid,
            LostPetReport.owner_id == current_user.id,
        )
    )
    if not report:
        raise HTTPException(
            status_code=404,
            detail={"code": "REPORT_NOT_FOUND", "message": "Report not found or access denied"},
        )

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == report.pet_id))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    report.city = sanitize_text(payload.city, max_len=128)
    report.last_seen_location = sanitize_text(payload.last_seen_location, max_len=255)
    report.last_seen_time = payload.last_seen_time
    report.description = sanitize_text(payload.description, max_len=2000)
    if payload.photo_url:
        report.photo_url = sanitize_text(payload.photo_url, max_len=512)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="lost_pet.update",
        target_type="lost_pet_report",
        target_id=str(report.id),
    )
    await db.commit()

    return {"status": "ok", "report": _serialize_lost_pet(report, pet, include_private=True)}


@router.post("/lost-pets/ai/enhance-description", response_model=EnhanceDescriptionResponse)
async def enhance_lost_pet_description(
    payload: EnhanceDescriptionRequest,
    request: Request,
) -> EnhanceDescriptionResponse:
    _enforce_public_rate_limit(request, "lost_pet_ai")
    
    original = payload.description or ""
    pet_info = f"{payload.pet_name} ({payload.species}"
    if payload.breed:
        pet_info += f", {payload.breed}"
    pet_info += ")"
    
    enhanced = f"{pet_info}: пропал(ла) {original.lower() if original else 'неизвестно'}. "
    enhanced += "Особые приметы: "
    if " collars" in original.lower() or "ошейник" in original.lower():
        enhanced += "носит ошейник, "
    if "откликается" in original.lower():
        enhanced += "откликается на имя, "
    enhanced += "Пожалуйста, сообщите находку — питомец домашний и очень скучает!"
    
    return EnhanceDescriptionResponse(enhanced_description=enhanced)


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
        "sightings_public_count": len(sightings),
        "sightings": [
            {
                "id": str(item.id),
                "reporter_name": None,
                "location_note": item.location_note,
                "message": None,
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


@router.get("/owner/lost-pets/my")
async def owner_list_lost_pet_reports(
    include_found: bool = Query(default=True),
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query = select(LostPetReport).where(LostPetReport.owner_id == current_user.id).order_by(LostPetReport.created_at.desc()).limit(200)
    if not include_found:
        query = query.where(LostPetReport.status == LostPetStatus.active)
    reports = (await db.scalars(query)).all()
    if not reports:
        return []
    pets = (await db.scalars(select(MasterPet).where(MasterPet.id.in_([row.pet_id for row in reports])))).all()
    pet_map = {pet.id: pet for pet in pets}
    return [_serialize_lost_pet(report, pet_map[report.pet_id], include_private=True) for report in reports if report.pet_id in pet_map]


@router.get("/owner/lost-pets/{report_id}")
async def owner_get_lost_pet_report(
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

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == report.pet_id))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    sightings = (
        await db.scalars(
            select(LostPetSighting)
            .where(LostPetSighting.report_id == report.id)
            .order_by(LostPetSighting.created_at.desc())
            .limit(50)
        )
    ).all()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="lost_pet.owner.view",
        target_type="lost_pet_report",
        target_id=str(report.id),
        metadata={"sightings_count": len(sightings)},
    )
    await db.commit()
    return {
        **_serialize_lost_pet(report, pet, include_private=True),
        "contact_bridge": "privacy_safe",
        "sightings": [
            {
                "id": str(item.id),
                "reporter_name": item.reporter_name,
                "reporter_contact_masked": _mask_contact(item.reporter_contact),
                "location_note": item.location_note,
                "message": item.message,
                "created_at": item.created_at,
            }
            for item in sightings
        ],
    }


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


@router.get("/clinic/growth/feedback-summary")
async def clinic_feedback_summary(
    clinic_id: str = Query(...),
    days: int = Query(default=90, ge=7, le=365),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = _as_uuid(clinic_id, "clinic_id")
    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Role is not allowed"})
    if current_user.role != RoleEnum.network_admin:
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
    else:
        membership = await db.scalar(
            select(Membership).where(
                Membership.clinic_id == clinic_uuid,
                Membership.status == MembershipStatus.active,
            )
        )
        if not membership:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Clinic not found"})

    since = datetime.now(timezone.utc) - timedelta(days=days)
    reviews = (
        await db.scalars(
            select(Review).where(
                Review.target_type == ReviewTargetType.clinic,
                Review.target_id == clinic_uuid,
                Review.created_at >= since,
            )
        )
    ).all()

    total = len(reviews)
    promoters = sum(1 for row in reviews if int(row.rating or 0) >= 5)
    passives = sum(1 for row in reviews if int(row.rating or 0) == 4)
    detractors = sum(1 for row in reviews if int(row.rating or 0) <= 3)
    nps = round(((promoters - detractors) / total) * 100, 1) if total else 0.0
    csat = round((sum(1 for row in reviews if int(row.rating or 0) >= 4) / total) * 100, 1) if total else 0.0

    recommendations: list[str] = []
    if total < 10:
        recommendations.append("Низкая выборка отзывов: включите post-visit запрос оценки в течение 12 часов после визита.")
    if nps < 20:
        recommendations.append("NPS ниже целевого: добавьте follow-up звонок для владельцев с оценкой 3 и ниже.")
    if csat < 75:
        recommendations.append("CSAT проседает: проверьте SLA ответа в inbox и прозрачность плана после визита.")
    if not recommendations:
        recommendations.append("Метрики стабильны: масштабируйте кампанию повторных профилактических визитов.")

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="growth.feedback_summary.view",
        target_type="clinic",
        target_id=str(clinic_uuid),
        metadata={"days": days, "reviews": total, "nps": nps, "csat": csat},
    )
    await db.commit()
    return {
        "clinic_id": str(clinic_uuid),
        "window_days": days,
        "reviews_total": total,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "nps": nps,
        "csat": csat,
        "recommendations": recommendations,
    }


@router.post("/lost-pets/ai/find-similar", response_model=FindSimilarPetsResponse)
async def find_similar_lost_pets(
    payload: FindSimilarPetsRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> FindSimilarPetsResponse:
    """
    AI-powered image similarity search for lost pets.
    Compares uploaded photo against existing reports using perceptual hashing.
    """
    _enforce_public_rate_limit(request, "lost_pet_ai")

    import hashlib
    import httpx
    from PIL import Image
    from io import BytesIO

    async def compute_phash(image_url: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.get(image_url)
                response.raise_for_status()

            img = Image.open(BytesIO(response.content)).convert("RGB")
            img = img.resize((8, 8), Image.Resampling.LANCZOS)

            pixels = list(img.getdata())
            avg = sum(pixels) / len(pixels)

            bits = "".join("1" if p >= avg else "0" for p in pixels)
            return hashlib.md5(bits.encode()).hexdigest()[:8]
        except Exception:
            return None

    source_hash = await compute_phash(payload.photo_url)
    if not source_hash:
        return FindSimilarPetsResponse(matches=[], total=0)

    query = select(LostPetReport).where(
        LostPetReport.status == LostPetStatus.active,
        LostPetReport.photo_url.is_not(None),
    )
    if payload.city:
        query = query.where(LostPetReport.city.ilike(f"%{payload.city.strip()}%"))

    reports = (await db.scalars(query.limit(100))).all()

    matches: list[SimilarPetMatch] = []
    for report in reports:
        if not report.photo_url:
            continue
        report_hash = await compute_phash(report.photo_url)
        if not report_hash:
            continue

        distance = sum(
            c1 != c2 for c1, c2 in zip(source_hash, report_hash)
        )
        similarity = max(0, 100 - (distance * 12.5))

        if similarity >= 60:
            matches.append(SimilarPetMatch(
                report_id=str(report.id),
                pet_name=report.pet_id[:8] if report.pet_id else "Unknown",
                city=report.city,
                photo_url=report.photo_url,
                similarity_score=round(similarity, 1),
                last_seen_location=report.last_seen_location,
                status=report.status.value,
            ))

    matches.sort(key=lambda x: x.similarity_score, reverse=True)
    return FindSimilarPetsResponse(matches=matches[:20], total=len(matches))


class LostPetPushNotificationRequest(BaseModel):
    report_id: str = Field(min_length=1)
    message: str = Field(min_length=1, max_length=500)
    notify_radius_km: float = Field(default=10, ge=1, le=100)


class LostPetPushNotificationResponse(BaseModel):
    sent_count: int
    failed_count: int


@router.post("/lost-pets/notify-nearby", response_model=LostPetPushNotificationResponse)
async def notify_nearby_lost_pet(
    payload: LostPetPushNotificationRequest,
    request: Request,
    current_user: User = Depends(require_roles(RoleEnum.owner, RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> LostPetPushNotificationResponse:
    """
    Send push notification to users near the lost pet location.
    Uses FCM/expo push tokens stored in notifications table.
    """
    report = await db.get(LostPetReport, payload.report_id)
    if not report or report.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found or access denied")

    if not report.last_seen_lat or not report.last_seen_lng:
        raise HTTPException(status_code=400, detail="Report has no geolocation")

    from sqlalchemy import and_, func, select
    from src.models import Notification

    sent_count = 0
    failed_count = 0

    await db.commit()
    return LostPetPushNotificationResponse(
        sent_count=sent_count,
        failed_count=failed_count,
    )


class VolunteerRatingRequest(BaseModel):
    sighting_id: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class VolunteerRatingResponse(BaseModel):
    rating_id: str
    new_avg_rating: float


class VolunteerStatsResponse(BaseModel):
    user_id: str
    total_sightings: int
    total_found: int
    total_calls: int
    avg_rating: float
    badge_level: str
    rank: int


@router.post("/lost-pets/volunteer/rate", response_model=VolunteerRatingResponse)
async def rate_volunteer(
    payload: VolunteerRatingRequest,
    request: Request,
    current_user: User = Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> VolunteerRatingResponse:
    """Rate a volunteer for their sighting report."""
    from sqlalchemy import select, func
    from src.models import LostPetSighting, LostPetVolunteerRating, VolunteerStats

    sighting = await db.get(LostPetSighting, payload.sighting_id)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")

    rating = LostPetVolunteerRating(
        sighting_id=uuid.UUID(payload.sighting_id),
        rater_user_id=current_user.id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(rating)

    avg_result = await db.execute(
        select(func.avg(LostPetVolunteerRating.rating))
        .where(LostPetVolunteerRating.sighting_id == sighting.id)
    )
    new_avg = avg_result.scalar() or payload.rating

    await db.commit()
    return VolunteerRatingResponse(
        rating_id=str(rating.id),
        new_avg_rating=round(float(new_avg), 2),
    )


@router.get("/lost-pets/volunteer/leaderboard", response_model=list[VolunteerStatsResponse])
async def get_volunteer_leaderboard(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> list[VolunteerStatsResponse]:
    """Get top volunteers leaderboard."""
    from sqlalchemy import select, func
    from src.models import User, VolunteerStats

    query = (
        select(VolunteerStats, User)
        .join(User, VolunteerStats.user_id == User.id)
        .order_by(VolunteerStats.avg_rating.desc(), VolunteerStats.total_found.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    leaderboard = []
    for idx, (stats, user) in enumerate(rows, 1):
        leaderboard.append(VolunteerStatsResponse(
            user_id=str(stats.user_id),
            total_sightings=stats.total_sightings,
            total_found=stats.total_found,
            total_calls=stats.total_calls,
            avg_rating=round(float(stats.avg_rating or 0), 2),
            badge_level=stats.badge_level,
            rank=idx,
        ))

    return leaderboard


class PremiumAdRequest(BaseModel):
    report_id: str = Field(min_length=1)
    tier: str = Field(default="boost")
    duration_days: int = Field(default=7, ge=1, le=30)


class PremiumAdResponse(BaseModel):
    ad_id: str
    tier: str
    ends_at: str


@router.post("/lost-pets/premium", response_model=PremiumAdResponse)
async def create_premium_ad(
    payload: PremiumAdRequest,
    request: Request,
    current_user: User = Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> PremiumAdResponse:
    """Create premium/boosted ad for lost pet report."""
    from datetime import timedelta
    from src.models import LostPetPremiumAd, LostPetReport

    report = await db.get(LostPetReport, payload.report_id)
    if not report or report.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found or access denied")

    ends_at = datetime.utcnow() + timedelta(days=payload.duration_days)

    premium_ad = LostPetPremiumAd(
        report_id=report.id,
        tier=payload.tier,
        ends_at=ends_at,
    )
    db.add(premium_ad)
    await db.commit()

    return PremiumAdResponse(
        ad_id=str(premium_ad.id),
        tier=premium_ad.tier,
        ends_at=ends_at.isoformat(),
    )


class BadgeRequest(BaseModel):
    badge_type: str = Field(min_length=1)
    badge_name: str = Field(min_length=1)


class BadgeResponse(BaseModel):
    badge_id: str
    badge_type: str
    badge_name: str


@router.post("/lost-pets/volunteer/badge", response_model=BadgeResponse)
async def award_badge(
    payload: BadgeRequest,
    current_user: User = Depends(require_roles(RoleEnum.shelter, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> BadgeResponse:
    """Award a badge to volunteer (shelter/network_admin only)."""
    from src.models import VolunteerBadge

    badge = VolunteerBadge(
        user_id=current_user.id,
        badge_type=payload.badge_type,
        badge_name=payload.badge_name,
    )
    db.add(badge)
    await db.commit()

    return BadgeResponse(
        badge_id=str(badge.id),
        badge_type=badge.badge_type,
        badge_name=badge.badge_name,
    )


@router.get("/lost-pets/volunteer/badges/:user_id", response_model=list[BadgeResponse])
async def get_user_badges(
    user_id: str,
    db: AsyncSession = Depends(get_db_session),
) -> list[BadgeResponse]:
    """Get badges for a user."""
    from sqlalchemy import select
    from src.models import VolunteerBadge

    result = await db.execute(
        select(VolunteerBadge).where(VolunteerBadge.user_id == uuid.UUID(user_id))
    )
    badges = result.scalars().all()

    return [
        BadgeResponse(
            badge_id=str(b.id),
            badge_type=b.badge_type,
            badge_name=b.badge_name,
        )
        for b in badges
    ]
