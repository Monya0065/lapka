from __future__ import annotations

import secrets
import uuid
import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Appointment,
    AppointmentStatus,
    Clinic,
    ConsentGrant,
    ConsentScope,
    Membership,
    MembershipStatus,
    PetOwnerLink,
    Prescription,
    PublicLink,
    RoleEnum,
    User,
    Visit,
    VisitStatus,
)
from src.security.deps import enforce_pet_scope, get_clinic_context, get_current_user
from src.services.audit import log_audit
from src.services.notifications import create_notification
from src.models import NotificationChannel
from src.models import NotificationType

router = APIRouter(prefix="/visits", tags=["visits"])


class VisitCreateRequest(BaseModel):
    pet_id: str
    clinic_id: str | None = None  # optional if token already contains clinic context
    appointment_id: str | None = None
    complaints: str | None = None
    anamnesis: str | None = None
    physical_exam: str | None = None
    diagnostics: str | None = None
    assessment_note: str | None = None
    plan_note: str | None = None
    follow_up_note: str | None = None
    owner_summary: str | None = None
    attachments: list[str] | None = None
    chief_complaint: str | None = None
    exam_findings: str | None = None


class VisitPatchRequest(BaseModel):
    complaints: str | None = None
    anamnesis: str | None = None
    physical_exam: str | None = None
    diagnostics: str | None = None
    assessment_note: str | None = None
    plan_note: str | None = None
    follow_up_note: str | None = None
    owner_summary: str | None = None
    attachments: list[str] | None = None
    chief_complaint: str | None = None
    exam_findings: str | None = None
    override_lock: bool = False


class VisitFinalizeRequest(BaseModel):
    owner_summary: str | None = None
    follow_up_note: str | None = None
    override_lock: bool = False


class PrescriptionCreateRequest(BaseModel):
    drug_name: str = Field(min_length=2, max_length=255)
    instruction_note: str = Field(min_length=2)
    dosage_text: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=500)
    prescription_required: bool = False


def _bad_request(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"code": "BAD_REQUEST", "message": message},
    )


def _serialize_visit(visit: Visit, *, role: RoleEnum) -> dict:
    base = {
        "id": str(visit.id),
        "appointment_id": str(visit.appointment_id) if visit.appointment_id else None,
        "pet_id": str(visit.pet_id),
        "clinic_id": str(visit.clinic_id),
        "vet_id": str(visit.vet_id),
        "status": visit.status.value if hasattr(visit.status, "value") else str(visit.status),
        "complaints": visit.complaints or visit.chief_complaint,
        "anamnesis": visit.anamnesis,
        "physical_exam": visit.physical_exam or visit.exam_findings,
        "diagnostics": visit.diagnostics,
        "follow_up_note": visit.follow_up_note,
        "owner_summary": visit.owner_summary,
        "attachments": list(visit.attachments_json or []),
        "chief_complaint": visit.chief_complaint,
        "exam_findings": visit.exam_findings,
        "plan_note": visit.plan_note,
        "assessment_note": visit.assessment_note,
        "finalized_flag": visit.finalized_flag,
        "created_at": visit.created_at,
        "updated_at": visit.updated_at,
        "started_at": visit.started_at,
        "finalized_at": visit.finalized_at,
        "locked_at": visit.locked_at,
    }

    if role == RoleEnum.owner:
        # Owner-safe representation: no deep clinical reasoning and no treatment details.
        return {
            key: value
            for key, value in base.items()
            if key
            in {
                "id",
                "appointment_id",
                "pet_id",
                "clinic_id",
                "vet_id",
                "status",
                "complaints",
                "physical_exam",
                "diagnostics",
                "follow_up_note",
                "owner_summary",
                "attachments",
                "finalized_flag",
                "created_at",
                "started_at",
                "finalized_at",
            }
        }
    return base


