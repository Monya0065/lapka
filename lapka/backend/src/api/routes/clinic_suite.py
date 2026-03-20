from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.integrations.labs_providers import get_labs_provider
from src.integrations.payments_providers import get_payments_provider
from src.models import (
    Appointment,
    AppointmentStatus,
    ClinicService,
    ClinicServiceCategory,
    ConsentScope,
    InsuranceClaim,
    InsuranceClaimStatus,
    InsurancePolicy,
    InsurancePolicyStatus,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InpatientStay,
    InpatientStatus,
    LabOrder,
    LabOrderStatus,
    LabProvider,
    LabResult,
    Membership,
    MembershipStatus,
    Payment,
    PaymentStatus,
    PetOwnerLink,
    RatingsSummary,
    ReviewTargetType,
    RoleEnum,
    User,
    Visit,
)
from src.security.deps import enforce_pet_scope, get_current_user, require_owner_of_pet
from src.services.audit import log_audit

router = APIRouter(tags=["clinic-saas"])


class ClinicServiceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    category: ClinicServiceCategory = ClinicServiceCategory.consultation
    price_cents: int = Field(ge=0)
    currency: str = Field(default="RUB", min_length=3, max_length=8)
    duration_minutes: int = Field(default=30, ge=5, le=360)
    is_active: bool = True


class ClinicServicePatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    category: ClinicServiceCategory | None = None
    price_cents: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=8)
    duration_minutes: int | None = Field(default=None, ge=5, le=360)
    is_active: bool | None = None


class InvoiceCreateRequest(BaseModel):
    owner_id: str
    pet_id: str
    visit_id: str | None = None
    appointment_id: str | None = None
    currency: str = Field(default="RUB", min_length=3, max_length=8)


class InvoiceItemCreateRequest(BaseModel):
    service_id: str | None = None
    name: str | None = Field(default=None, min_length=2, max_length=255)
    qty: int = Field(default=1, ge=1, le=100)
    unit_price_cents: int | None = Field(default=None, ge=0)


class InvoiceStatusRequest(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class OwnerPayInvoiceRequest(BaseModel):
    simulate_result: str | None = Field(default=None, pattern="^(succeeded|failed)$")


class InsurancePolicyCreateRequest(BaseModel):
    provider_name: str = Field(min_length=2, max_length=255)
    policy_number: str = Field(min_length=4, max_length=64)


class InsuranceClaimCreateRequest(BaseModel):
    invoice_id: str
    notes: str | None = Field(default=None, max_length=2000)


class InsuranceClaimPatchRequest(BaseModel):
    status: InsuranceClaimStatus
    notes: str | None = Field(default=None, max_length=2000)


class LabOrderCreateRequest(BaseModel):
    pet_id: str
    visit_id: str | None = None
    provider_id: str | None = None


class LabImportRequest(BaseModel):
    species: str | None = None


def _parse_uuid(raw: str, *, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": f"Invalid {field_name}"},
        ) from exc


def _money(cents: int | None) -> str:
    return f"{(cents or 0) / 100:.2f}"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _resolve_staff_membership(db: AsyncSession, *, user_id: uuid.UUID) -> Membership:
    row = await db.scalar(
        select(Membership)
        .where(Membership.user_id == user_id, Membership.status == MembershipStatus.active)
        .order_by(Membership.created_at.asc())
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "No active clinic membership"},
        )
    return row


def _ensure_staff_role(current_user, *roles: RoleEnum) -> None:
    if current_user.role not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Role is not allowed for this endpoint"},
        )


def _serialize_clinic_service(row: ClinicService) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "name": row.name,
        "category": row.category.value if hasattr(row.category, "value") else str(row.category),
        "price_cents": row.price_cents,
        "price_text": _money(row.price_cents),
        "currency": row.currency,
        "duration_minutes": row.duration_minutes,
        "is_active": row.is_active,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_invoice_item(row: InvoiceItem) -> dict:
    return {
        "id": str(row.id),
        "invoice_id": str(row.invoice_id),
        "service_id": str(row.service_id) if row.service_id else None,
        "name": row.name,
        "qty": row.qty,
        "unit_price_cents": row.unit_price_cents,
        "total_cents": row.total_cents,
        "unit_price_text": _money(row.unit_price_cents),
        "total_text": _money(row.total_cents),
        "created_at": row.created_at,
    }


def _serialize_payment(row: Payment) -> dict:
    return {
        "id": str(row.id),
        "invoice_id": str(row.invoice_id),
        "provider": row.provider,
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "amount_cents": row.amount_cents,
        "amount_text": _money(row.amount_cents),
        "currency": row.currency,
        "receipt_text": row.receipt_text,
        "created_at": row.created_at,
    }


