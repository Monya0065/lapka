from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import ConsentScope, Disease, RoleEnum, Symptom, Visit
from src.security.deps import enforce_pet_scope, get_current_user, require_roles
from src.services.audit import log_audit

router = APIRouter(prefix="/clinical", tags=["clinical-tools"])


RED_FLAG_KEYWORDS = {
    "seizures": ["судорог", "seizure", "convulsion"],
    "unconsciousness": ["потеря сознания", "без сознания", "unconscious", "loss of consciousness"],
    "severe_bleeding": ["сильное кровотечение", "обильное кровотечение", "severe bleeding"],
    "breathing_distress": ["затрудн", "дыхательн", "breathing distress", "dyspnea", "respiratory distress"],
    "poison_exposure": ["отравлен", "яд", "poison", "toxic exposure"],
    "trauma": ["травма", "перелом", "head trauma", "severe trauma", "polytrauma"],
}

SPECIES_ALIASES = {
    "cat": "cat",
    "cats": "cat",
    "кот": "cat",
    "кошка": "cat",
    "кошки": "cat",
    "dog": "dog",
    "dogs": "dog",
    "пес": "dog",
    "пёс": "dog",
    "собака": "dog",
    "собаки": "dog",
    "rabbit": "rabbit",
    "кролик": "rabbit",
    "кролики": "rabbit",
    "ferret": "ferret",
    "хорек": "ferret",
    "хорёк": "ferret",
    "хорьки": "ferret",
    "bird": "bird",
    "птица": "bird",
    "птицы": "bird",
}

LAB_LINE_PATTERN = re.compile(
    r"(?P<marker>[A-Za-zА-Яа-яЁё0-9_/(). \-]{2,60})\s*[:=]?\s*(?P<value>[<>]?\s*-?\d+(?:[.,]\d+)?)"
    r"(?:\s*(?P<unit>[A-Za-z%/µμмк0-9]+))?\s*(?P<hint>high|low|h|l|повыш|пониж|выше|ниже|abnormal)?",
    flags=re.IGNORECASE,
)


class DifferentialRequest(BaseModel):
    symptoms: list[str] = Field(default_factory=list, min_length=1)
    species: str = Field(min_length=2, max_length=64)
    age: float | None = Field(default=None, ge=0, le=50)
    sex: str | None = Field(default=None, max_length=16)
    visit_id: str | None = Field(default=None, description="Optional visit ID to persist RED flag annotation")


class VisitCheckRequest(BaseModel):
    visit_id: str | None = Field(default=None)
    complaints: str | None = Field(default=None)
    exam: str | None = Field(default=None)
    assessment: str | None = Field(default=None)
    plan: str | None = Field(default=None)
    symptoms: list[str] = Field(default_factory=list)


class LabMarkerInput(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    value: float
    reference_min: float | None = None
    reference_max: float | None = None
    unit: str | None = Field(default=None, max_length=32)


class LabFlagsRequest(BaseModel):
    lab_text: str = Field(default="", max_length=12000)
    markers: list[LabMarkerInput] = Field(default_factory=list)
    species: str | None = Field(default=None, max_length=64)


@dataclass
class DiseaseCandidate:
    disease_name: str
    category: str
    emergency_flag: bool
    score: float


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _normalize_species(value: str) -> str:
    normalized = _normalize_text(value)
    return SPECIES_ALIASES.get(normalized, normalized)


def _detect_red_flags(symptoms: list[str], extra_text: str = "") -> list[str]:
    blob = _normalize_text(" ".join(symptoms + [extra_text]))
    if not blob:
        return []
    detected: list[str] = []
    for flag_name, keywords in RED_FLAG_KEYWORDS.items():
        if any(keyword in blob for keyword in keywords):
            detected.append(flag_name)
    return detected


def _probability_hint(score: float) -> str:
    if score >= 7:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def _symptom_match_score(input_symptoms: list[str], disease_symptoms: list[str], symptom_name_by_id: dict[str, str]) -> int:
    if not input_symptoms or not disease_symptoms:
        return 0
    score = 0
    normalized_input = [_normalize_text(item) for item in input_symptoms if item.strip()]
    normalized_disease: list[str] = []
    for raw_item in disease_symptoms:
        item = _normalize_text(str(raw_item))
        if not item:
            continue
        normalized_disease.append(item)
        mapped = symptom_name_by_id.get(item)
        if mapped:
            normalized_disease.append(mapped)
    for symptom in normalized_input:
        if any(symptom in disease_item or disease_item in symptom for disease_item in normalized_disease):
            score += 1
    return score


async def _mark_visit_red_if_needed(
    *,
    db: AsyncSession,
    visit_id: str | None,
    current_user,
    red_flags: list[str],
) -> bool:
    if not visit_id or not red_flags:
        return False

    try:
        visit_uuid = uuid.UUID(visit_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid visit_id"},
        ) from exc

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
        required_scope=ConsentScope.basic_medical,
    )

    marker = "RED FLAG AUTO-DETECTED"
    red_text = f"{marker}: {', '.join(sorted(set(red_flags)))}"
    current_assessment = (visit.assessment_note or "").strip()
    if marker not in current_assessment:
        visit.assessment_note = f"{red_text}\n{current_assessment}".strip()

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit.clinic_id),
        action="clinical.red_flag.detected",
        target_type="visit",
        target_id=str(visit.id),
        metadata={"red_flags": sorted(set(red_flags))},
    )
    return True