def _safe_owner_summary(visit: Visit) -> str:
    complaints = (visit.complaints or visit.chief_complaint or "обращение в клинику").strip()
    diagnostics = (visit.diagnostics or "проведён клинический осмотр").strip()
    follow_up = (visit.follow_up_note or "запланируйте контрольный визит при необходимости").strip()
    return (
        f"Визит завершён. Основной запрос: {complaints}. "
        f"Что сделано: {diagnostics}. "
        f"Дальше: {follow_up}."
    )


def _pdf_escape(value: str) -> str:
    safe = "".join(ch for ch in value if ord(ch) < 128)
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: list[str]) -> bytes:
    text_lines = lines[:42]  # keep a single page for MVP
    stream_lines = ["BT", "/F1 11 Tf", "14 TL", "50 760 Td"]
    for line in text_lines:
        stream_lines.append(f"({_pdf_escape(line)}) Tj")
        stream_lines.append("T*")
    stream_lines.append("ET")
    stream = "\n".join(stream_lines) + "\n"
    stream_bytes = stream.encode("utf-8")

    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
        f"5 0 obj << /Length {len(stream_bytes)} >> stream\n".encode("utf-8") + stream_bytes + b"endstream endobj\n",
    ]

    parts = [b"%PDF-1.4\n"]
    offsets = [0]
    for obj in objects:
        offsets.append(sum(len(part) for part in parts))
        parts.append(obj)

    xref_offset = sum(len(part) for part in parts)
    xref = [b"xref\n0 6\n", b"0000000000 65535 f \n"]
    for offset in offsets[1:]:
        xref.append(f"{offset:010d} 00000 n \n".encode("utf-8"))

    trailer = b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n" + str(xref_offset).encode("utf-8") + b"\n%%EOF"
    parts.extend(xref)
    parts.append(trailer)
    return b"".join(parts)


def _parse_uuid(raw: str, *, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise _bad_request(f"Invalid {field_name}") from exc


async def _fetch_visit_with_scope(
    db: AsyncSession,
    *,
    visit_id: str,
    current_user,
    required_scope: ConsentScope,
) -> Visit:
    visit_uuid = _parse_uuid(visit_id, field_name="visit_id")
    visit = await db.scalar(select(Visit).where(Visit.id == visit_uuid))
    if not visit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"},
        )

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=visit.pet_id,
        clinic_id=visit.clinic_id,
        required_scope=required_scope,
    )
    return visit


@router.get("")
async def list_visits(
    clinic_id: str | None = Depends(get_clinic_context),
    pet_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    query = select(Visit)
    now = datetime.now(timezone.utc)
    allowed_scopes = (
        ConsentScope.basic_medical,
        ConsentScope.full_record,
        ConsentScope.inpatient_view,
        ConsentScope.camera_view,
    )

    if pet_id:
        query = query.where(Visit.pet_id == _parse_uuid(pet_id, field_name="pet_id"))
    if clinic_id:
        query = query.where(Visit.clinic_id == _parse_uuid(clinic_id, field_name="clinic_id"))

    if current_user.role == RoleEnum.owner:
        query = query.join(
            PetOwnerLink,
            and_(
                PetOwnerLink.pet_id == Visit.pet_id,
                PetOwnerLink.owner_user_id == current_user.id,
            ),
        )
    else:
        query = query.join(
            Membership,
            and_(
                Membership.clinic_id == Visit.clinic_id,
                Membership.user_id == current_user.id,
                Membership.status == MembershipStatus.active,
            ),
        ).where(
            exists(
                select(ConsentGrant.id).where(
                    ConsentGrant.pet_id == Visit.pet_id,
                    ConsentGrant.clinic_id == Visit.clinic_id,
                    ConsentGrant.revoked_at.is_(None),
                    or_(ConsentGrant.expires_at.is_(None), ConsentGrant.expires_at > now),
                    ConsentGrant.scope_level.in_(allowed_scopes),
                )
            )
        )

    rows = (await db.scalars(query.order_by(Visit.created_at.desc()).limit(limit))).all()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=clinic_id,
        action="visit.list",
        target_type="visit_collection",
        target_id=None,
    )
    await db.commit()
    return [_serialize_visit(v, role=current_user.role) for v in rows]