def _serialize_invoice(row: Invoice) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "owner_id": str(row.owner_id),
        "pet_id": str(row.pet_id),
        "visit_id": str(row.visit_id) if row.visit_id else None,
        "appointment_id": str(row.appointment_id) if row.appointment_id else None,
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "total_cents": row.total_cents,
        "total_text": _money(row.total_cents),
        "currency": row.currency,
        "issued_at": row.issued_at,
        "paid_at": row.paid_at,
        "public_token": row.public_token,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_policy(row: InsurancePolicy) -> dict:
    return {
        "id": str(row.id),
        "owner_id": str(row.owner_id),
        "provider_name": row.provider_name,
        "policy_number_masked": row.policy_number_masked,
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_claim(row: InsuranceClaim) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "owner_id": str(row.owner_id),
        "pet_id": str(row.pet_id),
        "invoice_id": str(row.invoice_id),
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "notes": row.notes,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_lab_result(row: LabResult) -> dict:
    return {
        "id": str(row.id),
        "order_id": str(row.order_id),
        "result_text": row.result_text,
        "attachments": list(row.attachments_json or []),
        "created_at": row.created_at,
    }


def _serialize_lab_order(row: LabOrder) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "pet_id": str(row.pet_id),
        "visit_id": str(row.visit_id) if row.visit_id else None,
        "provider_id": str(row.provider_id),
        "status": row.status.value if hasattr(row.status, "value") else str(row.status),
        "ordered_at": row.ordered_at,
        "received_at": row.received_at,
        "external_ref": row.external_ref,
        "created_by": str(row.created_by),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _mask_policy_number(raw: str) -> str:
    cleaned = raw.strip()
    if len(cleaned) <= 4:
        return f"****{cleaned}"
    return f"{'*' * (len(cleaned) - 4)}{cleaned[-4:]}"


def _pdf_escape(value: str) -> str:
    safe = "".join(ch for ch in value if ord(ch) < 128)
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: list[str]) -> bytes:
    text_lines = lines[:48]
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


async def _recalculate_invoice_total(db: AsyncSession, invoice: Invoice) -> None:
    total = await db.scalar(
        select(func.coalesce(func.sum(InvoiceItem.total_cents), 0)).where(InvoiceItem.invoice_id == invoice.id)
    )
    invoice.total_cents = int(total or 0)


