from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import ConsentScope, Document, MasterPet, PetOwnerLink, Prescription, RoleEnum, Symptom, User, Visit
from src.security.deps import enforce_pet_scope, get_current_user, require_roles
from src.services.ai_safe import has_policy_violation
from src.services.audit import log_audit
from src.services.medical_engine import (
    der,
    disease_dataset,
    drug_dosage,
    fluid_therapy,
    medication_dataset,
    red_flag_library,
    rer,
    run_triage,
    symptom_categories,
    symptom_dataset,
    transfusion,
)

router = APIRouter(prefix="/medical", tags=["medical-engine"])


class MedicalTriageRequest(BaseModel):
    symptom_text: str = ""
    symptom_ids: list[str] = Field(default_factory=list)
    symptom_names: list[str] = Field(default_factory=list)
    duration_hours: float | None = Field(default=None, ge=0, le=24 * 60)
    animal_type: str | None = None
    age_years: float | None = Field(default=None, ge=0, le=50)
    severity_indicators: list[str] = Field(default_factory=list)


class RERRequest(BaseModel):
    weight_kg: float = Field(gt=0, le=250)


class DERRequest(BaseModel):
    weight_kg: float = Field(gt=0, le=250)
    activity_factor: float = Field(gt=0, le=10)


class FluidTherapyRequest(BaseModel):
    weight_kg: float = Field(gt=0, le=250)
    maintenance_ml_per_kg_day: float = Field(gt=0, le=500)
    duration_hr: float = Field(gt=0, le=240)
    dehydration_percent: float = Field(ge=0, le=20)


class DrugDosageRequest(BaseModel):
    weight_kg: float = Field(gt=0, le=250)
    dose_mg_per_kg: float = Field(gt=0, le=500)
    concentration_mg_per_ml: float = Field(gt=0, le=10000)


class TransfusionRequest(BaseModel):
    weight_kg: float = Field(gt=0, le=250)
    species_constant: float = Field(gt=0, le=200)


def _serialize_prescription(row: Prescription) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "medication": row.drug_name,
        "instructions": row.instruction_note,
        "dosage": "Specified by veterinarian in visit instructions.",
        "notes": "РЕЦЕПТУРНОЕ" if row.prescription_required else "Нерецептурное по решению врача.",
        "prescription_required": row.prescription_required,
    }


async def _build_visit_protocol(visit: Visit, db: AsyncSession) -> dict[str, Any]:
    pet = await db.scalar(select(MasterPet).where(MasterPet.id == visit.pet_id))
    owner = await db.scalar(
        select(User)
        .join(PetOwnerLink, PetOwnerLink.owner_user_id == User.id)
        .where(PetOwnerLink.pet_id == visit.pet_id, User.role == RoleEnum.owner)
    )
    docs = (
        await db.scalars(
            select(Document)
            .where(Document.pet_id == visit.pet_id, Document.clinic_id == visit.clinic_id)
            .order_by(Document.created_at.desc())
            .limit(6)
        )
    ).all()
    prescriptions = (
        await db.scalars(select(Prescription).where(Prescription.visit_id == visit.id).order_by(Prescription.created_at.asc()))
    ).all()
    diagnostics = [d.doc_type for d in docs] if docs else ["Клинический осмотр и лаборатория по показаниям"]

    return {
        "patient": {
            "id": str(pet.id) if pet else str(visit.pet_id),
            "name": pet.name if pet else "Unknown",
            "species": pet.species if pet else "",
            "breed": pet.breed if pet else "",
            "chip_id": pet.chip_id if pet else None,
        },
        "owner": {
            "name": owner.full_name if owner else "Unknown",
            "email": owner.email if owner else None,
            "phone": owner.phone if owner else None,
        },
        "complaints": visit.chief_complaint or "",
        "physical_exam": visit.exam_findings or "",
        "diagnostics": diagnostics,
        "assessment": "Clinical assessment by veterinarian. No automatic diagnosis.",
        "plan": visit.plan_note or "",
        "prescriptions": [_serialize_prescription(rx) for rx in prescriptions],
        "follow_up": "Контрольный визит по решению ветеринарного врача.",
        "disclaimer": "Protocol is a clinical record. Treatment decisions are made by veterinarian only.",
    }


@router.get("/symptoms")
async def get_medical_symptoms(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    red_flag: bool | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    rows = symptom_dataset(q=q, category=category, red_flag=red_flag, limit=limit)
    return {"count": len(rows), "items": rows}


@router.get("/symptoms/categories")
async def get_symptom_categories(current_user=Depends(get_current_user)) -> dict[str, Any]:
    return {"items": symptom_categories()}


@router.get("/symptoms/red-flags")
async def get_red_flags(current_user=Depends(get_current_user)) -> dict[str, Any]:
    rows = red_flag_library()
    return {"count": len(rows), "items": rows}


@router.post("/triage")
async def run_medical_triage(
    payload: MedicalTriageRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    combined_text = " ".join([payload.symptom_text, *payload.severity_indicators, *payload.symptom_names]).strip()
    if current_user.role == RoleEnum.owner and has_policy_violation(combined_text):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "POLICY_VIOLATION",
                "message": "I can't prescribe treatment. Contact a veterinarian.",
            },
        )

    ids_clean = [str(x) for x in (payload.symptom_ids or []) if x]
    if ids_clean:
        rows = (await db.scalars(select(Symptom).where(Symptom.id.in_(ids_clean)))).all()
        emergency_names = [r.name for r in rows if r.emergency_flag]
        if emergency_names:
            return {
                "level": "RED",
                "red_flags_detected": emergency_names,
                "key_reasons": ["Среди выбранных симптомов есть признаки, требующие срочной ветеринарной помощи."],
                "questions_to_ask": ["Когда это началось?", "Есть ли ухудшение в последний час?"],
                "next_steps": ["Свяжитесь с клиникой немедленно или приезжайте на экстренный приём."],
                "what_to_prepare_for_visit": [
                    "Кратко зафиксируйте время начала симптомов и динамику.",
                    "Возьмите документы питомца и список текущих лекарств.",
                    "Подготовьте безопасную переноску и выезжайте в клинику без задержки.",
                ],
                "disclaimer": "Оценка не заменяет осмотр ветеринара и не является диагнозом.",
                "matched_symptoms": [
                    {"id": r.id, "name": r.name, "red_flag": bool(r.emergency_flag)} for r in rows
                ],
            }

    result = run_triage(
        symptom_text=payload.symptom_text,
        symptom_ids=payload.symptom_ids,
        symptom_names=payload.symptom_names,
        duration_hours=payload.duration_hours,
        animal_type=payload.animal_type,
        age_years=payload.age_years,
        severity_indicators=payload.severity_indicators,
    )
    return result


