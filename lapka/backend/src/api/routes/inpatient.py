from __future__ import annotations

import hashlib
import os
import secrets
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Camera,
    CameraAccessLog,
    CameraAccessToken,
    ConsentGrant,
    ConsentScope,
    InpatientEvent,
    InpatientEventType,
    InpatientObservation,
    InpatientPhotoReport,
    InpatientPlan,
    InpatientPublicStatus,
    InpatientStatus,
    InpatientStay,
    MasterPet,
    Membership,
    MembershipStatus,
    NotificationType,
    PetOwnerLink,
    RoleEnum,
    User,
)
from src.security.deps import (
    enforce_pet_scope,
    get_current_user,
    require_active_consent,
    require_clinic_membership,
    require_owner_of_pet,
    require_roles,
)
from src.services.audit import log_audit
from src.services.notifications import create_notification
from src.models import NotificationChannel

router = APIRouter(prefix="/inpatient", tags=["inpatient"])
INPATIENT_UPLOAD_DIR = Path("storage/inpatient")

CAMERA_RATE_LIMIT_WINDOW_SEC = 60
CAMERA_RATE_LIMIT_MAX_HITS = 20
_camera_rate_limiter: dict[str, deque[datetime]] = defaultdict(deque)


class StayCreateRequest(BaseModel):
    pet_id: str
    clinic_id: str
    attending_vet_id: str
    ward: str = Field(min_length=1)
    bed: str = Field(min_length=1)
    public_status_label: InpatientPublicStatus = InpatientPublicStatus.monitoring
    owner_visible_summary: str = Field(
        default="Пациент находится под наблюдением дежурной команды, обновления поступают регулярно.", min_length=2
    )


class StayPatchRequest(BaseModel):
    ward: str | None = None
    bed: str | None = None
    status: InpatientStatus | None = None
    public_status_label: InpatientPublicStatus | None = None
    owner_visible_summary: str | None = None


class AssignStayRequest(BaseModel):
    vet_id: str


class PlanCreateRequest(BaseModel):
    task_text: str = Field(min_length=2)
    plan_date: datetime | None = None


class ObservationCreateRequest(BaseModel):
    note: str = Field(min_length=2)
    observed_at: datetime | None = None
    temperature_c: str | None = None
    appetite: str | None = None
    activity: str | None = None


class InpatientEventCreateRequest(BaseModel):
    event_type: InpatientEventType = InpatientEventType.note
    owner_visible: bool = True
    title: str = Field(min_length=2, max_length=255)
    description_safe: str = Field(min_length=2)


class CameraTokenIssueRequest(BaseModel):
    stay_id: str
    camera_id: str | None = None
    ttl_minutes: int = Field(default=20, ge=10, le=30)
    one_time: bool = True


class OwnerCameraTokenRequest(BaseModel):
    camera_id: str
    ttl_minutes: int = Field(default=20, ge=10, le=30)
    one_time: bool = True


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _parse_uuid(value: str, *, code: str = "BAD_REQUEST", message: str = "Invalid UUID") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail={"code": code, "message": message}) from exc


def _apply_camera_rate_limit(rate_key: str) -> None:
    now = datetime.now(timezone.utc)
    q = _camera_rate_limiter[rate_key]
    while q and (now - q[0]).total_seconds() > CAMERA_RATE_LIMIT_WINDOW_SEC:
        q.popleft()
    if len(q) >= CAMERA_RATE_LIMIT_MAX_HITS:
        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMITED", "message": "Too many camera stream requests. Try again in a minute."},
        )
    q.append(now)


def _stay_to_dict(stay: InpatientStay) -> dict:
    return {
        "id": str(stay.id),
        "pet_id": str(stay.pet_id),
        "clinic_id": str(stay.clinic_id),
        "attending_vet_id": str(stay.attending_vet_id),
        "status": stay.status.value if hasattr(stay.status, "value") else str(stay.status),
        "public_status_label": (
            stay.public_status_label.value if hasattr(stay.public_status_label, "value") else str(stay.public_status_label)
        ),
        "owner_visible_summary": stay.owner_visible_summary,
        "ward": stay.ward,
        "bed": stay.bed,
        "admitted_at": stay.admitted_at,
        "discharged_at": stay.discharged_at,
        "created_at": stay.created_at,
    }


def _event_to_dict(event: InpatientEvent) -> dict:
    return {
        "id": str(event.id),
        "stay_id": str(event.stay_id),
        "created_by_user_id": str(event.created_by_user_id),
        "event_type": event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type),
        "owner_visible": event.owner_visible,
        "title": event.title,
        "description_safe": event.description_safe,
        "created_at": event.created_at,
    }