@router.post("/differential")
async def clinical_differential(
    payload: DifferentialRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict[str, Any]]:
    symptoms = [item.strip() for item in payload.symptoms if item and item.strip()]
    if not symptoms:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "At least one symptom is required"},
        )

    species_filter = _normalize_species(payload.species)
    query = select(Disease)
    if species_filter not in {"all", ""}:
        query = query.where(Disease.species.ilike(f"%{species_filter}%"))
    rows = (await db.scalars(query)).all()
    symptom_rows = (await db.scalars(select(Symptom))).all()
    symptom_name_by_id = {_normalize_text(row.id): _normalize_text(row.name) for row in symptom_rows}

    red_flags = _detect_red_flags(symptoms)
    candidates: list[DiseaseCandidate] = []

    for row in rows:
        match_score = _symptom_match_score(symptoms, row.symptoms_json or [], symptom_name_by_id)
        if match_score == 0:
            continue
        score = float(match_score * 2)
        if str(row.emergency_level).upper() == "RED":
            score += 1.0
        if payload.age is not None:
            if payload.age < 1 and row.category in {"infectious", "gastroenterology", "respiratory"}:
                score += 0.5
            if payload.age >= 8 and row.category in {"cardiology", "endocrine", "urinary", "neurology"}:
                score += 0.5
        if payload.sex and payload.sex.lower() in {"female", "f"} and row.category == "endocrine":
            score += 0.2

        emergency = bool(red_flags) or str(row.emergency_level).upper() == "RED"
        candidates.append(
            DiseaseCandidate(
                disease_name=row.name,
                category=row.category,
                emergency_flag=emergency,
                score=score,
            )
        )

    if not candidates and rows:
        fallback = sorted(
            rows,
            key=lambda item: (
                0 if str(item.emergency_level).upper() == "RED" else 1,
                0 if "infectious" in str(item.category).lower() else 1,
                item.name.lower(),
            ),
        )[:8]
        candidates.extend(
            DiseaseCandidate(
                disease_name=item.name,
                category=item.category,
                emergency_flag=bool(red_flags) or str(item.emergency_level).upper() == "RED",
                score=2.0,
            )
            for item in fallback
        )

    candidates.sort(key=lambda item: (-item.score, item.disease_name.lower()))
    top = candidates[:12]

    await _mark_visit_red_if_needed(
        db=db,
        visit_id=payload.visit_id,
        current_user=current_user,
        red_flags=red_flags,
    )

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="clinical.differential.run",
        target_type="clinical_tool",
        target_id=payload.visit_id,
        metadata={"symptoms": symptoms[:20], "species": payload.species, "red_flags_detected": red_flags},
    )
    await db.commit()

    return [
        {
            "disease_name": row.disease_name,
            "probability_hint": _probability_hint(row.score),
            "category": row.category,
            "emergency_flag": row.emergency_flag,
        }
        for row in top
    ]


