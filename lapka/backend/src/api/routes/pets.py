from __future__ import annotations

import uuid
import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Appointment,
    ConsentGrant,
    ConsentScope,
    Document,
    InpatientStay,
    MasterPet,
    Membership,
    MembershipStatus,
    PetOwnerLink,
    PublicLink,
    RoleEnum,
    VaccineEntry,
    Visit,
)
from src.security.deps import (
    enforce_pet_scope,
    get_clinic_context,
    get_current_user,
    require_clinic_membership,
    require_owner_of_pet,
    require_roles,
)
from src.services.audit import log_audit
from src.utils.demo_media import resolve_demo_pet_photo

router = APIRouter(prefix="/pets", tags=["pets"])


class PetCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    species: str = Field(min_length=1, max_length=64)
    breed: str | None = Field(default=None, max_length=128)
    sex: str | None = Field(default=None, max_length=16)
    birth_date: date | None = None
    chip_id: str | None = Field(default=None, max_length=128)
    passport_id: str | None = Field(default=None, max_length=128)


class PetPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    species: str | None = Field(default=None, min_length=1, max_length=64)
    breed: str | None = Field(default=None, max_length=128)
    sex: str | None = Field(default=None, max_length=16)
    birth_date: date | None = None
    chip_id: str | None = Field(default=None, max_length=128)
    passport_id: str | None = Field(default=None, max_length=128)
    photo_url: str | None = None


class PetMatchRequest(BaseModel):
    chip_id: str | None = None
    passport_id: str | None = None
    owner_email: str | None = None
    owner_phone: str | None = None
    species: str | None = None
    birthdate_estimate: str | None = None


class MergeRequestCreate(BaseModel):
    duplicate_pet_id: str
    reason: str = "possible_duplicate"


class VaccineCreateRequest(BaseModel):
    vaccine_name: str = Field(min_length=1, max_length=255)
    administered_at: datetime
    next_due_date: datetime | None = None
    clinic_id: str | None = None


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "BAD_REQUEST", "message": message},
    )


def _serialize_pet(pet: MasterPet) -> dict:
    photo_url = resolve_demo_pet_photo(species=pet.species, breed=pet.breed, photo_url=pet.photo_url)
    return {
        "id": str(pet.id),
        "name": pet.name,
        "lapka_id": pet.lapka_id,
        "species": pet.species,
        "breed": pet.breed,
        "color": pet.color,
        "sex": pet.sex,
        "birth_date": pet.birth_date,
        "chip_id": pet.chip_id,
        "passport_id": pet.passport_id,
        "photo_url": photo_url,
        "created_at": pet.created_at,
    }


def _generate_lapka_id() -> str:
    return f"LPK-{secrets.token_hex(8).upper()}"


def _serialize_vaccine(row: VaccineEntry) -> dict:
    return {
        "id": str(row.id),
        "pet_id": str(row.pet_id),
        "clinic_id": str(row.clinic_id) if row.clinic_id else None,
        "vaccine_name": row.vaccine_name,
        "administered_at": row.administered_at,
        "next_due_date": row.next_due_date,
        "created_by": str(row.created_by),
        "created_at": row.created_at,
    }


async def _resolve_clinic_context_for_user(
    db: AsyncSession,
    *,
    current_user,
    clinic_id: str | None,
) -> uuid.UUID:
    if clinic_id:
        try:
            clinic_uuid = uuid.UUID(clinic_id)
        except ValueError as exc:
            raise _bad_request("Invalid clinic_id format") from exc
        await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
        return clinic_uuid

    membership = await db.scalar(
        select(Membership)
        .where(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.active,
        )
        .order_by(Membership.created_at.asc())
    )
    if not membership:
        raise _bad_request("clinic_id is required for clinic roles without active membership")
    return membership.clinic_id