def _photo_to_dict(row: InpatientPhotoReport) -> dict:
    return {
        "id": str(row.id),
        "stay_id": str(row.stay_id),
        "taken_at": row.taken_at,
        "caption": row.caption,
        "file_ref": row.file_ref,
    }


def _camera_to_dict(camera: Camera) -> dict:
    return {
        "camera_id": str(camera.id),
        "camera_name": camera.camera_name,
        "stream_ref_stub": camera.stream_ref_stub,
        "is_active": camera.is_active,
    }


async def _save_uploaded_photo(upload: UploadFile) -> str:
    extension = os.path.splitext(upload.filename or "")[1].lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"code": "UNSUPPORTED_MEDIA_TYPE", "message": "Supported formats: JPG, PNG, WEBP"},
        )

    INPATIENT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_name = f"{uuid.uuid4()}{extension or '.jpg'}"
    file_path = INPATIENT_UPLOAD_DIR / file_name
    data = await upload.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "PAYLOAD_TOO_LARGE", "message": "Photo size must be <= 8 MB"},
        )
    file_path.write_bytes(data)
    return str(file_path)


async def _has_active_consent(
    db: AsyncSession,
    *,
    pet_id: uuid.UUID,
    clinic_id: uuid.UUID,
    required_scope: ConsentScope,
) -> bool:
    now = datetime.now(timezone.utc)
    rows = (
        await db.scalars(
            select(ConsentGrant).where(
                ConsentGrant.pet_id == pet_id,
                ConsentGrant.clinic_id == clinic_id,
                ConsentGrant.revoked_at.is_(None),
            )
        )
    ).all()
    scope_rank = {
        ConsentScope.prescriptions_only: 1,
        ConsentScope.basic_medical: 2,
        ConsentScope.full_record: 3,
        ConsentScope.inpatient_view: 4,
        ConsentScope.camera_view: 5,
    }
    for row in rows:
        if row.expires_at and row.expires_at <= now:
            continue
        if scope_rank[row.scope_level] >= scope_rank[required_scope]:
            return True
    return False


async def _owner_user_id_for_pet(db: AsyncSession, pet_id: uuid.UUID) -> uuid.UUID | None:
    return await db.scalar(
        select(PetOwnerLink.owner_user_id).where(PetOwnerLink.pet_id == pet_id).order_by(PetOwnerLink.created_at.asc()).limit(1)
    )


async def _ensure_stay_access(db: AsyncSession, *, stay: InpatientStay, current_user, for_write: bool = False) -> None:
    if current_user.role == RoleEnum.owner:
        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=stay.pet_id)
        if for_write:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Owner has read-only access"})
        return

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=stay.pet_id,
        clinic_id=stay.clinic_id,
        required_scope=ConsentScope.inpatient_view,
    )

    if for_write and current_user.role != RoleEnum.vet:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only vet can write medical notes"})


async def _resolve_stay_or_404(db: AsyncSession, stay_id: str) -> InpatientStay:
    stay = await db.scalar(select(InpatientStay).where(InpatientStay.id == _parse_uuid(stay_id, message="Invalid stay id")))
    if not stay:
        raise HTTPException(status_code=404, detail={"code": "STAY_NOT_FOUND", "message": "Stay not found"})
    return stay


async def _create_owner_notification(
    db: AsyncSession,
    *,
    stay: InpatientStay,
    title: str,
    body: str,
    metadata: dict | None = None,
) -> None:
    owner_user_id = await _owner_user_id_for_pet(db, stay.pet_id)
    if owner_user_id is None:
        return
    await create_notification(
        db,
        user_id=owner_user_id,
        notification_type=NotificationType.inpatient_update,
        title=title,
        body=body,
        pet_id=stay.pet_id,
        metadata=metadata or {},
        channel=NotificationChannel.email,
    )