async def _get_invoice_for_clinic(
    db: AsyncSession,
    *,
    invoice_id: str,
    clinic_id: uuid.UUID,
) -> Invoice:
    row = await db.scalar(
        select(Invoice).where(Invoice.id == _parse_uuid(invoice_id, field_name="invoice_id"), Invoice.clinic_id == clinic_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invoice not found"})
    return row


def _parse_range(value: str) -> int:
    allowed = {"7d": 7, "30d": 30, "90d": 90}
    return allowed.get(value, 30)


@router.get("/clinic/services")
async def clinic_list_services(
    category: ClinicServiceCategory | None = None,
    include_inactive: bool = False,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    query = select(ClinicService).where(ClinicService.clinic_id == membership.clinic_id)
    if not include_inactive:
        query = query.where(ClinicService.is_active.is_(True))
    if category:
        query = query.where(ClinicService.category == category)
    rows = (await db.scalars(query.order_by(ClinicService.name.asc()))).all()
    return [_serialize_clinic_service(row) for row in rows]


@router.post("/clinic/services", status_code=status.HTTP_201_CREATED)
async def clinic_create_service(
    payload: ClinicServiceCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    service_name = payload.name.strip()
    existing = await db.scalar(
        select(ClinicService.id).where(
            ClinicService.clinic_id == membership.clinic_id,
            func.lower(ClinicService.name) == service_name.lower(),
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "SERVICE_DUPLICATE", "message": "Service with this name already exists"},
        )

    row = ClinicService(
        clinic_id=membership.clinic_id,
        name=service_name,
        category=payload.category,
        price_cents=payload.price_cents,
        currency=payload.currency.upper(),
        duration_minutes=payload.duration_minutes,
        is_active=payload.is_active,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "SERVICE_DUPLICATE", "message": "Service with this name already exists"},
        )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="clinic_service.create",
        target_type="clinic_service",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_clinic_service(row)


@router.patch("/clinic/services/{service_id}")
async def clinic_patch_service(
    service_id: str,
    payload: ClinicServicePatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    row = await db.scalar(
        select(ClinicService).where(
            ClinicService.id == _parse_uuid(service_id, field_name="service_id"),
            ClinicService.clinic_id == membership.clinic_id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Service not found"})

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"]:
        new_name = updates["name"].strip()
        existing = await db.scalar(
            select(ClinicService.id).where(
                ClinicService.clinic_id == membership.clinic_id,
                ClinicService.id != row.id,
                func.lower(ClinicService.name) == new_name.lower(),
            )
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail={"code": "SERVICE_DUPLICATE", "message": "Service with this name already exists"},
            )
        updates["name"] = new_name
    for key, value in updates.items():
        if key == "currency" and value:
            value = value.upper()
        setattr(row, key, value)

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="clinic_service.update",
        target_type="clinic_service",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_clinic_service(row)


@router.post("/clinic/invoices", status_code=status.HTTP_201_CREATED)
async def clinic_create_invoice(
    payload: InvoiceCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)

    owner_id = _parse_uuid(payload.owner_id, field_name="owner_id")
    pet_id = _parse_uuid(payload.pet_id, field_name="pet_id")
    visit_id = _parse_uuid(payload.visit_id, field_name="visit_id") if payload.visit_id else None
    appointment_id = _parse_uuid(payload.appointment_id, field_name="appointment_id") if payload.appointment_id else None

    owner_link = await db.scalar(select(PetOwnerLink).where(PetOwnerLink.pet_id == pet_id, PetOwnerLink.owner_user_id == owner_id))
    if not owner_link:
        raise HTTPException(status_code=409, detail={"code": "OWNER_PET_MISMATCH", "message": "Owner does not own pet"})

    if visit_id:
        visit = await db.scalar(select(Visit).where(Visit.id == visit_id))
        if not visit or visit.pet_id != pet_id or visit.clinic_id != membership.clinic_id:
            raise HTTPException(status_code=409, detail={"code": "VISIT_MISMATCH", "message": "Visit does not match clinic/pet"})
    if appointment_id:
        appt = await db.scalar(select(Appointment).where(Appointment.id == appointment_id))
        if not appt or appt.pet_id != pet_id or appt.clinic_id != membership.clinic_id:
            raise HTTPException(
                status_code=409,
                detail={"code": "APPOINTMENT_MISMATCH", "message": "Appointment does not match clinic/pet"},
            )

    row = Invoice(
        clinic_id=membership.clinic_id,
        owner_id=owner_id,
        pet_id=pet_id,
        visit_id=visit_id,
        appointment_id=appointment_id,
        status=InvoiceStatus.draft,
        total_cents=0,
        currency=payload.currency.upper(),
    )
    db.add(row)
    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.create",
        target_type="invoice",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_invoice(row)


@router.get("/clinic/invoices")
async def clinic_list_invoices(
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    query = select(Invoice).where(Invoice.clinic_id == membership.clinic_id)
    if status_filter:
        query = query.where(Invoice.status == status_filter)
    if date_from:
        query = query.where(Invoice.created_at >= date_from)
    if date_to:
        query = query.where(Invoice.created_at <= date_to)
    rows = (await db.scalars(query.order_by(Invoice.created_at.desc()))).all()
    return [_serialize_invoice(row) for row in rows]


@router.get("/clinic/invoices/{invoice_id}")
async def clinic_get_invoice(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)
    items = (
        await db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id).order_by(InvoiceItem.created_at.asc()))
    ).all()
    payments = (await db.scalars(select(Payment).where(Payment.invoice_id == invoice.id).order_by(Payment.created_at.desc()))).all()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.view",
        target_type="invoice",
        target_id=str(invoice.id),
    )
    await db.commit()
    return {
        **_serialize_invoice(invoice),
        "items": [_serialize_invoice_item(row) for row in items],
        "payments": [_serialize_payment(row) for row in payments],
    }


@router.post("/clinic/invoices/{invoice_id}/items", status_code=status.HTTP_201_CREATED)
async def clinic_add_invoice_item(
    invoice_id: str,
    payload: InvoiceItemCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)

    if invoice.status in {InvoiceStatus.paid, InvoiceStatus.void}:
        raise HTTPException(status_code=409, detail={"code": "LOCKED", "message": "Invoice is locked"})

    service = None
    if payload.service_id:
        service = await db.scalar(
            select(ClinicService).where(
                ClinicService.id == _parse_uuid(payload.service_id, field_name="service_id"),
                ClinicService.clinic_id == membership.clinic_id,
            )
        )
        if not service:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Clinic service not found"})

    name = payload.name.strip() if payload.name else (service.name if service else None)
    if not name:
        raise HTTPException(status_code=400, detail={"code": "BAD_REQUEST", "message": "Item name is required"})

    unit_price = payload.unit_price_cents if payload.unit_price_cents is not None else (service.price_cents if service else None)
    if unit_price is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "BAD_REQUEST", "message": "unit_price_cents is required when service_id is not provided"},
        )
    total_cents = int(unit_price) * int(payload.qty)

    row = InvoiceItem(
        invoice_id=invoice.id,
        service_id=service.id if service else None,
        name=name,
        qty=payload.qty,
        unit_price_cents=unit_price,
        total_cents=total_cents,
    )
    db.add(row)
    await db.flush()
    await _recalculate_invoice_total(db, invoice)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.item.add",
        target_type="invoice_item",
        target_id=str(row.id),
        metadata={"invoice_id": str(invoice.id)},
    )
    await db.commit()
    await db.refresh(row)
    await db.refresh(invoice)
    return {"invoice": _serialize_invoice(invoice), "item": _serialize_invoice_item(row)}


@router.delete("/clinic/invoices/{invoice_id}/items/{item_id}")
async def clinic_delete_invoice_item(
    invoice_id: str,
    item_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)
    if invoice.status in {InvoiceStatus.paid, InvoiceStatus.void}:
        raise HTTPException(status_code=409, detail={"code": "LOCKED", "message": "Invoice is locked"})

    row = await db.scalar(
        select(InvoiceItem).where(
            InvoiceItem.id == _parse_uuid(item_id, field_name="item_id"),
            InvoiceItem.invoice_id == invoice.id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invoice item not found"})
    await db.delete(row)
    await db.flush()
    await _recalculate_invoice_total(db, invoice)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.item.delete",
        target_type="invoice_item",
        target_id=item_id,
        metadata={"invoice_id": str(invoice.id)},
    )
    await db.commit()
    await db.refresh(invoice)
    return {"invoice": _serialize_invoice(invoice), "status": "deleted"}


@router.post("/clinic/invoices/{invoice_id}/issue")
async def clinic_issue_invoice(
    invoice_id: str,
    payload: InvoiceStatusRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)
    if invoice.status == InvoiceStatus.void:
        raise HTTPException(status_code=409, detail={"code": "LOCKED", "message": "Invoice is void"})

    await _recalculate_invoice_total(db, invoice)
    invoice.status = InvoiceStatus.issued
    invoice.issued_at = _utcnow()
    if not invoice.public_token:
        invoice.public_token = secrets.token_urlsafe(24)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.issue",
        target_type="invoice",
        target_id=str(invoice.id),
        metadata={"note": payload.note if payload else None},
    )
    await db.commit()
    await db.refresh(invoice)
    return _serialize_invoice(invoice)


@router.post("/clinic/invoices/{invoice_id}/void")
async def clinic_void_invoice(
    invoice_id: str,
    payload: InvoiceStatusRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)
    if invoice.status == InvoiceStatus.paid:
        raise HTTPException(status_code=409, detail={"code": "LOCKED", "message": "Paid invoice cannot be voided"})

    invoice.status = InvoiceStatus.void
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.void",
        target_type="invoice",
        target_id=str(invoice.id),
        metadata={"note": payload.note if payload else None},
    )
    await db.commit()
    await db.refresh(invoice)
    return _serialize_invoice(invoice)