@router.get("")
async def list_pets(
    clinic_id: str | None = Depends(get_clinic_context),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = None
    if current_user.role == RoleEnum.owner:
        query = (
            select(MasterPet)
            .join(PetOwnerLink, PetOwnerLink.pet_id == MasterPet.id)
            .where(PetOwnerLink.owner_user_id == current_user.id)
            .order_by(MasterPet.name.asc())
        )
    else:
        clinic_uuid = await _resolve_clinic_context_for_user(db, current_user=current_user, clinic_id=clinic_id)
        now = datetime.now(timezone.utc)
        query = (
            select(MasterPet)
            .join(
                ConsentGrant,
                and_(
                    ConsentGrant.pet_id == MasterPet.id,
                    ConsentGrant.clinic_id == clinic_uuid,
                    ConsentGrant.revoked_at.is_(None),
                    or_(ConsentGrant.expires_at.is_(None), ConsentGrant.expires_at > now),
                ),
            )
            .order_by(MasterPet.name.asc())
            .distinct()
        )

    pets = (await db.scalars(query)).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid) if clinic_uuid else None,
        action="pet.list",
        target_type="pet_collection",
        target_id=None,
    )
    await db.commit()

    return [_serialize_pet(p) for p in pets]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_pet(
    payload: PetCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only owner can create pets"},
        )

    pet = MasterPet(
        lapka_id=_generate_lapka_id(),
        name=payload.name.strip(),
        species=payload.species.strip().lower(),
        breed=payload.breed.strip() if payload.breed else None,
        sex=payload.sex.strip().lower() if payload.sex else None,
        birth_date=payload.birth_date,
        chip_id=payload.chip_id.strip() if payload.chip_id else None,
        passport_id=payload.passport_id.strip() if payload.passport_id else None,
    )
    db.add(pet)
    await db.flush()
    db.add(PetOwnerLink(pet_id=pet.id, owner_user_id=current_user.id))

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet.create",
        target_type="pet",
        target_id=str(pet.id),
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "PET_CONFLICT", "message": "chip_id/passport_id already exists"},
        ) from exc

    await db.refresh(pet)
    return _serialize_pet(pet)


@router.get("/{pet_id}")
async def get_pet(
    pet_id: str,
    clinic_id: str | None = Depends(get_clinic_context),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_uuid = uuid.UUID(pet_id)
    except ValueError as exc:
        raise _bad_request("Invalid id format") from exc

    clinic_uuid = None
    if current_user.role != RoleEnum.owner:
        clinic_uuid = await _resolve_clinic_context_for_user(db, current_user=current_user, clinic_id=clinic_id)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PET_NOT_FOUND", "message": "Pet not found"},
        )

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=pet.id,
        clinic_id=clinic_uuid,
        required_scope=ConsentScope.basic_medical,
    )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid) if clinic_uuid else None,
        action="pet.view",
        target_type="pet",
        target_id=str(pet.id),
    )
    await db.commit()
    return _serialize_pet(pet)


@router.patch("/{pet_id}")
async def update_pet(
    pet_id: str,
    payload: PetPatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_uuid = uuid.UUID(pet_id)
    except ValueError as exc:
        raise _bad_request("Invalid pet id format") from exc

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    if current_user.role != RoleEnum.owner:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only owner can edit pet profile"})
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet.id)

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        if field == "species" and isinstance(value, str):
            value = value.lower()
        setattr(pet, field, value if value != "" else None)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet.update",
        target_type="pet",
        target_id=str(pet.id),
    )
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "PET_CONFLICT", "message": "chip_id/passport_id already exists"},
        ) from exc
    await db.refresh(pet)
    return _serialize_pet(pet)


@router.delete("/{pet_id}")
async def delete_pet(
    pet_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_uuid = uuid.UUID(pet_id)
    except ValueError as exc:
        raise _bad_request("Invalid pet id format") from exc

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    if current_user.role != RoleEnum.owner:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only owner can delete pet"})
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet.id)

    # Keep the cross-role demo scenario stable: Barsik is a protected seed entity.
    if str(pet.id) == "55555555-5555-5555-5555-555555555555" or pet.chip_id == "BARSIK-CHIP-001":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PET_PROTECTED",
                "message": "Demo pet Барсик is protected and cannot be deleted.",
            },
        )

    # Prevent deleting pets that already have medical or operational history.
    has_visit = await db.scalar(select(Visit.id).where(Visit.pet_id == pet.id).limit(1))
    has_doc = await db.scalar(select(Document.id).where(Document.pet_id == pet.id).limit(1))
    has_appt = await db.scalar(select(Appointment.id).where(Appointment.pet_id == pet.id).limit(1))
    has_stay = await db.scalar(select(InpatientStay.id).where(InpatientStay.pet_id == pet.id).limit(1))
    has_consent = await db.scalar(select(ConsentGrant.id).where(ConsentGrant.pet_id == pet.id).limit(1))
    has_public_link = await db.scalar(select(PublicLink.id).where(PublicLink.pet_id == pet.id).limit(1))

    if any([has_visit, has_doc, has_appt, has_stay, has_consent, has_public_link]):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "PET_HAS_HISTORY",
                "message": "Pet has related records (visits/documents/appointments/consents) and cannot be deleted.",
            },
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet.delete",
        target_type="pet",
        target_id=str(pet.id),
    )
    await db.delete(pet)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{pet_id}/vaccines")