@router.post("/visit-check")
async def clinical_visit_check(
    payload: VisitCheckRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    complaints = (payload.complaints or "").strip()
    exam = (payload.exam or "").strip()
    assessment = (payload.assessment or "").strip()
    plan = (payload.plan or "").strip()

    if payload.visit_id:
        try:
            visit_uuid = uuid.UUID(payload.visit_id)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "BAD_REQUEST", "message": "Invalid visit_id"},
            ) from exc

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
            required_scope=ConsentScope.basic_medical,
        )
        complaints = complaints or (visit.complaints or visit.chief_complaint or "").strip()
        exam = exam or (visit.physical_exam or visit.exam_findings or "").strip()
        assessment = assessment or (visit.assessment_note or "").strip()
        plan = plan or (visit.plan_note or "").strip()

    checklist = {
        "complaints": bool(complaints),
        "exam": bool(exam),
        "assessment": bool(assessment),
        "plan": bool(plan),
    }
    missing_sections = [section for section, ready in checklist.items() if not ready]
    warnings = [f"Missing required section: {section}" for section in missing_sections]

    red_flags = _detect_red_flags(payload.symptoms, extra_text=" ".join([complaints, exam, assessment, plan]))
    visit_flagged = await _mark_visit_red_if_needed(
        db=db,
        visit_id=payload.visit_id,
        current_user=current_user,
        red_flags=red_flags,
    )
    if red_flags:
        warnings.append("Emergency indicators detected. Visit flagged as RED.")

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="clinical.visit_check.run",
        target_type="visit",
        target_id=payload.visit_id,
        metadata={
            "missing_sections": missing_sections,
            "red_flags_detected": red_flags,
            "visit_flagged": visit_flagged,
        },
    )
    await db.commit()

    return {
        "status": "ok" if not warnings else "warning",
        "missing_sections": missing_sections,
        "warnings": warnings,
        "red_flags_detected": red_flags,
        "visit_flag": "RED" if red_flags else "NORMAL",
        "checklist": checklist,
    }


@router.post("/lab-flags")
async def clinical_lab_flags(
    payload: LabFlagsRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    flagged: list[dict[str, Any]] = []

    for marker in payload.markers:
        flag = None
        if marker.reference_min is not None and marker.value < marker.reference_min:
            flag = "LOW"
        if marker.reference_max is not None and marker.value > marker.reference_max:
            flag = "HIGH"
        if flag:
            flagged.append(
                {
                    "marker": marker.name,
                    "value": marker.value,
                    "reference_range": f"{marker.reference_min} - {marker.reference_max}",
                    "unit": marker.unit,
                    "flag": flag,
                    "note": "Discuss with veterinarian in clinical context.",
                }
            )

    lines = [line.strip() for line in (payload.lab_text or "").splitlines() if line.strip()]
    abnormal_terms = ("high", "low", "abnormal", "повыш", "пониж", "выше", "ниже", "вне диапазона")
    for line in lines:
        match = LAB_LINE_PATTERN.search(line)
        if not match:
            continue
        hint = (match.group("hint") or "").lower()
        value_raw = (match.group("value") or "").replace(" ", "")
        marker_name = (match.group("marker") or "").strip(" :")
        if not marker_name:
            continue
        if any(term in line.lower() for term in abnormal_terms) or value_raw.startswith((">", "<")) or hint:
            flag = "HIGH" if value_raw.startswith(">") or "high" in hint or "повыш" in hint or "выше" in hint else "LOW"
            flagged.append(
                {
                    "marker": marker_name,
                    "value": value_raw,
                    "reference_range": None,
                    "unit": match.group("unit"),
                    "flag": flag,
                    "note": "Potential out-of-range marker extracted from text.",
                }
            )

    deduplicated: dict[str, dict[str, Any]] = {}
    for row in flagged:
        key = f"{row.get('marker')}|{row.get('flag')}|{row.get('value')}"
        deduplicated[key] = row
    flagged_rows = list(deduplicated.values())

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="clinical.lab_flags.run",
        target_type="clinical_tool",
        target_id=None,
        metadata={"species": payload.species, "flags_count": len(flagged_rows)},
    )
    await db.commit()

    return {
        "count": len(flagged_rows),
        "markers_outside_normal_range": flagged_rows,
        "disclaimer": "Decision support only. Final clinical judgment belongs to veterinarian.",
    }