@router.post("/clinic/invoices/{invoice_id}/mark-paid")
async def clinic_mark_invoice_paid(
    invoice_id: str,
    payload: InvoiceStatusRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)
    if invoice.status == InvoiceStatus.void:
        raise HTTPException(status_code=409, detail={"code": "LOCKED", "message": "Void invoice cannot be paid"})

    invoice.status = InvoiceStatus.paid
    invoice.paid_at = _utcnow()
    payment = Payment(
        invoice_id=invoice.id,
        provider="manual",
        status=PaymentStatus.succeeded,
        amount_cents=invoice.total_cents,
        currency=invoice.currency,
        receipt_text=payload.note if payload and payload.note else "Manual settlement by clinic admin",
    )
    db.add(payment)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.mark_paid",
        target_type="invoice",
        target_id=str(invoice.id),
    )
    await db.commit()
    await db.refresh(invoice)
    await db.refresh(payment)
    return {"invoice": _serialize_invoice(invoice), "payment": _serialize_payment(payment)}


@router.get("/clinic/invoices/{invoice_id}/export/pdf")
async def clinic_export_invoice_pdf(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Response:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    invoice = await _get_invoice_for_clinic(db, invoice_id=invoice_id, clinic_id=membership.clinic_id)

    owner = await db.scalar(select(User).where(User.id == invoice.owner_id))
    items = (await db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id))).all()
    lines = [
        "Saint Petersburg Vet Clinic - Invoice",
        f"Invoice ID: {invoice.id}",
        f"Status: {invoice.status.value}",
        f"Issued at: {invoice.issued_at.isoformat() if invoice.issued_at else '-'}",
        f"Owner: {owner.full_name if owner else str(invoice.owner_id)}",
        f"Pet ID: {invoice.pet_id}",
        "",
        "Items:",
    ]
    for item in items:
        lines.append(f"- {item.name} x{item.qty} = {_money(item.total_cents)} {invoice.currency}")
    lines.extend(
        [
            "",
            f"Total: {_money(invoice.total_cents)} {invoice.currency}",
            "This invoice contains operational billing data only.",
        ]
    )
    pdf_bytes = _build_simple_pdf(lines)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="invoice.export_pdf",
        target_type="invoice",
        target_id=str(invoice.id),
    )
    await db.commit()
    headers = {"Content-Disposition": f'attachment; filename="invoice-{invoice.id}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/owner/invoices")
async def owner_list_invoices(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.owner)
    rows = (await db.scalars(select(Invoice).where(Invoice.owner_id == current_user.id).order_by(Invoice.created_at.desc()))).all()
    return [_serialize_invoice(row) for row in rows]


@router.get("/owner/invoices/{invoice_id}")
async def owner_get_invoice(
    invoice_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.owner)
    row = await db.scalar(
        select(Invoice).where(
            Invoice.id == _parse_uuid(invoice_id, field_name="invoice_id"),
            Invoice.owner_id == current_user.id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invoice not found"})
    items = (await db.scalars(select(InvoiceItem).where(InvoiceItem.invoice_id == row.id))).all()
    payments = (await db.scalars(select(Payment).where(Payment.invoice_id == row.id).order_by(Payment.created_at.desc()))).all()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="invoice.owner_view",
        target_type="invoice",
        target_id=str(row.id),
    )
    await db.commit()
    return {
        **_serialize_invoice(row),
        "items": [_serialize_invoice_item(item) for item in items],
        "payments": [_serialize_payment(payment) for payment in payments],
    }


@router.post("/owner/invoices/{invoice_id}/pay")
async def owner_pay_invoice(
    invoice_id: str,
    payload: OwnerPayInvoiceRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.owner)
    invoice = await db.scalar(
        select(Invoice).where(
            Invoice.id == _parse_uuid(invoice_id, field_name="invoice_id"),
            Invoice.owner_id == current_user.id,
        )
    )
    if not invoice:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invoice not found"})
    if invoice.status not in {InvoiceStatus.issued, InvoiceStatus.draft}:
        raise HTTPException(status_code=409, detail={"code": "INVALID_STATUS", "message": "Invoice is not payable"})
    if invoice.status == InvoiceStatus.draft:
        invoice.status = InvoiceStatus.issued
        invoice.issued_at = _utcnow()

    provider = get_payments_provider()
    provider_result = await provider.charge_invoice(
        db,
        invoice=invoice,
        simulate_result=payload.simulate_result if payload else None,
    )
    status_value = provider_result.get("status", "failed")
    payment_status = PaymentStatus.succeeded if status_value == "succeeded" else PaymentStatus.failed
    payment = Payment(
        invoice_id=invoice.id,
        provider=provider_result.get("provider", provider.name),
        status=payment_status,
        amount_cents=int(provider_result.get("amount_cents", invoice.total_cents)),
        currency=provider_result.get("currency", invoice.currency),
        receipt_text=provider_result.get("receipt_text"),
    )
    db.add(payment)
    if payment_status == PaymentStatus.succeeded:
        invoice.status = InvoiceStatus.paid
        invoice.paid_at = _utcnow()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(invoice.clinic_id),
        action="invoice.owner_pay",
        target_type="invoice",
        target_id=str(invoice.id),
        metadata={"provider": payment.provider, "result": payment.status.value},
    )
    await db.commit()
    await db.refresh(invoice)
    await db.refresh(payment)
    return {"invoice": _serialize_invoice(invoice), "payment": _serialize_payment(payment)}


@router.get("/public/pay/{invoice_token}")
async def public_invoice_payment_view(
    invoice_token: str,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Invoice).where(Invoice.public_token == invoice_token))
    if not row or row.status == InvoiceStatus.void:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invoice link not found"})
    return {
        "invoice_id": str(row.id),
        "status": row.status.value,
        "total_cents": row.total_cents,
        "total_text": _money(row.total_cents),
        "currency": row.currency,
        "warning": "Public payment page contains billing totals only and no medical details.",
    }