@router.get("/{visit_id}")
async def get_visit(
    visit_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.basic_medical,
    )

    action = "visit.view"
    if current_user.role == RoleEnum.owner and visit.finalized_flag:
        action = "visit.owner_discharge.view"

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action=action,
        target_type="visit",
        target_id=str(visit.id),
    )
    await db.commit()
    return _serialize_visit(visit, role=current_user.role)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_visit(
    payload: VisitCreateRequest,
    current_user=Depends(get_current_user),
    clinic_id: str | None = Depends(get_clinic_context),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.vet:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Only vet can create visits"},
        )

    pet_id = _parse_uuid(payload.pet_id, field_name="pet_id")
    # prefer clinic_id from dependency (token/query) over request body
    if clinic_id:
        clinic_id = _parse_uuid(clinic_id, field_name="clinic_id")
    else:
        clinic_id = _parse_uuid(payload.clinic_id, field_name="clinic_id") if payload.clinic_id else None
    appointment_id = _parse_uuid(payload.appointment_id, field_name="appointment_id") if payload.appointment_id else None

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=pet_id,
        clinic_id=clinic_id,
        required_scope=ConsentScope.basic_medical,
    )

    if appointment_id:
        appointment = await db.scalar(select(Appointment).where(Appointment.id == appointment_id))
        if not appointment:
            raise HTTPException(status_code=404, detail={"code": "APPOINTMENT_NOT_FOUND", "message": "Appointment not found"})
        if appointment.pet_id != pet_id or appointment.clinic_id != clinic_id:
            raise HTTPException(
                status_code=409,
                detail={"code": "APPOINTMENT_MISMATCH", "message": "Appointment does not match pet/clinic"},
            )

    visit = Visit(
        appointment_id=appointment_id,
        pet_id=pet_id,
        clinic_id=clinic_id,
        vet_id=current_user.id,
        status=VisitStatus.draft,
        complaints=payload.complaints or payload.chief_complaint,
        anamnesis=payload.anamnesis,
        physical_exam=payload.physical_exam or payload.exam_findings,
        diagnostics=payload.diagnostics,
        assessment_note=payload.assessment_note,
        plan_note=payload.plan_note,
        follow_up_note=payload.follow_up_note,
        owner_summary=payload.owner_summary,
        attachments_json=payload.attachments or [],
        chief_complaint=payload.chief_complaint or payload.complaints,
        exam_findings=payload.exam_findings or payload.physical_exam,
        finalized_flag=False,
    )
    db.add(visit)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_id),
        action="visit.create",
        target_type="visit",
        target_id=str(visit.id),
        metadata={"appointment_id": str(appointment_id) if appointment_id else None},
    )
    await db.commit()
    await db.refresh(visit)
    return _serialize_visit(visit, role=current_user.role)


@router.post("/pets/{pet_id}", status_code=status.HTTP_201_CREATED)
async def create_visit_for_pet(
    pet_id: str,
    payload: VisitCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    payload_dict = payload.model_dump()
    payload_dict["pet_id"] = pet_id
    return await create_visit(VisitCreateRequest(**payload_dict), current_user=current_user, db=db)


@router.patch("/{visit_id}")
async def update_visit(
    visit_id: str,
    payload: VisitPatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.vet:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only vet can update visit"})

    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.basic_medical,
    )
    if visit.vet_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Vet can only edit own visits"},
        )
    if visit.finalized_flag and not payload.override_lock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "VISIT_LOCKED", "message": "Visit is finalized. Use override_lock to edit."},
        )

    updates = payload.model_dump(exclude_unset=True)
    if "attachments" in updates:
        visit.attachments_json = updates.pop("attachments") or []

    for field, value in updates.items():
        setattr(visit, field, value)

    if payload.complaints is not None:
        visit.chief_complaint = payload.complaints
    if payload.physical_exam is not None:
        visit.exam_findings = payload.physical_exam
    if payload.chief_complaint is not None:
        visit.complaints = payload.chief_complaint
    if payload.exam_findings is not None:
        visit.physical_exam = payload.exam_findings

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="visit.update",
        target_type="visit",
        target_id=str(visit.id),
        metadata={"override_lock": bool(payload.override_lock)},
    )
    await db.commit()
    await db.refresh(visit)
    return _serialize_visit(visit, role=current_user.role)