@router.get("/diseases")
async def get_medical_diseases(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    species: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=400),
    current_user=Depends(require_roles(RoleEnum.vet)),
) -> dict[str, Any]:
    rows = disease_dataset(q=q, category=category, species=species, limit=limit)
    return {"count": len(rows), "items": rows}


@router.get("/medications")
async def get_medical_medications(
    q: str | None = Query(default=None),
    species: str | None = Query(default=None),
    prescription_required: bool | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=300),
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict[str, Any]:
    rows = medication_dataset(
        q=q,
        species=species,
        prescription_required=prescription_required,
        limit=limit,
    )
    return {"count": len(rows), "items": rows}


@router.post("/calculators/rer")
async def calculate_rer(
    payload: RERRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict[str, Any]:
    result = rer(payload.weight_kg)
    result["warning"] = "Reference calculation only. Final decision is made by veterinarian."
    return result


@router.post("/calculators/der")
async def calculate_der(
    payload: DERRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict[str, Any]:
    result = der(payload.weight_kg, payload.activity_factor)
    result["warning"] = "Reference calculation only. Final decision is made by veterinarian."
    return result


@router.post("/calculators/fluid-therapy")
async def calculate_fluid_therapy(
    payload: FluidTherapyRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict[str, Any]:
    result = fluid_therapy(
        weight_kg=payload.weight_kg,
        maintenance_ml_per_kg_day=payload.maintenance_ml_per_kg_day,
        duration_hr=payload.duration_hr,
        dehydration_percent=payload.dehydration_percent,
    )
    result["warning"] = "Reference calculation only. Final decision is made by veterinarian."
    return result


@router.post("/calculators/drug-dosage")
async def calculate_drug_dosage(
    payload: DrugDosageRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict[str, Any]:
    result = drug_dosage(
        weight_kg=payload.weight_kg,
        dose_mg_per_kg=payload.dose_mg_per_kg,
        concentration_mg_per_ml=payload.concentration_mg_per_ml,
    )
    result["warning"] = "Calculation aid only. Do not use as autonomous treatment instruction."
    return result


@router.post("/calculators/transfusion")
async def calculate_transfusion(
    payload: TransfusionRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict[str, Any]:
    result = transfusion(weight_kg=payload.weight_kg, species_constant=payload.species_constant)
    result["warning"] = "Reference calculation only. Final decision is made by veterinarian."
    return result


@router.get("/visit-protocols/{visit_id}")
async def get_visit_protocol(
    visit_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    try:
        visit_uuid = uuid.UUID(visit_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid visit id"},
        ) from exc

    visit = await db.scalar(select(Visit).where(Visit.id == visit_uuid))
    if not visit:
        raise HTTPException(status_code=404, detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"})

    await enforce_pet_scope(
        db,
        current_user=current_user,
        pet_id=visit.pet_id,
        clinic_id=visit.clinic_id,
        required_scope=ConsentScope.basic_medical,
    )

    protocol = await _build_visit_protocol(visit, db)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="visit.protocol.view",
        target_type="visit",
        target_id=str(visit.id),
    )
    await db.commit()
    return protocol


@router.get("/visit-protocols/{visit_id}/pdf-structure")
async def get_visit_protocol_pdf_structure(
    visit_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    protocol = await get_visit_protocol(visit_id=visit_id, current_user=current_user, db=db)
    return {
        "format": "pdf-print-layout",
        "title": f"Visit Protocol - {protocol['patient']['name']}",
        "sections": [
            {"key": "patient", "label": "Patient", "value": protocol["patient"]},
            {"key": "owner", "label": "Owner", "value": protocol["owner"]},
            {"key": "complaints", "label": "Complaints", "value": protocol["complaints"]},
            {"key": "physical_exam", "label": "Physical Exam", "value": protocol["physical_exam"]},
            {"key": "diagnostics", "label": "Diagnostics", "value": protocol["diagnostics"]},
            {"key": "assessment", "label": "Assessment", "value": protocol["assessment"]},
            {"key": "plan", "label": "Plan", "value": protocol["plan"]},
            {"key": "prescriptions", "label": "Prescriptions", "value": protocol["prescriptions"]},
            {"key": "follow_up", "label": "Follow Up", "value": protocol["follow_up"]},
        ],
        "disclaimer": protocol["disclaimer"],
    }