async def _issue_camera_token_for_stay(
    *,
    stay: InpatientStay,
    camera_id: str | None,
    ttl_minutes: int,
    one_time: bool,
    current_user,
    db: AsyncSession,
) -> dict:
    if current_user.role != RoleEnum.owner:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Only owner can request camera token"},
        )

    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=stay.pet_id)
    await require_active_consent(
        db,
        pet_id=stay.pet_id,
        clinic_id=stay.clinic_id,
        required_scope=ConsentScope.camera_view,
    )

    if stay.status != InpatientStatus.active:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Camera access allowed only for active stays"},
        )

    if camera_id:
        camera = await db.scalar(
            select(Camera).where(
                Camera.id == _parse_uuid(camera_id, message="Invalid camera id"),
                Camera.stay_id == stay.id,
                Camera.is_active.is_(True),
            )
        )
    else:
        camera = await db.scalar(
            select(Camera).where(Camera.stay_id == stay.id, Camera.is_active.is_(True)).order_by(Camera.camera_name.asc())
        )

    if not camera:
        raise HTTPException(
            status_code=404,
            detail={"code": "CAMERA_NOT_FOUND", "message": "Active camera not configured for this stay"},
        )

    raw_token = secrets.token_urlsafe(24)
    token_row = CameraAccessToken(
        camera_id=camera.id,
        owner_user_id=current_user.id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        one_time_flag=one_time,
    )
    db.add(token_row)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="camera.token.issue",
        target_type="camera_token",
        target_id=str(token_row.id),
    )
    await db.commit()

    return {
        "camera_id": str(camera.id),
        "camera_name": camera.camera_name,
        "token": raw_token,
        "expires_in_minutes": ttl_minutes,
        "one_time": one_time,
    }


async def _resolve_camera_stream(
    *,
    token: str,
    db: AsyncSession,
    expected_owner_id: uuid.UUID | None = None,
) -> dict:
    token_hash = _hash_token(token)
    _apply_camera_rate_limit(f"stream:{token_hash}")

    token_row = await db.scalar(select(CameraAccessToken).where(CameraAccessToken.token_hash == token_hash))
    now = datetime.now(timezone.utc)

    if not token_row:
        db.add(CameraAccessLog(token_id=None, user_id=None, result="not_found"))
        await db.commit()
        raise HTTPException(status_code=404, detail={"code": "TOKEN_NOT_FOUND", "message": "Camera token not found"})

    if expected_owner_id and token_row.owner_user_id != expected_owner_id:
        db.add(CameraAccessLog(token_id=token_row.id, user_id=token_row.owner_user_id, result="owner_mismatch"))
        await db.commit()
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Token does not belong to this owner"})

    if token_row.expires_at <= now:
        db.add(CameraAccessLog(token_id=token_row.id, user_id=token_row.owner_user_id, result="expired"))
        await db.commit()
        raise HTTPException(status_code=403, detail={"code": "TOKEN_EXPIRED", "message": "Camera token expired"})

    if token_row.one_time_flag and token_row.consumed_at is not None:
        db.add(CameraAccessLog(token_id=token_row.id, user_id=token_row.owner_user_id, result="consumed"))
        await db.commit()
        raise HTTPException(status_code=403, detail={"code": "TOKEN_CONSUMED", "message": "Camera token already used"})

    camera = await db.scalar(select(Camera).where(Camera.id == token_row.camera_id))
    if not camera or not camera.is_active:
        db.add(CameraAccessLog(token_id=token_row.id, user_id=token_row.owner_user_id, result="camera_missing"))
        await db.commit()
        raise HTTPException(status_code=404, detail={"code": "CAMERA_NOT_FOUND", "message": "Camera not found"})

    stay = await db.scalar(select(InpatientStay).where(InpatientStay.id == camera.stay_id))
    if not stay or stay.status != InpatientStatus.active:
        db.add(CameraAccessLog(token_id=token_row.id, user_id=token_row.owner_user_id, result="stay_inactive"))
        await db.commit()
        raise HTTPException(status_code=403, detail={"code": "STAY_INACTIVE", "message": "Stay is not active"})

    if token_row.one_time_flag:
        token_row.consumed_at = now

    db.add(CameraAccessLog(token_id=token_row.id, user_id=token_row.owner_user_id, result="ok"))
    db.add(
        InpatientEvent(
            stay_id=stay.id,
            created_by_user_id=token_row.owner_user_id,
            event_type=InpatientEventType.camera_viewed,
            owner_visible=False,
            title="Просмотр камеры",
            description_safe="Выполнен просмотр камеры владельцем по краткоживущему токену.",
            created_at=now,
        )
    )
    await log_audit(
        db,
        actor_user_id=str(token_row.owner_user_id),
        clinic_id=str(stay.clinic_id),
        action="camera.view",
        target_type="camera",
        target_id=str(camera.id),
    )
    await db.commit()

    return {
        "camera_name": camera.camera_name,
        "stream_stub": camera.stream_ref_stub,
        "demo": True,
        "expires_at": token_row.expires_at,
        "one_time": token_row.one_time_flag,
    }


