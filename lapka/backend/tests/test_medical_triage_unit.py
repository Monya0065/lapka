"""Fast unit tests for owner-safe triage (no HTTP, no DB)."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from src.api.routes.medical_engine import MedicalTriageRequest, run_medical_triage
from src.models import RoleEnum
from src.services.ai_safe import triage
from src.services.catalog import get_symptoms
from src.services.medical_engine import run_triage


def test_triage_green_when_no_signals():
    out = triage("", [], [])
    assert out["level"] == "GREEN"
    assert out["red_flags_detected"] == []
    assert isinstance(out.get("what_to_prepare_for_visit"), list)
    assert out["what_to_prepare_for_visit"]


def test_triage_yellow_on_vomit_context():
    out = triage("Кошка не ест, рвота с утра", [], None)
    assert out["level"] == "YELLOW"
    assert out.get("what_to_prepare_for_visit")


def test_run_triage_yellow_when_catalog_ids_missing_but_text_matches():
    out = run_triage(
        symptom_text="жидкий стул и вялость",
        symptom_ids=["not-a-catalog-id"],
        symptom_names=[],
        duration_hours=None,
        animal_type=None,
        age_years=None,
        severity_indicators=[],
    )
    assert out["level"] == "YELLOW"


def test_run_triage_red_when_catalog_emergency_symptom_selected():
    catalog = get_symptoms()
    red = next((s for s in catalog if s.get("red_flag")), None)
    if red is None:
        pytest.skip("catalog has no red-flag symptom")
    sid = str(red["id"])
    out = run_triage(
        symptom_text="",
        symptom_ids=[sid],
        symptom_names=[],
        duration_hours=None,
        animal_type=None,
        age_years=None,
        severity_indicators=[],
    )
    assert out["level"] == "RED"
    assert out["red_flags_detected"]
    assert out.get("what_to_prepare_for_visit")


@pytest.mark.asyncio
async def test_run_medical_triage_red_when_db_symptom_emergency_flag():
    mock_row = MagicMock()
    mock_row.id = "db-symptom-1"
    mock_row.name = "Судороги (тест)"
    mock_row.emergency_flag = True

    scalars_result = MagicMock()
    scalars_result.all = MagicMock(return_value=[mock_row])

    mock_db = AsyncMock()
    mock_db.scalars = AsyncMock(return_value=scalars_result)

    mock_user = MagicMock()
    mock_user.role = RoleEnum.owner

    payload = MedicalTriageRequest(symptom_text="слабость", symptom_ids=["db-symptom-1"], symptom_names=[])

    out = await run_medical_triage(payload, current_user=mock_user, db=mock_db)

    assert out["level"] == "RED"
    assert mock_row.name in out["red_flags_detected"]
    assert out.get("what_to_prepare_for_visit")
    assert any(m["id"] == mock_row.id for m in out["matched_symptoms"])
    mock_db.scalars.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_medical_triage_blocks_owner_on_policy_violation():
    mock_db = AsyncMock()
    mock_user = MagicMock()
    mock_user.role = RoleEnum.owner

    payload = MedicalTriageRequest(
        symptom_text="какую дозу дать от рвоты",
        symptom_ids=[],
        symptom_names=[],
    )

    with pytest.raises(HTTPException) as exc:
        await run_medical_triage(payload, current_user=mock_user, db=mock_db)

    assert exc.value.status_code == 422
    mock_db.scalars.assert_not_called()