async def list_pet_vaccines(
    pet_id: str,
    clinic_id: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    try:
        pet_uuid = uuid.UUID(pet_id)
    except ValueError as exc:
        raise _bad_request("Invalid pet_id/clinic_id format") from exc

    clinic_uuid = None
    if current_user.role != RoleEnum.owner:
        clinic_uuid = await _resolve_clinic_context_for_user(db, current_user=current_user, clinic_id=clinic_id)

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    else:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=pet_uuid,
            clinic_id=clinic_uuid,
            required_scope=ConsentScope.basic_medical,
        )

    rows = (
        await db.scalars(
            select(VaccineEntry)
            .where(VaccineEntry.pet_id == pet_uuid)
            .order_by(VaccineEntry.administered_at.desc(), VaccineEntry.created_at.desc())
        )
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid) if clinic_uuid else None,
        action="vaccine.list",
        target_type="pet",
        target_id=str(pet_uuid),
    )
    await db.commit()
    return [_serialize_vaccine(row) for row in rows]


@router.post("/{pet_id}/vaccines", status_code=status.HTTP_201_CREATED)
async def create_pet_vaccine(
    pet_id: str,
    payload: VaccineCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_uuid = uuid.UUID(pet_id)
        clinic_uuid = uuid.UUID(payload.clinic_id) if payload.clinic_id else None
    except ValueError as exc:
        raise _bad_request("Invalid pet_id/clinic_id format") from exc

    if current_user.role not in {RoleEnum.owner, RoleEnum.vet}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only owner or vet can create vaccine entries"},
        )

    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)
    else:
        await enforce_pet_scope(
            db,
            current_user=current_user,
            pet_id=pet_uuid,
            clinic_id=clinic_uuid,
            required_scope=ConsentScope.basic_medical,
        )

    row = VaccineEntry(
        pet_id=pet_uuid,
        clinic_id=clinic_uuid,
        vaccine_name=payload.vaccine_name.strip(),
        administered_at=payload.administered_at,
        next_due_date=payload.next_due_date,
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid) if clinic_uuid else None,
        action="vaccine.create",
        target_type="vaccine_entry",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_vaccine(row)


@router.post("/match")
async def match_pet(
    payload: PetMatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # Deterministic matching for demo:
    # 1) chip_id exact match
    # 2) passport_id exact match
    # 3) species-only possible matches
    exact: MasterPet | None = None
    possible: list[MasterPet] = []

    if payload.chip_id:
        exact = await db.scalar(select(MasterPet).where(MasterPet.chip_id == payload.chip_id.strip()))
    if not exact and payload.passport_id:
        exact = await db.scalar(select(MasterPet).where(MasterPet.passport_id == payload.passport_id.strip()))

    if not exact and payload.species:
        possible = (
            await db.scalars(
                select(MasterPet).where(MasterPet.species == payload.species.strip().lower()).order_by(MasterPet.created_at.desc()).limit(10)
            )
        ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet.match",
        target_type="pet_registry",
        target_id=str(exact.id) if exact else None,
    )
    await db.commit()

    return {
        "exact_match": _serialize_pet(exact) if exact else None,
        "possible_matches": [_serialize_pet(p) for p in possible],
        "requires_owner_confirmation": exact is None and bool(possible),
    }


@router.post("/{master_pet_id}/merge-request")
async def create_merge_request(
    master_pet_id: str,
    payload: MergeRequestCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        src_uuid = uuid.UUID(master_pet_id)
        dup_uuid = uuid.UUID(payload.duplicate_pet_id)
    except ValueError as exc:
        raise _bad_request("Invalid pet id format") from exc

    src = await db.scalar(select(MasterPet).where(MasterPet.id == src_uuid))
    dup = await db.scalar(select(MasterPet).where(MasterPet.id == dup_uuid))
    if not src or not dup:
        raise HTTPException(status_code=404, detail={"code": "PET_NOT_FOUND", "message": "Pet not found"})

    merge_id = str(uuid.uuid4())
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet.merge.request",
        target_type="pet_merge_request",
        target_id=merge_id,
        metadata={"master_pet_id": master_pet_id, "duplicate_pet_id": payload.duplicate_pet_id, "reason": payload.reason},
    )
    await db.commit()
    return {"merge_id": merge_id, "status": "pending_owner_confirmation"}


@router.post("/merge/{merge_id}/confirm")
async def confirm_merge(
    merge_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # Merge workflow is a safe stub in MVP skeleton:
    # an owner confirms request and backend logs auditable event.
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="pet.merge.confirm",
        target_type="pet_merge_request",
        target_id=merge_id,
    )
    await db.commit()
    return {"merge_id": merge_id, "status": "confirmed"}