@router.get("/stays")
async def list_stays(
    clinic_id: str | None = Query(default=None),
    status_filter: InpatientStatus | None = Query(default=None, alias="status"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    q = select(InpatientStay)
    if status_filter is not None:
        q = q.where(InpatientStay.status == status_filter)

    rows = (await db.scalars(q.order_by(InpatientStay.admitted_at.desc()).limit(300))).all()
    out: list[dict] = []
    for row in rows:
        if clinic_id and str(row.clinic_id) != clinic_id:
            continue
        try:
            await _ensure_stay_access(db, stay=row, current_user=current_user, for_write=False)
        except HTTPException:
            continue
        out.append(_stay_to_dict(row))

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=clinic_id,
        action="inpatient.list",
        target_type="inpatient_collection",
        target_id=None,
        metadata={"count": len(out)},
    )
    await db.commit()
    return out


@router.post("/stays", status_code=status.HTTP_201_CREATED)
async def create_stay(
    payload: StayCreateRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = _parse_uuid(payload.clinic_id, message="Invalid clinic id")
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)

    row = InpatientStay(
        pet_id=_parse_uuid(payload.pet_id, message="Invalid pet id"),
        clinic_id=clinic_uuid,
        attending_vet_id=_parse_uuid(payload.attending_vet_id, message="Invalid vet id"),
        ward=payload.ward,
        bed=payload.bed,
        status=InpatientStatus.active,
        public_status_label=payload.public_status_label,
        owner_visible_summary=payload.owner_visible_summary,
    )
    db.add(row)
    await db.flush()

    db.add(
        InpatientEvent(
            stay_id=row.id,
            created_by_user_id=current_user.id,
            event_type=InpatientEventType.status_update,
            owner_visible=True,
            title="Поступление в стационар",
            description_safe="Пациент поступил в стационар, начато наблюдение команды.",
            created_at=datetime.now(timezone.utc),
        )
    )

    await _create_owner_notification(
        db,
        stay=row,
        title="Питомец поступил в стационар",
        body="В карточке стационара доступен первый статус и обновления.",
        metadata={"stay_id": str(row.id)},
    )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=payload.clinic_id,
        action="inpatient.create",
        target_type="inpatient_stay",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _stay_to_dict(row)


@router.get("/stays/{stay_id}")
async def get_stay(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.view",
        target_type="inpatient_stay",
        target_id=str(stay.id),
    )
    await db.commit()

    return _stay_to_dict(stay)


@router.patch("/stays/{stay_id}")
async def patch_stay(
    stay_id: str,
    payload: StayPatchRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user, for_write=(current_user.role == RoleEnum.vet))

    if payload.ward is not None:
        stay.ward = payload.ward
    if payload.bed is not None:
        stay.bed = payload.bed
    if payload.status is not None:
        stay.status = payload.status
        if payload.status == InpatientStatus.discharged:
            stay.discharged_at = datetime.now(timezone.utc)
    if payload.public_status_label is not None:
        stay.public_status_label = payload.public_status_label
    if payload.owner_visible_summary is not None:
        stay.owner_visible_summary = payload.owner_visible_summary

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.update",
        target_type="inpatient_stay",
        target_id=str(stay.id),
    )
    await db.commit()
    await db.refresh(stay)
    return _stay_to_dict(stay)


@router.post("/stays/{stay_id}/assign")
async def assign_stay(
    stay_id: str,
    payload: AssignStayRequest,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    vet_id = _parse_uuid(payload.vet_id, message="Invalid vet id")
    vet_user = await db.scalar(select(User).where(User.id == vet_id, User.role == RoleEnum.vet))
    if not vet_user:
        raise HTTPException(status_code=404, detail={"code": "VET_NOT_FOUND", "message": "Vet user not found"})

    membership = await db.scalar(
        select(Membership).where(
            Membership.user_id == vet_id,
            Membership.clinic_id == stay.clinic_id,
            Membership.status == MembershipStatus.active,
        )
    )
    if not membership:
        raise HTTPException(
            status_code=409,
            detail={"code": "VET_NOT_IN_CLINIC", "message": "Vet has no active membership in this clinic"},
        )

    stay.attending_vet_id = vet_id
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.assign",
        target_type="inpatient_stay",
        target_id=str(stay.id),
        metadata={"vet_id": str(vet_id)},
    )
    await db.commit()
    return {"status": "assigned", "stay_id": str(stay.id), "attending_vet_id": str(vet_id)}