@router.post("/{visit_id}/start")
async def start_visit(
    visit_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.vet:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only vet can start visit"})

    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.basic_medical,
    )
    if visit.vet_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Vet can only start own visit"})

    visit.status = VisitStatus.in_progress
    visit.started_at = visit.started_at or datetime.now(timezone.utc)
    if visit.appointment_id:
        appointment = await db.scalar(select(Appointment).where(Appointment.id == visit.appointment_id))
        if appointment and appointment.status != AppointmentStatus.completed:
            appointment.status = AppointmentStatus.in_progress

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="visit.start",
        target_type="visit",
        target_id=str(visit.id),
    )
    await db.commit()
    await db.refresh(visit)
    return _serialize_visit(visit, role=current_user.role)


@router.post("/{visit_id}/finalize")
async def finalize_visit(
    visit_id: str,
    payload: VisitFinalizeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.vet:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only vet can finalize visit"})

    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.basic_medical,
    )
    if visit.vet_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Vet can only finalize own visits"})
    if visit.finalized_flag and not payload.override_lock:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "VISIT_LOCKED", "message": "Visit already finalized"},
        )

    if payload.owner_summary is not None:
        visit.owner_summary = payload.owner_summary
    if payload.follow_up_note is not None:
        visit.follow_up_note = payload.follow_up_note

    if not visit.owner_summary:
        visit.owner_summary = _safe_owner_summary(visit)

    now = datetime.now(timezone.utc)
    visit.finalized_flag = True
    visit.status = VisitStatus.completed
    visit.finalized_at = now
    visit.locked_at = now

    owner_user_id: uuid.UUID | None = None
    if visit.appointment_id:
        appointment = await db.scalar(select(Appointment).where(Appointment.id == visit.appointment_id))
        if appointment:
            appointment.status = AppointmentStatus.completed
            owner_user_id = appointment.owner_user_id
    if owner_user_id is None:
        owner_link = await db.scalar(
            select(PetOwnerLink).where(PetOwnerLink.pet_id == visit.pet_id).order_by(PetOwnerLink.created_at.asc())
        )
        owner_user_id = owner_link.owner_user_id if owner_link else None

    if owner_user_id is not None:
        await create_notification(
            db,
            user_id=owner_user_id,
            pet_id=visit.pet_id,
            visit_id=visit.id,
            appointment_id=visit.appointment_id,
            notification_type=NotificationType.visit_ready,
            title="Выписка по визиту готова",
            body="Откройте карточку питомца, чтобы посмотреть summary и назначения.",
            metadata={"visit_id": str(visit.id)},
            channel=NotificationChannel.email,
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="visit.finalize",
        target_type="visit",
        target_id=str(visit.id),
        metadata={"override_lock": bool(payload.override_lock)},
    )
    await db.commit()
    await db.refresh(visit)
    return _serialize_visit(visit, role=current_user.role)


