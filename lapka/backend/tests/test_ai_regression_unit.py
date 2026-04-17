"""AI regression tests: safety, fallback, control-plane contracts."""

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch

from io import BytesIO

from starlette.datastructures import UploadFile

from src.ai_assistant.lab_explainer import explain_lab_text
from src.ai_assistant.transcription import transcribe_audio_file
from src.ai_assistant.visit_structuring import structure_visit_from_transcript
from src.models import RoleEnum
from src.services.ai_runtime import AIRuntimeExecution, DEFAULT_ROUTE_CONFIGS, execute_governed_ai, prepare_ai_execution
from src.services.ai_safe import has_policy_violation, triage


def test_owner_safety_policy_detects_disallowed_treatment_prompts():
    assert has_policy_violation("какую дозу дать от боли")
    assert has_policy_violation("what dose should i give")
    assert not has_policy_violation("pet has low appetite since morning")


def test_owner_ai_triage_policy_uses_combined_text_like_medical_engine():
    """Severity free-text must be included in owner policy check (matches /ai/triage + medical triage)."""
    symptom_text = "pet seems ok"
    severity = ["how much mg should i give"]
    names: list[str] = []
    combined = " ".join([symptom_text, *severity, *names]).strip()
    assert has_policy_violation(combined)


def test_lab_explain_fallback_when_provider_unavailable_has_contract_keys():
    with patch("src.ai_assistant.lab_explainer.get_provider") as mock_get_provider:
        mock_get_provider.return_value.is_available.return_value = False
        out = explain_lab_text("ALT 120 U/L, CREA 1.9 mg/dL", "canine")
    for key in ("summary", "possible_meaning", "questions_for_vet", "source_excerpt", "disclaimer"):
        assert key in out
    assert isinstance(out["questions_for_vet"], list)


@pytest.mark.asyncio
async def test_transcribe_audio_file_demo_path_returns_contract_shape():
    raw = b"\x00" * 8000
    upload = UploadFile(filename="demo.wav", file=BytesIO(raw))
    result = await transcribe_audio_file(upload)
    assert result.transcript
    assert result.duration_sec >= 1.0


def test_visit_structuring_fallback_when_provider_unavailable():
    with patch("src.ai_assistant.visit_structuring.get_provider") as mock_get_provider:
        provider = mock_get_provider.return_value
        provider.is_available.return_value = False

        out = structure_visit_from_transcript(
            transcript_text="Кошка стала вялой и отказывается от еды.",
            patient_id="pet-1",
        )

    assert out["patient_id"] == "pet-1"
    assert out["complaints"]
    assert out["plan"]
    assert "доз" not in out["plan"].lower()


def test_visit_structuring_fallback_when_provider_returns_invalid_json():
    with patch("src.ai_assistant.visit_structuring.get_provider") as mock_get_provider:
        provider = mock_get_provider.return_value
        provider.is_available.return_value = True
        provider.complete.return_value = "not-json"

        out = structure_visit_from_transcript(
            transcript_text="Owner says cough and lethargy for two days.",
            patient_id="pet-2",
        )

    assert out["patient_id"] == "pet-2"
    assert out["complaints"]
    assert out["follow_up"]


def test_control_plane_default_routes_include_safety_critical_slugs():
    routes = DEFAULT_ROUTE_CONFIGS
    for slug in ("owner-triage", "doc-explain", "visit-structure", "audio-transcribe", "lab-explain"):
        assert slug in routes
        assert routes[slug]["primary_provider_slug"]


@pytest.mark.asyncio
async def test_prepare_ai_execution_reads_airoute_provider_from_db():
    """Control-plane persisted AIRoute rows must override DEFAULT_ROUTE_CONFIGS for runtime."""
    route_row = SimpleNamespace(
        slug="owner-triage",
        enabled=True,
        primary_provider_slug="custom-primary",
        primary_model_key="custom-model",
        fallback_provider_slug="custom-fallback",
        fallback_model_key="custom-fallback-model",
        policy_slug="owner-safe-mode",
        scenario_name="Срочность владельца",
        role_scope="owner",
    )
    limit_row = SimpleNamespace(
        max_owner_requests_per_hour=100,
        max_vet_requests_per_hour=100,
        pii_redaction=True,
        prompt_audit=True,
        fallback_mode="strict",
    )
    seq = [route_row, None, limit_row, 0, None, None]

    async def fake_scalar(*_a, **_kw):
        return seq.pop(0)

    session = SimpleNamespace(scalar=fake_scalar)
    user = SimpleNamespace(id=uuid.uuid4(), role=RoleEnum.owner)
    execution = await prepare_ai_execution(session, current_user=user, route_slug="owner-triage", payload_size=100)
    assert execution.provider_slug == "custom-primary"
    assert execution.model_key == "custom-model"
    assert execution.fallback_provider_slug == "custom-fallback"
    assert execution.fallback_model_key == "custom-fallback-model"