@router.post("/stays/{stay_id}/discharge")
async def discharge_stay(
    stay_id: str,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    stay.status = InpatientStatus.discharged
    stay.public_status_label = InpatientPublicStatus.stable
    stay.owner_visible_summary = "Стационар завершён. Команда клиники подготовила рекомендации для follow-up визита."
    stay.discharged_at = datetime.now(timezone.utc)

    db.add(
        InpatientEvent(
            stay_id=stay.id,
            created_by_user_id=current_user.id,
            event_type=InpatientEventType.status_update,
            owner_visible=True,
            title="Подготовка к выписке",
            description_safe="Пациент переведён в статус выписки. Уточните у врача вопросы по дальнейшему наблюдению.",
        )
    )
    await _create_owner_notification(
        db,
        stay=stay,
        title="Стационар: подготовка к выписке",
        body="Проверьте карточку стационара: добавлено обновление о следующем шаге.",
        metadata={"stay_id": str(stay.id), "status": "discharge_ready"},
    )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.discharge",
        target_type="inpatient_stay",
        target_id=str(stay.id),
    )
    await db.commit()
    return {"status": "discharged"}


@router.get("/stays/{stay_id}/plans")
async def list_plans(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    rows = (
        await db.scalars(select(InpatientPlan).where(InpatientPlan.stay_id == stay.id).order_by(InpatientPlan.plan_date.desc()))
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.plan.list",
        target_type="inpatient_plan_collection",
        target_id=str(stay.id),
    )
    await db.commit()

    return [
        {
            "id": str(r.id),
            "stay_id": str(r.stay_id),
            "plan_date": r.plan_date,
            "task_text": r.task_text,
            "created_by": str(r.created_by),
        }
        for r in rows
    ]


@router.post("/stays/{stay_id}/plans", status_code=status.HTTP_201_CREATED)
async def add_plan(
    stay_id: str,
    payload: PlanCreateRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user, for_write=True)

    row = InpatientPlan(
        stay_id=stay.id,
        plan_date=payload.plan_date or datetime.now(timezone.utc),
        task_text=payload.task_text,
        created_by=current_user.id,
    )
    db.add(row)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.plan.add",
        target_type="inpatient_plan",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id), "status": "created"}