@router.post("/owner/insurance/policies", status_code=status.HTTP_201_CREATED)
async def owner_create_policy(
    payload: InsurancePolicyCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.owner)
    row = InsurancePolicy(
        owner_id=current_user.id,
        provider_name=payload.provider_name.strip(),
        policy_number_masked=_mask_policy_number(payload.policy_number),
        status=InsurancePolicyStatus.active,
    )
    db.add(row)
    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="insurance.policy.create",
        target_type="insurance_policy",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_policy(row)


@router.get("/owner/insurance/policies")
async def owner_list_policies(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.owner)
    rows = (
        await db.scalars(select(InsurancePolicy).where(InsurancePolicy.owner_id == current_user.id).order_by(InsurancePolicy.created_at.desc()))
    ).all()
    return [_serialize_policy(row) for row in rows]


@router.post("/owner/insurance/claims", status_code=status.HTTP_201_CREATED)
async def owner_create_claim(
    payload: InsuranceClaimCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.owner)
    invoice = await db.scalar(
        select(Invoice).where(
            Invoice.id == _parse_uuid(payload.invoice_id, field_name="invoice_id"),
            Invoice.owner_id == current_user.id,
        )
    )
    if not invoice:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Invoice not found"})
    row = InsuranceClaim(
        clinic_id=invoice.clinic_id,
        owner_id=current_user.id,
        pet_id=invoice.pet_id,
        invoice_id=invoice.id,
        status=InsuranceClaimStatus.submitted,
        notes=payload.notes,
    )
    db.add(row)
    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(invoice.clinic_id),
        action="insurance.claim.create",
        target_type="insurance_claim",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_claim(row)