@router.get("/{visit_id}/export/pdf")
async def export_visit_pdf(
    visit_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.basic_medical,
    )

    clinic = await db.scalar(select(Clinic).where(Clinic.id == visit.clinic_id))
    owner_link = await db.scalar(
        select(PetOwnerLink).where(PetOwnerLink.pet_id == visit.pet_id).order_by(PetOwnerLink.created_at.asc())
    )
    owner = None
    if owner_link:
        owner = await db.scalar(select(User).where(User.id == owner_link.owner_user_id))

    raw_token = secrets.token_urlsafe(16)
    public_link = PublicLink(
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        link_type="prescription",
        visit_id=visit.id,
        pet_id=visit.pet_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(public_link)
    await db.flush()

    summary = visit.owner_summary or _safe_owner_summary(visit)
    follow_up = visit.follow_up_note or "Contact clinic if symptoms worsen."
    lines = [
        "LAPKA DISCHARGE SUMMARY",
        f"Clinic: {(clinic.name if clinic else 'ВетСеть')}",
        f"Visit ID: {visit.id}",
        f"Date: {visit.finalized_at or visit.created_at}",
        f"Owner: {(owner.full_name if owner else 'Owner')}",
        f"Pet ID: {visit.pet_id}",
        "",
        "Owner-safe summary:",
        summary,
        "",
        "Follow-up actions:",
        follow_up,
        "",
        "QR prescription link:",
        f"http://localhost:3000/public-rx/{raw_token}",
        "",
        "Safety:",
        "- This document is informational.",
        "- Contact clinic for medical decisions.",
    ]
    pdf_bytes = _build_simple_pdf(lines)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="visit.export_pdf",
        target_type="visit",
        target_id=str(visit.id),
        metadata={"public_link_id": str(public_link.id)},
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="public_link.create",
        target_type="public_link",
        target_id=str(public_link.id),
        metadata={"link_type": "prescription", "source": "visit.export_pdf"},
    )
    if current_user.role == RoleEnum.owner:
        await log_audit(
            db,
            actor_user_id=str(current_user.id),
            clinic_id=str(visit.clinic_id),
            action="visit.owner_discharge.view",
            target_type="visit",
            target_id=str(visit.id),
        )

    await db.commit()
    headers = {
        "Content-Disposition": f'attachment; filename="lapka-visit-{visit.id}.pdf"',
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/{visit_id}/prescriptions")
async def list_prescriptions(
    visit_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.prescriptions_only,
    )

    rows = (
        await db.scalars(select(Prescription).where(Prescription.visit_id == visit.id).order_by(Prescription.created_at.desc()))
    ).all()
    return [
        {
            "id": str(row.id),
            "visit_id": str(row.visit_id),
            "drug_name": row.drug_name,
            "instruction_note": (
                row.instruction_note
                if current_user.role in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}
                else "Инструкция доступна в выписке клиники. Уточните детали у врача."
            ),
            "dosage_text": "Specified by veterinarian in clinic protocol.",
            "notes": "РЕЦЕПТУРНОЕ" if row.prescription_required else "Нерецептурное по решению врача.",
            "prescription_required": row.prescription_required,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post("/{visit_id}/prescriptions", status_code=status.HTTP_201_CREATED)
async def add_prescription(
    visit_id: str,
    payload: PrescriptionCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    if current_user.role != RoleEnum.vet:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only vet can add prescriptions"})

    visit = await _fetch_visit_with_scope(
        db,
        visit_id=visit_id,
        current_user=current_user,
        required_scope=ConsentScope.prescriptions_only,
    )
    if visit.vet_id != current_user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Vet can only add to own visits"})
    if visit.finalized_flag:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "VISIT_LOCKED", "message": "Visit is finalized and locked for prescription changes"},
        )

    row = Prescription(
        visit_id=visit.id,
        drug_name=payload.drug_name,
        instruction_note=payload.instruction_note,
        prescription_required=payload.prescription_required,
    )
    db.add(row)
    await db.flush()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="prescription.create",
        target_type="prescription",
        target_id=str(row.id),
        metadata={"visit_id": str(visit.id)},
    )
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "visit_id": str(row.visit_id),
        "drug_name": row.drug_name,
        "instruction_note": row.instruction_note,
        "prescription_required": row.prescription_required,
        "created_at": row.created_at,
    }
