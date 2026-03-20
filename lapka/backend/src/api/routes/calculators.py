from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import RoleEnum
from src.security.deps import get_current_user
from src.services.audit import log_audit

router = APIRouter(prefix="/calculators", tags=["calculators"])

_VET_ONLY = [RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin]
_ALL_ROLES = [RoleEnum.owner, RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin]


class RunCalculatorPayload(BaseModel):
    calculator_id: str = Field(min_length=2, max_length=64)
    inputs: dict[str, Any] = Field(default_factory=dict)


def _calc_catalog() -> list[dict[str, Any]]:
    return [
        {
            "id": "drug_dosage",
            "name": "Drug dosage",
            "category": "Clinical dosage",
            "description": "total_mg = weight × dose, volume_ml = total_mg / concentration.",
            "allowed_roles": [r.value for r in _VET_ONLY],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "dose_mg_per_kg", "label": "Доза (мг/кг)", "min": 0.01, "max": 500, "step": 0.01, "default": 10},
                {"key": "concentration_mg_per_ml", "label": "Концентрация (мг/мл)", "min": 0.01, "max": 10000, "step": 0.01, "default": 50},
            ],
        },
        {
            "id": "fluid_therapy",
            "name": "Fluid therapy",
            "category": "Infusion",
            "description": "Maintenance + dehydration deficit + infusion rate.",
            "allowed_roles": [r.value for r in _VET_ONLY],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "maintenance_ml_per_kg_day", "label": "Maintenance (мл/кг/день)", "min": 1, "max": 500, "step": 1, "default": 50},
                {"key": "dehydration_percent", "label": "Дегидратация (%)", "min": 0, "max": 20, "step": 0.1, "default": 5},
                {"key": "duration_hr", "label": "Длительность (ч)", "min": 1, "max": 240, "step": 1, "default": 24},
            ],
        },
        {
            "id": "rer",
            "name": "RER",
            "category": "Nutrition",
            "description": "Resting Energy Requirement.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
            ],
        },
        {
            "id": "mer",
            "name": "MER",
            "category": "Nutrition",
            "description": "Maintenance Energy Requirement (MER = RER × factor).",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "activity_factor", "label": "Фактор активности", "min": 0.3, "max": 6, "step": 0.1, "default": 1.4},
            ],
        },
        {
            "id": "anesthesia_dose",
            "name": "Anesthesia drug dose",
            "category": "Clinical dosage",
            "description": "Диапазон дозы по min/max мг/кг и концентрации.",
            "allowed_roles": [r.value for r in _VET_ONLY],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "dose_min_mg_per_kg", "label": "Dose min (мг/кг)", "min": 0.01, "max": 500, "step": 0.01, "default": 2},
                {"key": "dose_max_mg_per_kg", "label": "Dose max (мг/кг)", "min": 0.01, "max": 500, "step": 0.01, "default": 4},
                {"key": "concentration_mg_per_ml", "label": "Концентрация (мг/мл)", "min": 0.01, "max": 10000, "step": 0.01, "default": 10},
            ],
        },
        {
            "id": "body_surface_area",
            "name": "Body surface area",
            "category": "Body metrics",
            "description": "BSA = 10.1 × weight^(2/3) / 100.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
            ],
        },
        {
            "id": "dehydration_deficit",
            "name": "Dehydration deficit",
            "category": "Infusion",
            "description": "deficit_ml = weight × dehydration_percent × 10.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "dehydration_percent", "label": "Дегидратация (%)", "min": 0, "max": 20, "step": 0.1, "default": 5},
            ],
        },
        {
            "id": "blood_transfusion",
            "name": "Blood transfusion volume",
            "category": "Clinical dosage",
            "description": "Оценка объёма гемотрансфузии по PCV.",
            "allowed_roles": [r.value for r in _VET_ONLY],
            "inputs": [
                {"key": "species", "label": "Вид", "options": ["dog", "cat", "other"], "default": "dog"},
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "patient_pcv", "label": "PCV пациента (%)", "min": 1, "max": 80, "step": 0.1, "default": 15},
                {"key": "desired_pcv", "label": "Желаемый PCV (%)", "min": 1, "max": 80, "step": 0.1, "default": 25},
                {"key": "donor_pcv", "label": "PCV донора (%)", "min": 1, "max": 80, "step": 0.1, "default": 45},
            ],
        },
        {
            "id": "heart_rate_range",
            "name": "Heart rate range",
            "category": "Reference ranges",
            "description": "Справочный диапазон ЧСС по виду и возрастной группе.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "species", "label": "Вид", "options": ["dog", "cat"], "default": "dog"},
                {"key": "life_stage", "label": "Возрастная группа", "options": ["young", "adult", "senior"], "default": "adult"},
            ],
        },
        {
            "id": "respiratory_rate_range",
            "name": "Respiratory rate range",
            "category": "Reference ranges",
            "description": "Справочный диапазон ЧДД по виду и возрастной группе.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "species", "label": "Вид", "options": ["dog", "cat"], "default": "dog"},
                {"key": "life_stage", "label": "Возрастная группа", "options": ["young", "adult", "senior"], "default": "adult"},
            ],
        },
        {
            "id": "age_conversion",
            "name": "Pet → Human age",
            "category": "Body metrics",
            "description": "Оценка возраста питомца в условных «человеческих» годах.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "species", "label": "Вид", "options": ["dog", "cat", "other"], "default": "dog"},
                {"key": "pet_age_years", "label": "Возраст питомца (лет)", "min": 0, "max": 35, "step": 0.1, "default": 4},
            ],
        },
        {
            "id": "condition_index",
            "name": "BMI-like condition index",
            "category": "Body metrics",
            "description": "Условный индекс состояния тела по весу и длине тела.",
            "allowed_roles": [r.value for r in _ALL_ROLES],
            "inputs": [
                {"key": "weight_kg", "label": "Вес (кг)", "min": 0.1, "max": 250, "step": 0.1, "default": 5.2},
                {"key": "body_length_cm", "label": "Длина тела (см)", "min": 10, "max": 200, "step": 0.1, "default": 45},
            ],
        },
    ]