@router.get("/stays/{stay_id}/observations")
async def list_observations(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    rows = (
        await db.scalars(
            select(InpatientObservation).where(InpatientObservation.stay_id == stay.id).order_by(InpatientObservation.observed_at.desc())
        )
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.observation.list",
        target_type="inpatient_observation_collection",
        target_id=str(stay.id),
    )
    await db.commit()

    return [
        {
            "id": str(r.id),
            "observed_at": r.observed_at,
            "temperature_c": r.temperature_c,
            "appetite": r.appetite,
            "activity": r.activity,
            "note": r.note,
        }
        for r in rows
    ]


@router.post("/stays/{stay_id}/observations", status_code=status.HTTP_201_CREATED)
async def add_observation(
    stay_id: str,
    payload: ObservationCreateRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user, for_write=True)

    row = InpatientObservation(
        stay_id=stay.id,
        observed_at=payload.observed_at or datetime.now(timezone.utc),
        temperature_c=payload.temperature_c,
        appetite=payload.appetite,
        activity=payload.activity,
        note=payload.note,
        created_by=current_user.id,
    )
    db.add(row)
    db.add(
        InpatientEvent(
            stay_id=stay.id,
            created_by_user_id=current_user.id,
            event_type=InpatientEventType.vitals_check,
            owner_visible=True,
            title="Проверка состояния",
            description_safe="Добавлено новое наблюдение о текущем состоянии питомца.",
            created_at=row.observed_at,
        )
    )
    await _create_owner_notification(
        db,
        stay=stay,
        title="Стационар: новое наблюдение",
        body="В карточке стационара добавлена свежая запись дежурного врача.",
        metadata={"stay_id": str(stay.id), "kind": "observation"},
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.observation.add",
        target_type="inpatient_observation",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return {"id": str(row.id), "status": "created"}


@router.get("/stays/{stay_id}/events")
async def list_events(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    query = select(InpatientEvent).where(InpatientEvent.stay_id == stay.id)
    if current_user.role == RoleEnum.owner:
        query = query.where(InpatientEvent.owner_visible.is_(True))

    rows = (await db.scalars(query.order_by(InpatientEvent.created_at.desc()))).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.event.list",
        target_type="inpatient_event_collection",
        target_id=str(stay.id),
    )
    await db.commit()

    return [_event_to_dict(row) for row in rows]


@router.post("/stays/{stay_id}/events", status_code=status.HTTP_201_CREATED)
async def add_event(
    stay_id: str,
    payload: InpatientEventCreateRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    row = InpatientEvent(
        stay_id=stay.id,
        created_by_user_id=current_user.id,
        event_type=payload.event_type,
        owner_visible=payload.owner_visible,
        title=payload.title,
        description_safe=payload.description_safe,
        created_at=datetime.now(timezone.utc),
    )
    db.add(row)

    if payload.owner_visible:
        await _create_owner_notification(
            db,
            stay=stay,
            title=f"Стационар: {payload.title}",
            body="Появилось новое обновление в карточке стационара.",
            metadata={"stay_id": str(stay.id), "event_type": payload.event_type.value},
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.event.add",
        target_type="inpatient_event",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _event_to_dict(row)


@router.get("/stays/{stay_id}/photo-reports")
@router.get("/stays/{stay_id}/photos")
async def list_photos(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    rows = (
        await db.scalars(
            select(InpatientPhotoReport).where(InpatientPhotoReport.stay_id == stay.id).order_by(InpatientPhotoReport.taken_at.desc())
        )
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.photo.list",
        target_type="inpatient_photo_collection",
        target_id=str(stay.id),
    )
    await db.commit()

    return [_photo_to_dict(row) for row in rows]


@router.post("/stays/{stay_id}/photo-reports", status_code=status.HTTP_201_CREATED)
@router.post("/stays/{stay_id}/photos", status_code=status.HTTP_201_CREATED)
async def add_photo(
    stay_id: str,
    caption: str = Form(..., min_length=2),
    taken_at: datetime | None = Form(default=None),
    file_ref: str | None = Form(default=None),
    photo_file: UploadFile | None = File(default=None),
    owner_visible: bool = Form(default=True),
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    resolved_file_ref = file_ref
    if photo_file:
        resolved_file_ref = await _save_uploaded_photo(photo_file)

    if not resolved_file_ref:
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": "Provide photo_file or file_ref"},
        )

    event_time = taken_at or datetime.now(timezone.utc)
    row = InpatientPhotoReport(
        stay_id=stay.id,
        taken_at=event_time,
        caption=caption,
        file_ref=resolved_file_ref,
        created_by=current_user.id,
    )
    db.add(row)
    db.add(
        InpatientEvent(
            stay_id=stay.id,
            created_by_user_id=current_user.id,
            event_type=InpatientEventType.photo_report,
            owner_visible=owner_visible,
            title="Фото-отчёт",
            description_safe=caption,
            created_at=event_time,
        )
    )

    if owner_visible:
        await _create_owner_notification(
            db,
            stay=stay,
            title="Стационар: новый фото-отчёт",
            body="Откройте карточку стационара, чтобы посмотреть свежий снимок.",
            metadata={"stay_id": str(stay.id), "kind": "photo"},
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.photo.add",
        target_type="inpatient_photo",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _photo_to_dict(row)


@router.get("/stays/{stay_id}/owner-view")
async def owner_stay_view(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # Backward-compatible endpoint used by older pages.
    stay = await _resolve_stay_or_404(db, stay_id)
    await _ensure_stay_access(db, stay=stay, current_user=current_user)

    plans = (
        await db.scalars(select(InpatientPlan).where(InpatientPlan.stay_id == stay.id).order_by(InpatientPlan.plan_date.desc()).limit(20))
    ).all()
    observations = (
        await db.scalars(
            select(InpatientObservation).where(InpatientObservation.stay_id == stay.id).order_by(InpatientObservation.observed_at.desc()).limit(20)
        )
    ).all()
    photos = (
        await db.scalars(
            select(InpatientPhotoReport).where(InpatientPhotoReport.stay_id == stay.id).order_by(InpatientPhotoReport.taken_at.desc()).limit(20)
        )
    ).all()
    event_query = select(InpatientEvent).where(InpatientEvent.stay_id == stay.id)
    if current_user.role == RoleEnum.owner:
        event_query = event_query.where(InpatientEvent.owner_visible.is_(True))
    events = (await db.scalars(event_query.order_by(InpatientEvent.created_at.desc()).limit(60))).all()
    cameras = (
        await db.scalars(select(Camera).where(Camera.stay_id == stay.id, Camera.is_active.is_(True)).order_by(Camera.camera_name.asc()))
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.owner_view",
        target_type="inpatient_stay",
        target_id=str(stay.id),
    )
    await db.commit()

    return {
        "stay": _stay_to_dict(stay),
        "daily_plan": [{"date": p.plan_date, "task": p.task_text} for p in plans],
        "observations": [{"time": o.observed_at, "note": o.note} for o in observations],
        "photo_reports": [_photo_to_dict(ph) for ph in photos],
        "events": [_event_to_dict(ev) for ev in events],
        "cameras": [_camera_to_dict(cam) for cam in cameras],
    }


@router.post("/stays/{stay_id}/camera-token")
async def issue_camera_token_legacy(
    stay_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    # Legacy endpoint kept for compatibility.
    stay = await _resolve_stay_or_404(db, stay_id)
    return await _issue_camera_token_for_stay(
        stay=stay,
        camera_id=None,
        ttl_minutes=20,
        one_time=True,
        current_user=current_user,
        db=db,
    )


@router.post("/camera-tokens")
async def issue_camera_token(
    payload: CameraTokenIssueRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, payload.stay_id)
    return await _issue_camera_token_for_stay(
        stay=stay,
        camera_id=payload.camera_id,
        ttl_minutes=payload.ttl_minutes,
        one_time=payload.one_time,
        current_user=current_user,
        db=db,
    )


@router.get("/camera-stream")
async def camera_stream(token: str = Query(...), db: AsyncSession = Depends(get_db_session)) -> dict:
    # Kept as compatibility endpoint used by public demo token flow.
    return await _resolve_camera_stream(token=token, db=db, expected_owner_id=None)


@router.get("/camera-access-logs")
async def list_camera_logs(
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    rows = (await db.scalars(select(CameraAccessLog).order_by(CameraAccessLog.created_at.desc()).limit(400))).all()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="camera.logs.list",
        target_type="camera_access_log",
        target_id=None,
        metadata={"count": len(rows)},
    )
    await db.commit()
    return [
        {
            "id": str(r.id),
            "token_id": str(r.token_id) if r.token_id else None,
            "user_id": str(r.user_id) if r.user_id else None,
            "result": r.result,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# Owner-specific inpatient UX API


@router.get("/owner/inpatient")
async def owner_list_inpatient(
    status_filter: InpatientStatus | None = Query(default=InpatientStatus.active, alias="status"),
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    pet_rows = (
        await db.scalars(
            select(MasterPet).join(PetOwnerLink, PetOwnerLink.pet_id == MasterPet.id).where(PetOwnerLink.owner_user_id == current_user.id)
        )
    ).all()
    pet_map = {row.id: row for row in pet_rows}
    if not pet_map:
        return []

    q = select(InpatientStay).where(InpatientStay.pet_id.in_(pet_map.keys()))
    if status_filter is not None:
        q = q.where(InpatientStay.status == status_filter)
    stays = (await db.scalars(q.order_by(InpatientStay.admitted_at.desc()))).all()

    out: list[dict] = []
    for stay in stays:
        event_count = await db.scalar(select(func.count(InpatientEvent.id)).where(InpatientEvent.stay_id == stay.id))
        photo_count = await db.scalar(select(func.count(InpatientPhotoReport.id)).where(InpatientPhotoReport.stay_id == stay.id))
        last_event_at = await db.scalar(select(func.max(InpatientEvent.created_at)).where(InpatientEvent.stay_id == stay.id))
        cameras = (
            await db.scalars(select(Camera).where(Camera.stay_id == stay.id, Camera.is_active.is_(True)).order_by(Camera.camera_name.asc()))
        ).all()
        camera_available = bool(cameras) and stay.status == InpatientStatus.active and await _has_active_consent(
            db,
            pet_id=stay.pet_id,
            clinic_id=stay.clinic_id,
            required_scope=ConsentScope.camera_view,
        )
        out.append(
            {
                **_stay_to_dict(stay),
                "pet_name": pet_map[stay.pet_id].name,
                "pet_species": pet_map[stay.pet_id].species,
                "event_count": int(event_count or 0),
                "photo_count": int(photo_count or 0),
                "last_update_at": last_event_at or stay.admitted_at,
                "camera_available": camera_available,
            }
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="inpatient.owner.list",
        target_type="inpatient_collection",
        target_id=None,
        metadata={"count": len(out)},
    )
    await db.commit()
    return out


@router.get("/owner/inpatient/camera-stream")
async def owner_camera_stream(
    token: str = Query(...),
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    return await _resolve_camera_stream(token=token, db=db, expected_owner_id=current_user.id)


@router.get("/owner/inpatient/{stay_id}")
async def owner_get_inpatient(
    stay_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=stay.pet_id)

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == stay.pet_id))
    vet = await db.scalar(select(User).where(User.id == stay.attending_vet_id))

    plans = (
        await db.scalars(select(InpatientPlan).where(InpatientPlan.stay_id == stay.id).order_by(InpatientPlan.plan_date.desc()).limit(20))
    ).all()
    events = (
        await db.scalars(
            select(InpatientEvent)
            .where(InpatientEvent.stay_id == stay.id, InpatientEvent.owner_visible.is_(True))
            .order_by(InpatientEvent.created_at.desc())
            .limit(120)
        )
    ).all()
    photos = (
        await db.scalars(
            select(InpatientPhotoReport).where(InpatientPhotoReport.stay_id == stay.id).order_by(InpatientPhotoReport.taken_at.desc()).limit(80)
        )
    ).all()
    cameras = (
        await db.scalars(select(Camera).where(Camera.stay_id == stay.id, Camera.is_active.is_(True)).order_by(Camera.camera_name.asc()))
    ).all()

    camera_access_allowed = bool(cameras) and stay.status == InpatientStatus.active and await _has_active_consent(
        db,
        pet_id=stay.pet_id,
        clinic_id=stay.clinic_id,
        required_scope=ConsentScope.camera_view,
    )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.owner.view",
        target_type="inpatient_stay",
        target_id=str(stay.id),
    )
    await db.commit()

    return {
        "stay": _stay_to_dict(stay),
        "pet": {
            "id": str(pet.id) if pet else str(stay.pet_id),
            "name": pet.name if pet else "Питомец",
            "species": pet.species if pet else "unknown",
            "breed": pet.breed if pet else None,
        },
        "attending_vet": {
            "id": str(vet.id) if vet else str(stay.attending_vet_id),
            "full_name": vet.full_name if vet else "Дежурный врач",
        },
        "today_plan": [
            {"id": str(plan.id), "plan_date": plan.plan_date, "task_text": plan.task_text}
            for plan in plans
        ],
        "events": [_event_to_dict(event) for event in events],
        "photo_reports": [_photo_to_dict(photo) for photo in photos],
        "cameras": [_camera_to_dict(camera) for camera in cameras],
        "camera_access_allowed": camera_access_allowed,
        "questions_to_ask_doctor": [
            "Какие индикаторы улучшились за последние 24 часа?",
            "Когда планируется следующий контрольный апдейт?",
            "На какие изменения в поведении обратить внимание после выписки?",
        ],
        "safety_note": "Информация носит ознакомительный характер. Медицинские решения принимает ветеринарный врач.",
    }


@router.get("/owner/inpatient/{stay_id}/events")
async def owner_list_events(
    stay_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stay = await _resolve_stay_or_404(db, stay_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=stay.pet_id)

    rows = (
        await db.scalars(
            select(InpatientEvent)
            .where(InpatientEvent.stay_id == stay.id, InpatientEvent.owner_visible.is_(True))
            .order_by(InpatientEvent.created_at.desc())
        )
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.owner.events",
        target_type="inpatient_event_collection",
        target_id=str(stay.id),
        metadata={"count": len(rows)},
    )
    await db.commit()
    return [_event_to_dict(row) for row in rows]


@router.get("/owner/inpatient/{stay_id}/photos")
async def owner_list_photos(
    stay_id: str,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    stay = await _resolve_stay_or_404(db, stay_id)
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=stay.pet_id)

    rows = (
        await db.scalars(
            select(InpatientPhotoReport).where(InpatientPhotoReport.stay_id == stay.id).order_by(InpatientPhotoReport.taken_at.desc())
        )
    ).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(stay.clinic_id),
        action="inpatient.owner.photos",
        target_type="inpatient_photo_collection",
        target_id=str(stay.id),
        metadata={"count": len(rows)},
    )
    await db.commit()

    return [_photo_to_dict(row) for row in rows]


@router.post("/owner/inpatient/{stay_id}/camera-token")
async def owner_issue_camera_token(
    stay_id: str,
    payload: OwnerCameraTokenRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    stay = await _resolve_stay_or_404(db, stay_id)
    return await _issue_camera_token_for_stay(
        stay=stay,
        camera_id=payload.camera_id,
        ttl_minutes=payload.ttl_minutes,
        one_time=payload.one_time,
        current_user=current_user,
        db=db,
    )
