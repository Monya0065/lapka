from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai_assistant import apply_safety_guard, explain_lab_text, structure_visit_from_transcript, transcribe_audio_file
from src.core.sanitize import sanitize_text
from src.db.session import get_db_session
from src.models import MasterPet, RoleEnum
from src.security.deps import get_current_user, require_roles
from src.services.audit import log_audit
from src.services.ai_runtime import execute_governed_ai

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


class VisitStructureRequest(BaseModel):
    transcript_text: str = Field(min_length=3)
    patient_id: str = Field(min_length=3)


class LabExplainRequest(BaseModel):
    lab_text: str = Field(min_length=3)
    species: str = Field(min_length=2, max_length=64)


@router.post("/transcribe")
async def transcribe_visit_audio(
    audio_file: UploadFile = File(...),
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="audio-transcribe",
        payload_size=int(audio_file.size or 0),
        metadata={"mode": "transcribe", "filename": audio_file.filename},
        runner=lambda _execution: transcribe_audio_file(audio_file),
        success_metadata={"mode": "transcribe"},
        failure_message="Транскрибация временно недоступна.",
    )
    result = governed.result
    payload = {"transcript": result.transcript, "duration_sec": result.duration_sec}
    safe_payload = apply_safety_guard(payload, role=current_user.role.value, vet_context=True, mode="transcription")
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_assistant",
        target_id=None,
        metadata={"action_type": "transcribe", "route_slug": governed.execution.route_slug},
    )
    await db.commit()
    return safe_payload


@router.post("/visit-structure")
async def create_visit_structure(
    payload: VisitStructureRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    try:
        pet_uuid = uuid.UUID(payload.patient_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": "Invalid patient_id format"},
        ) from exc

    pet = await db.scalar(select(MasterPet).where(MasterPet.id == pet_uuid))
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PATIENT_NOT_FOUND", "message": "Patient not found"},
        )

    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="visit-structure",
        payload_size=len(payload.transcript_text),
        metadata={"mode": "visit-structure", "patient_id": str(pet_uuid)},
        runner=lambda _execution: structure_visit_from_transcript(
            sanitize_text(payload.transcript_text, max_len=12000),
            str(pet_uuid),
        ),
        success_metadata={"mode": "visit-structure", "patient_id": str(pet_uuid)},
        failure_message="Структурирование визита временно недоступно.",
    )
    structured = governed.result
    safe_payload = apply_safety_guard(structured, role=current_user.role.value, vet_context=True, mode="visit_structuring")
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_assistant",
        target_id=str(pet_uuid),
        metadata={"action_type": "visit_structure", "route_slug": governed.execution.route_slug},
    )
    await db.commit()
    return safe_payload


@router.post("/lab-explain")
async def explain_lab_for_vet(
    payload: LabExplainRequest,
    current_user=Depends(require_roles(RoleEnum.vet)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="lab-explain",
        payload_size=len(payload.lab_text) + len(payload.species),
        metadata={"mode": "lab-explain", "species": payload.species},
        runner=lambda _execution: explain_lab_text(
            sanitize_text(payload.lab_text, max_len=12000),
            sanitize_text(payload.species, max_len=64),
        ),
        success_metadata={"mode": "lab-explain", "species": payload.species},
        failure_message="Объяснение лабораторного текста временно недоступно.",
    )
    explained = governed.result
    safe_payload = apply_safety_guard(explained, role=current_user.role.value, vet_context=True, mode="lab_explainer")
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_assistant",
        target_id=None,
        metadata={"action_type": "lab_explain", "species": payload.species, "route_slug": governed.execution.route_slug},
    )
    await db.commit()
    return safe_payload