@router.get("/owner/insurance/claims")
async def owner_list_claims(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.owner)
    rows = (
        await db.scalars(select(InsuranceClaim).where(InsuranceClaim.owner_id == current_user.id).order_by(InsuranceClaim.created_at.desc()))
    ).all()
    return [_serialize_claim(row) for row in rows]


@router.get("/clinic/insurance/claims")
async def clinic_list_claims(
    status_filter: InsuranceClaimStatus | None = Query(default=None, alias="status"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    query = select(InsuranceClaim).where(InsuranceClaim.clinic_id == membership.clinic_id)
    if status_filter:
        query = query.where(InsuranceClaim.status == status_filter)
    rows = (await db.scalars(query.order_by(InsuranceClaim.created_at.desc()))).all()
    return [_serialize_claim(row) for row in rows]


@router.patch("/clinic/insurance/claims/{claim_id}")
async def clinic_patch_claim(
    claim_id: str,
    payload: InsuranceClaimPatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    row = await db.scalar(
        select(InsuranceClaim).where(
            InsuranceClaim.id == _parse_uuid(claim_id, field_name="claim_id"),
            InsuranceClaim.clinic_id == membership.clinic_id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Claim not found"})
    row.status = payload.status
    row.notes = payload.notes
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="insurance.claim.update",
        target_type="insurance_claim",
        target_id=str(row.id),
        metadata={"status": row.status.value},
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_claim(row)


@router.post("/vet/labs/orders", status_code=status.HTTP_201_CREATED)
async def vet_create_lab_order(
    payload: LabOrderCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.vet)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    pet_id = _parse_uuid(payload.pet_id, field_name="pet_id")
    visit_id = _parse_uuid(payload.visit_id, field_name="visit_id") if payload.visit_id else None

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=pet_id,
        clinic_id=membership.clinic_id,
        required_scope=ConsentScope.basic_medical,
    )

    provider = None
    if payload.provider_id:
        provider = await db.scalar(
            select(LabProvider).where(
                LabProvider.id == _parse_uuid(payload.provider_id, field_name="provider_id"),
                LabProvider.is_active.is_(True),
            )
        )
    if not provider:
        provider = await db.scalar(select(LabProvider).where(LabProvider.is_active.is_(True)).order_by(LabProvider.created_at.asc()))
    if not provider:
        raise HTTPException(status_code=409, detail={"code": "NO_PROVIDER", "message": "No active lab provider"})

    row = LabOrder(
        clinic_id=membership.clinic_id,
        pet_id=pet_id,
        visit_id=visit_id,
        provider_id=provider.id,
        status=LabOrderStatus.created,
        ordered_at=_utcnow(),
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="lab_order.create",
        target_type="lab_order",
        target_id=str(row.id),
        metadata={"provider_id": str(provider.id)},
    )
    await db.commit()
    await db.refresh(row)
    return _serialize_lab_order(row)


@router.get("/vet/labs/orders")
async def vet_list_lab_orders(
    status_filter: LabOrderStatus | None = Query(default=None, alias="status"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.vet)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    query = select(LabOrder).where(LabOrder.clinic_id == membership.clinic_id)
    if status_filter:
        query = query.where(LabOrder.status == status_filter)
    rows = (await db.scalars(query.order_by(LabOrder.ordered_at.desc()))).all()
    return [_serialize_lab_order(row) for row in rows]


@router.get("/vet/labs/orders/{order_id}")
async def vet_get_lab_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.vet)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    row = await db.scalar(
        select(LabOrder).where(
            LabOrder.id == _parse_uuid(order_id, field_name="order_id"),
            LabOrder.clinic_id == membership.clinic_id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lab order not found"})
    results = (await db.scalars(select(LabResult).where(LabResult.order_id == row.id).order_by(LabResult.created_at.desc()))).all()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="lab_order.view",
        target_type="lab_order",
        target_id=str(row.id),
    )
    await db.commit()
    return {**_serialize_lab_order(row), "results": [_serialize_lab_result(result) for result in results]}


@router.post("/vet/labs/orders/{order_id}/send")
async def vet_send_lab_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.vet)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    row = await db.scalar(
        select(LabOrder).where(
            LabOrder.id == _parse_uuid(order_id, field_name="order_id"),
            LabOrder.clinic_id == membership.clinic_id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lab order not found"})
    if row.status == LabOrderStatus.cancelled:
        raise HTTPException(status_code=409, detail={"code": "LOCKED", "message": "Order is cancelled"})

    provider = get_labs_provider()
    payload = await provider.send_order(db, order=row)
    row.status = LabOrderStatus.sent
    row.external_ref = payload.get("external_ref")
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="lab_order.send",
        target_type="lab_order",
        target_id=str(row.id),
        metadata={"provider": payload.get("provider"), "external_ref": row.external_ref},
    )
    await db.commit()
    await db.refresh(row)
    return {**_serialize_lab_order(row), "provider_payload": payload}


@router.post("/vet/labs/orders/{order_id}/import-result")
async def vet_import_lab_result(
    order_id: str,
    payload: LabImportRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.vet)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    row = await db.scalar(
        select(LabOrder).where(
            LabOrder.id == _parse_uuid(order_id, field_name="order_id"),
            LabOrder.clinic_id == membership.clinic_id,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Lab order not found"})

    provider = get_labs_provider()
    result_payload = await provider.import_result(db, order=row, species=payload.species if payload else None)
    row.status = LabOrderStatus.received
    row.received_at = _utcnow()
    result = LabResult(
        order_id=row.id,
        result_text=result_payload.get("result_text", "Лабораторный результат добавлен в демо-режиме."),
        attachments_json=list(result_payload.get("attachments") or []),
    )
    db.add(result)
    await db.flush()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(membership.clinic_id),
        action="lab_order.import_result",
        target_type="lab_result",
        target_id=str(result.id),
        metadata={"order_id": str(row.id), "provider": result_payload.get("provider")},
    )
    await db.commit()
    await db.refresh(row)
    await db.refresh(result)
    return {"order": _serialize_lab_order(row), "result": _serialize_lab_result(result)}


@router.get("/owner/pet/{pet_id}/labs")
async def owner_pet_labs(
    pet_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    _ensure_staff_role(current_user, RoleEnum.owner)
    pet_uuid = _parse_uuid(pet_id, field_name="pet_id")
    await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=pet_uuid)

    orders = (
        await db.scalars(select(LabOrder).where(LabOrder.pet_id == pet_uuid).order_by(LabOrder.ordered_at.desc()))
    ).all()
    order_ids = [row.id for row in orders]
    results = (
        await db.scalars(select(LabResult).where(LabResult.order_id.in_(order_ids)).order_by(LabResult.created_at.desc()))
    ).all() if order_ids else []
    results_by_order: dict[uuid.UUID, list[LabResult]] = {}
    for result in results:
        results_by_order.setdefault(result.order_id, []).append(result)

    payload: list[dict] = []
    for order in orders:
        safe_results = []
        for result in results_by_order.get(order.id, []):
            safe_results.append(
                {
                    "id": str(result.id),
                    "summary": result.result_text,
                    "attachments": list(result.attachments_json or []),
                    "questions_for_vet": [
                        "Какие показатели требуют контроля в динамике?",
                        "Нужен ли повторный анализ и когда?",
                    ],
                    "disclaimer": "Это справочная информация и не заменяет консультацию ветеринарного врача.",
                    "created_at": result.created_at,
                }
            )
        payload.append(
            {
                "order_id": str(order.id),
                "status": order.status.value if hasattr(order.status, "value") else str(order.status),
                "ordered_at": order.ordered_at,
                "received_at": order.received_at,
                "results": safe_results,
            }
        )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="lab_result.owner_view",
        target_type="pet",
        target_id=pet_id,
    )
    await db.commit()
    return payload


@router.get("/clinic/analytics/summary")
async def clinic_analytics_summary(
    range: str = Query(default="30d", pattern="^(7d|30d|90d)$"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    days = _parse_range(range)
    since = _utcnow() - timedelta(days=days)

    invoices = (
        await db.scalars(select(Invoice).where(Invoice.clinic_id == membership.clinic_id, Invoice.created_at >= since))
    ).all()
    appointments = (
        await db.scalars(
            select(Appointment).where(Appointment.clinic_id == membership.clinic_id, Appointment.start_at >= since)
        )
    ).all()
    active_stays_count = await db.scalar(
        select(func.count(InpatientStay.id)).where(
            InpatientStay.clinic_id == membership.clinic_id,
            InpatientStay.status == InpatientStatus.active,
        )
    )

    paid_invoices = [row for row in invoices if row.status == InvoiceStatus.paid]
    outstanding_invoices = [row for row in invoices if row.status in {InvoiceStatus.issued, InvoiceStatus.draft}]
    revenue_cents = sum(int(row.total_cents or 0) for row in paid_invoices)
    no_show_count = sum(1 for row in appointments if row.status == AppointmentStatus.no_show)
    appointments_count = len(appointments)
    no_show_rate = round((no_show_count / appointments_count) * 100, 1) if appointments_count else 0.0
    avg_visit_duration = round(
        (sum(int(row.duration_minutes or 0) for row in appointments) / appointments_count) if appointments_count else 0,
        1,
    )

    top_service_row = await db.execute(
        select(InvoiceItem.name, func.coalesce(func.sum(InvoiceItem.total_cents), 0).label("total"))
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.clinic_id == membership.clinic_id, Invoice.created_at >= since)
        .group_by(InvoiceItem.name)
        .order_by(func.sum(InvoiceItem.total_cents).desc())
        .limit(1)
    )
    top_service_data = top_service_row.first()

    clinic_rating = await db.scalar(
        select(RatingsSummary.avg_rating).where(
            RatingsSummary.target_type == ReviewTargetType.clinic,
            RatingsSummary.target_id == membership.clinic_id,
        )
    )

    return {
        "range": range,
        "revenue_cents": revenue_cents,
        "revenue_text": _money(revenue_cents),
        "paid_invoices": len(paid_invoices),
        "outstanding_invoices": len(outstanding_invoices),
        "appointments_count": appointments_count,
        "no_show_rate": no_show_rate,
        "top_service": {
            "name": top_service_data[0] if top_service_data else None,
            "revenue_cents": int(top_service_data[1]) if top_service_data else 0,
        },
        "inpatient_occupancy_avg": round((active_stays_count or 0) / 24 * 100, 1),
        "inpatient_occupancy_peak": round(min(100.0, ((active_stays_count or 0) + 3) / 24 * 100), 1),
        "avg_visit_duration_minutes": avg_visit_duration,
        "rating_avg": round(float(clinic_rating or 0), 2),
    }


@router.get("/clinic/analytics/revenue-series")
async def clinic_analytics_revenue_series(
    range: str = Query(default="30d", pattern="^(7d|30d|90d)$"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    days = _parse_range(range)
    since = _utcnow() - timedelta(days=days)
    rows = (
        await db.scalars(
            select(Invoice).where(
                Invoice.clinic_id == membership.clinic_id,
                Invoice.status == InvoiceStatus.paid,
                Invoice.paid_at.is_not(None),
                Invoice.paid_at >= since,
            )
        )
    ).all()
    buckets: dict[str, int] = {}
    for day_idx in range(days):
        d = (since + timedelta(days=day_idx)).date().isoformat()
        buckets[d] = 0
    for row in rows:
        key = row.paid_at.date().isoformat()
        if key in buckets:
            buckets[key] += int(row.total_cents or 0)
    series = [{"date": key, "revenue_cents": value} for key, value in sorted(buckets.items())]
    return {"range": range, "series": series}


@router.get("/clinic/analytics/services-top")
async def clinic_analytics_services_top(
    range: str = Query(default="30d", pattern="^(7d|30d|90d)$"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    days = _parse_range(range)
    since = _utcnow() - timedelta(days=days)
    rows = (
        await db.execute(
            select(InvoiceItem.name, func.coalesce(func.sum(InvoiceItem.total_cents), 0).label("revenue_cents"))
            .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
            .where(Invoice.clinic_id == membership.clinic_id, Invoice.created_at >= since)
            .group_by(InvoiceItem.name)
            .order_by(func.sum(InvoiceItem.total_cents).desc())
            .limit(10)
        )
    ).all()
    return {
        "range": range,
        "items": [{"service_name": row[0], "revenue_cents": int(row[1])} for row in rows],
    }


@router.get("/clinic/analytics/staff-utilization")
async def clinic_analytics_staff_utilization(
    range: str = Query(default="30d", pattern="^(7d|30d|90d)$"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    _ensure_staff_role(current_user, RoleEnum.clinic_admin, RoleEnum.network_admin)
    membership = await _resolve_staff_membership(db, user_id=current_user.id)
    days = _parse_range(range)
    since = _utcnow() - timedelta(days=days)

    rows = (
        await db.execute(
            select(User.id, User.full_name, func.count(Appointment.id).label("appointments_count"))
            .join(Membership, and_(Membership.user_id == User.id, Membership.clinic_id == membership.clinic_id))
            .outerjoin(
                Appointment,
                and_(
                    Appointment.vet_id == User.id,
                    Appointment.clinic_id == membership.clinic_id,
                    Appointment.start_at >= since,
                ),
            )
            .where(User.role == RoleEnum.vet)
            .group_by(User.id, User.full_name)
            .order_by(func.count(Appointment.id).desc(), User.full_name.asc())
        )
    ).all()
    max_count = max((int(row[2]) for row in rows), default=1)
    items = [
        {
            "vet_id": str(row[0]),
            "vet_name": row[1],
            "appointments_count": int(row[2]),
            "utilization_pct": round((int(row[2]) / max_count) * 100, 1) if max_count else 0,
        }
        for row in rows
    ]
    return {"range": range, "items": items}