def _parse_float(inputs: dict[str, Any], key: str, *, min_value: float | None = None, max_value: float | None = None) -> float:
    if key not in inputs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": f"Missing input: {key}"},
        )
    try:
        value = float(inputs[key])
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": f"Invalid numeric input: {key}"},
        ) from exc
    if min_value is not None and value < min_value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": f"{key} must be >= {min_value}"},
        )
    if max_value is not None and value > max_value:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": f"{key} must be <= {max_value}"},
        )
    return value


def _run_calculation(calc_id: str, inputs: dict[str, Any]) -> tuple[dict[str, Any], str, str]:
    if calc_id == "drug_dosage":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        dose_mg_per_kg = _parse_float(inputs, "dose_mg_per_kg", min_value=0.01)
        concentration_mg_per_ml = _parse_float(inputs, "concentration_mg_per_ml", min_value=0.01)
        total_mg = weight_kg * dose_mg_per_kg
        volume_ml = total_mg / concentration_mg_per_ml
        return (
            {
                "weight_kg": weight_kg,
                "total_mg": total_mg,
                "volume_ml": volume_ml,
            },
            "Расчёт выполнен по формуле total_mg = weight × dose и volume_ml = total_mg / concentration.",
            "Справочный расчёт. Решение о назначении и схеме принимает ветеринарный врач.",
        )

    if calc_id == "fluid_therapy":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        maintenance = _parse_float(inputs, "maintenance_ml_per_kg_day", min_value=1)
        dehydration_percent = _parse_float(inputs, "dehydration_percent", min_value=0, max_value=20)
        duration_hr = _parse_float(inputs, "duration_hr", min_value=1)
        maintenance_ml = weight_kg * maintenance * (duration_hr / 24)
        deficit_ml = weight_kg * dehydration_percent * 10
        total_ml = maintenance_ml + deficit_ml
        rate_ml_per_hr = total_ml / duration_hr
        return (
            {
                "maintenance_ml": maintenance_ml,
                "dehydration_deficit_ml": deficit_ml,
                "total_fluid_ml": total_ml,
                "rate_ml_per_hr": rate_ml_per_hr,
            },
            "Maintenance и deficit рассчитаны отдельно, затем суммированы в общий объём инфузии.",
            "Справочный расчёт. Подтверждение инфузионной тактики остаётся за врачом.",
        )

    if calc_id == "rer":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        rer_value = 70 * (weight_kg**0.75)
        return (
            {"weight_kg": weight_kg, "rer_kcal_day": rer_value},
            "RER = 70 × (weight_kg ^ 0.75).",
            "Справочный расчёт пищевой потребности.",
        )

    if calc_id == "mer":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        activity_factor = _parse_float(inputs, "activity_factor", min_value=0.3, max_value=6)
        rer_value = 70 * (weight_kg**0.75)
        mer_value = rer_value * activity_factor
        return (
            {"rer_kcal_day": rer_value, "activity_factor": activity_factor, "mer_kcal_day": mer_value},
            "MER = RER × activity_factor.",
            "Используйте как ориентир, финальные нутритивные решения — по клинической оценке.",
        )

    if calc_id == "anesthesia_dose":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        dose_min = _parse_float(inputs, "dose_min_mg_per_kg", min_value=0.01)
        dose_max = _parse_float(inputs, "dose_max_mg_per_kg", min_value=dose_min)
        concentration = _parse_float(inputs, "concentration_mg_per_ml", min_value=0.01)
        total_min_mg = weight_kg * dose_min
        total_max_mg = weight_kg * dose_max
        volume_min_ml = total_min_mg / concentration
        volume_max_ml = total_max_mg / concentration
        return (
            {
                "total_min_mg": total_min_mg,
                "total_max_mg": total_max_mg,
                "volume_min_ml": volume_min_ml,
                "volume_max_ml": volume_max_ml,
            },
            "Диапазон рассчитан по min/max дозе и концентрации препарата.",
            "Справочный диапазон. Анестезиологическое решение принимает ветеринарный врач.",
        )

    if calc_id == "body_surface_area":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        bsa = 10.1 * (weight_kg ** (2 / 3)) / 100
        return (
            {"weight_kg": weight_kg, "bsa_m2": bsa},
            "Формула BSA = 10.1 × weight^(2/3) / 100.",
            "Используйте результат как справочное значение.",
        )

    if calc_id == "dehydration_deficit":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        dehydration_percent = _parse_float(inputs, "dehydration_percent", min_value=0, max_value=20)
        deficit_ml = weight_kg * dehydration_percent * 10
        return (
            {"dehydration_deficit_ml": deficit_ml},
            "Дефицит жидкости рассчитан по весу и проценту дегидратации.",
            "Справочный расчёт. Коррекцию проводит врач по клиническим данным.",
        )

    if calc_id == "blood_transfusion":
        species = str(inputs.get("species", "dog")).lower()
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        patient_pcv = _parse_float(inputs, "patient_pcv", min_value=1, max_value=80)
        desired_pcv = _parse_float(inputs, "desired_pcv", min_value=1, max_value=80)
        donor_pcv = _parse_float(inputs, "donor_pcv", min_value=1, max_value=80)
        species_constant = 90 if species == "dog" else 60 if species == "cat" else 70
        volume_ml = weight_kg * species_constant * (desired_pcv - patient_pcv) / donor_pcv
        return (
            {
                "species_constant_ml_per_kg": species_constant,
                "estimated_transfusion_volume_ml": max(volume_ml, 0),
            },
            "Оценка объёма выполнена по формуле с учётом PCV пациента и донора.",
            "Справочный расчёт. Трансфузионная тактика определяется врачом.",
        )

    if calc_id == "heart_rate_range":
        species = str(inputs.get("species", "dog")).lower()
        stage = str(inputs.get("life_stage", "adult")).lower()
        ranges = {
            ("dog", "young"): (90, 180),
            ("dog", "adult"): (60, 140),
            ("dog", "senior"): (55, 130),
            ("cat", "young"): (140, 240),
            ("cat", "adult"): (120, 220),
            ("cat", "senior"): (110, 210),
        }
        low, high = ranges.get((species, stage), (60, 180))
        return (
            {"species": species, "life_stage": stage, "heart_rate_min_bpm": low, "heart_rate_max_bpm": high},
            "Диапазон является ориентировочным и зависит от клинического контекста.",
            "Используйте только как справочный интервал.",
        )

    if calc_id == "respiratory_rate_range":
        species = str(inputs.get("species", "dog")).lower()
        stage = str(inputs.get("life_stage", "adult")).lower()
        ranges = {
            ("dog", "young"): (18, 36),
            ("dog", "adult"): (10, 30),
            ("dog", "senior"): (12, 32),
            ("cat", "young"): (20, 40),
            ("cat", "adult"): (16, 32),
            ("cat", "senior"): (18, 34),
        }
        low, high = ranges.get((species, stage), (12, 32))
        return (
            {"species": species, "life_stage": stage, "resp_rate_min": low, "resp_rate_max": high},
            "Диапазон ЧДД рассчитан как справочный референс.",
            "При симптомах дыхательной недостаточности требуется срочная очная оценка.",
        )

    if calc_id == "age_conversion":
        species = str(inputs.get("species", "dog")).lower()
        pet_age = _parse_float(inputs, "pet_age_years", min_value=0, max_value=35)
        if species in {"dog", "cat"}:
            if pet_age <= 1:
                human_age = 15 * pet_age
            elif pet_age <= 2:
                human_age = 15 + 9 * (pet_age - 1)
            else:
                k = 5 if species == "dog" else 4
                human_age = 24 + (pet_age - 2) * k
        else:
            human_age = pet_age * 6
        return (
            {"species": species, "pet_age_years": pet_age, "estimated_human_years": human_age},
            "Эквивалент возраста рассчитан по упрощённой модели.",
            "Результат ориентировочный и не используется как медицинское заключение.",
        )

    if calc_id == "condition_index":
        weight_kg = _parse_float(inputs, "weight_kg", min_value=0.1)
        body_length_cm = _parse_float(inputs, "body_length_cm", min_value=10)
        length_m = body_length_cm / 100
        index = weight_kg / (length_m**2)
        if index < 18:
            category = "Низкий индекс"
        elif index <= 28:
            category = "Целевой диапазон"
        else:
            category = "Повышенный индекс"
        return (
            {"condition_index": index, "category": category},
            "Индекс рассчитан по весу и длине тела для ориентировочной оценки кондиции.",
            "Индекс не заменяет очную оценку body condition score врачом.",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "CALCULATOR_NOT_FOUND", "message": "Calculator not found"},
    )


@router.get("")
async def list_calculators(current_user=Depends(get_current_user)) -> dict[str, Any]:
    items = []
    for calc in _calc_catalog():
        row = dict(calc)
        row["available"] = current_user.role.value in row.get("allowed_roles", [])
        items.append(row)
    return {"count": len(items), "items": items}


@router.post("/run")
async def run_calculator(
    payload: RunCalculatorPayload,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    selected = next((item for item in _calc_catalog() if item["id"] == payload.calculator_id), None)
    if not selected:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CALCULATOR_NOT_FOUND", "message": "Calculator not found"},
        )

    if current_user.role.value not in selected.get("allowed_roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Calculator is not available for this role"},
        )

    result, explanation, warning = _run_calculation(selected["id"], payload.inputs or {})

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="calculator.run",
        target_type="calculator",
        target_id=selected["id"],
        metadata={"calculator_id": selected["id"], "role": current_user.role.value},
    )
    await db.commit()

    return {
        "calculator_id": selected["id"],
        "calculator_name": selected["name"],
        "result": result,
        "explanation": explanation,
        "warning": warning,
    }