@pytest.mark.asyncio
async def test_prepare_ai_execution_reads_ailimit_guardrails_from_db():
    """Platform AILimit row (written by control plane) must shape runtime execution flags."""
    limit_row = SimpleNamespace(
        max_owner_requests_per_hour=500,
        max_vet_requests_per_hour=500,
        pii_redaction=False,
        prompt_audit=False,
        fallback_mode="lenient",
    )
    seq = [None, None, limit_row, 0, None, None]

    async def fake_scalar(*_a, **_kw):
        return seq.pop(0)

    session = SimpleNamespace(scalar=fake_scalar)
    user = SimpleNamespace(id=uuid.uuid4(), role=RoleEnum.owner)
    execution = await prepare_ai_execution(session, current_user=user, route_slug="owner-triage")
    assert execution.pii_redaction is False
    assert execution.prompt_audit is False
    assert execution.fallback_mode == "lenient"


@pytest.mark.asyncio
async def test_prepare_ai_execution_enforces_hourly_limit_from_db():
    limit_row = SimpleNamespace(
        max_owner_requests_per_hour=3,
        max_vet_requests_per_hour=900,
        pii_redaction=True,
        prompt_audit=True,
        fallback_mode="strict",
    )
    seq = [None, None, limit_row, 3, None, None]

    async def fake_scalar(*_a, **_kw):
        return seq.pop(0)

    session = SimpleNamespace(scalar=fake_scalar)
    user = SimpleNamespace(id=uuid.uuid4(), role=RoleEnum.owner)
    with pytest.raises(HTTPException) as exc:
        await prepare_ai_execution(session, current_user=user, route_slug="owner-triage")
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "AI_RATE_LIMIT"


def test_ai_triage_returns_red_on_red_flag_text():
    out = triage("severe bleeding and trouble breathing", [], [])
    assert out["level"] == "RED"
    assert out["red_flags_detected"]


@pytest.mark.asyncio
async def test_execute_governed_ai_wraps_runtime_failure_with_contract_error():
    execution = AIRuntimeExecution(
        route_slug="owner-triage",
        scenario_name="test",
        clinic_id=None,
        provider_slug="openai",
        model_key="gpt-5-mini",
        fallback_provider_slug="noop",
        fallback_model_key="noop",
        policy_slug="owner-safe-mode",
        prompt_title=None,
        prompt_version=None,
        role_scope="owner",
        pii_redaction=True,
        prompt_audit=True,
        fallback_mode="strict",
        estimated_cost=0.01,
        metadata={},
    )
    current_user = type("UserStub", (), {"id": "u1", "role": type("RoleStub", (), {"value": "owner"})()})()

    with patch("src.services.ai_runtime.prepare_ai_execution", new=AsyncMock(return_value=execution)), patch(
        "src.services.ai_runtime.record_ai_usage", new=AsyncMock()
    ):
        with pytest.raises(HTTPException) as exc:
            await execute_governed_ai(
                session=AsyncMock(),
                current_user=current_user,
                route_slug="owner-triage",
                runner=lambda _exec: (_ for _ in ()).throw(RuntimeError("boom")),
                failure_message="AI route unavailable",
            )

    assert exc.value.status_code == 503
    assert exc.value.detail["code"] == "AI_RUNTIME_FAILED"


@pytest.mark.asyncio
async def test_execute_governed_ai_keeps_http_errors_unchanged():
    execution = AIRuntimeExecution(
        route_slug="owner-triage",
        scenario_name="test",
        clinic_id=None,
        provider_slug="openai",
        model_key="gpt-5-mini",
        fallback_provider_slug="noop",
        fallback_model_key="noop",
        policy_slug="owner-safe-mode",
        prompt_title=None,
        prompt_version=None,
        role_scope="owner",
        pii_redaction=True,
        prompt_audit=True,
        fallback_mode="strict",
        estimated_cost=0.01,
        metadata={},
    )
    current_user = type("UserStub", (), {"id": "u1", "role": type("RoleStub", (), {"value": "owner"})()})()

    with patch("src.services.ai_runtime.prepare_ai_execution", new=AsyncMock(return_value=execution)), patch(
        "src.services.ai_runtime.record_ai_usage", new=AsyncMock()
    ):
        with pytest.raises(HTTPException) as exc:
            await execute_governed_ai(
                session=AsyncMock(),
                current_user=current_user,
                route_slug="owner-triage",
                runner=lambda _exec: (_ for _ in ()).throw(
                    HTTPException(status_code=422, detail={"code": "POLICY_VIOLATION"})
                ),
            )

    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "POLICY_VIOLATION"
