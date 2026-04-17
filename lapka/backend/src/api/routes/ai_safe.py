from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_list, sanitize_text
from src.models import RoleEnum
from src.db.session import get_db_session
from src.security.deps import get_current_user, require_roles
from src.services.ai_safe import (
    explain_document,
    has_policy_violation,
    protocol_completeness,
    structure_notes,
    summarize_visit,
    triage,
)
from src.services.ai_runtime import execute_governed_ai, prepare_ai_execution, record_ai_usage
from src.services.audit import log_audit
from src.services.catalog import get_symptoms

router = APIRouter(prefix="/ai", tags=["ai-safe"])


@router.get("/provider-status")
async def ai_provider_status(
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
) -> dict:
    """Return active LLM provider (for vet/admin). No sensitive data."""
    try:
        from src.ai import get_provider

        p = get_provider()
        return {"provider": type(p).__name__, "available": p.is_available()}
    except Exception:
        return {"provider": "unknown", "available": False}


class TriageRequest(BaseModel):
    symptom_text: str = ""
    selected_symptoms_ids: list[str] = Field(default_factory=list)
    duration_hours: float | None = Field(default=None, ge=0, le=24 * 60)
    animal_type: str | None = None
    age_years: float | None = Field(default=None, ge=0, le=50)
    severity_indicators: list[str] = Field(default_factory=list)


class ExplainRequest(BaseModel):
    doc_type: str
    notes: str | None = None


class StructureRequest(BaseModel):
    text: str


class CompletenessRequest(BaseModel):
    visit: dict


class VisitSummaryRequest(BaseModel):
    visit: dict


@router.post("/triage")
async def ai_triage(
    payload: TriageRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    symptom_text = sanitize_text(payload.symptom_text, max_len=1500)
    selected_ids = sanitize_list(payload.selected_symptoms_ids, max_items=40, max_len=128)
    severity = sanitize_list(payload.severity_indicators, max_items=20, max_len=128)
    payload_size = len(symptom_text) + sum(len(item) for item in selected_ids) + sum(len(item) for item in severity)

    symptom_map = {s.get("id"): s.get("name", "") for s in get_symptoms()}
    selected_names = [symptom_map.get(i, "") for i in selected_ids]
    combined_owner_text = " ".join([symptom_text, *severity, *selected_names]).strip()

    if current_user.role == RoleEnum.owner and has_policy_violation(combined_owner_text):
        execution = await prepare_ai_execution(
            db,
            current_user=current_user,
            route_slug="owner-triage",
            payload_size=payload_size,
            metadata={"animal_type": payload.animal_type, "age_years": payload.age_years},
        )
        await record_ai_usage(
            db,
            current_user=current_user,
            execution=execution,
            status_label="policy_violation",
            latency_ms=0,
            metadata={"blocked": True},
        )
        await log_audit(
            db,
            actor_user_id=str(current_user.id),
            clinic_id=execution.clinic_id,
            action="ai.request.blocked",
            target_type="ai_safe",
            target_id="owner-triage",
            metadata={"route_slug": execution.route_slug},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "POLICY_VIOLATION",
                "message": "I can't prescribe treatment. Contact a veterinarian.",
            },
        )

    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="owner-triage",
        payload_size=payload_size,
        metadata={"animal_type": payload.animal_type, "age_years": payload.age_years},
        runner=lambda _execution: triage(
            symptom_text,
            selected_ids,
            selected_names,
            duration_hours=payload.duration_hours,
            animal_type=payload.animal_type,
            age_years=payload.age_years,
            severity_indicators=severity,
        ),
        success_metadata={"level": None, "selected_symptom_count": len(selected_ids)},
    )
    result = governed.result
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_safe",
        target_id="owner-triage",
        metadata={"route_slug": governed.execution.route_slug, "level": result.get("level")},
    )
    await db.commit()
    return result


@router.post("/explain-doc")
async def ai_explain_doc(
    payload: ExplainRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    safe_type = sanitize_text(payload.doc_type, max_len=120)
    safe_notes = sanitize_text(payload.notes, max_len=4000)
    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="doc-explain",
        payload_size=len(safe_type) + len(safe_notes or ""),
        metadata={"doc_type": safe_type},
        runner=lambda _execution: explain_document(safe_type, safe_notes),
        success_metadata={"doc_type": safe_type},
    )
    result = governed.result
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_safe",
        target_id="doc-explain",
        metadata={"route_slug": governed.execution.route_slug, "doc_type": safe_type},
    )
    await db.commit()
    return result


@router.post("/structure-notes")
async def ai_structure_notes(
    payload: StructureRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    safe_text = sanitize_text(payload.text, max_len=6000)
    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="note-structure",
        payload_size=len(safe_text),
        metadata={"mode": "structure-notes"},
        runner=lambda _execution: structure_notes(safe_text),
        success_metadata={"mode": "structure-notes"},
    )
    result = governed.result
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_safe",
        target_id="note-structure",
        metadata={"route_slug": governed.execution.route_slug, "mode": "structure-notes"},
    )
    await db.commit()
    return result


@router.post("/protocol-completeness")
async def ai_protocol_completeness(
    payload: CompletenessRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="protocol-completeness",
        payload_size=len(str(payload.visit)),
        metadata={"mode": "protocol-completeness"},
        runner=lambda _execution: protocol_completeness(payload.visit),
        success_metadata={"mode": "protocol-completeness"},
    )
    result = governed.result
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_safe",
        target_id="protocol-completeness",
        metadata={"route_slug": governed.execution.route_slug, "mode": "protocol-completeness"},
    )
    await db.commit()
    return result


@router.post("/visit-summary")
async def ai_visit_summary(
    payload: VisitSummaryRequest,
    current_user=Depends(require_roles(RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    safe_visit = payload.visit or {}
    governed = await execute_governed_ai(
        db,
        current_user=current_user,
        route_slug="visit-summary",
        payload_size=len(str(safe_visit)),
        metadata={"mode": "visit-summary"},
        runner=lambda _execution: summarize_visit(safe_visit),
        success_metadata={"mode": "visit-summary"},
    )
    result = governed.result
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=governed.execution.clinic_id,
        action="ai.request",
        target_type="ai_safe",
        target_id="visit-summary",
        metadata={"route_slug": governed.execution.route_slug, "mode": "visit-summary"},
    )
    await db.commit()
    return result
