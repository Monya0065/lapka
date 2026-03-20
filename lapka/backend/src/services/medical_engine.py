from __future__ import annotations

from functools import lru_cache
from typing import Any

from src.services.ai_safe import triage
from src.services.catalog import get_diseases, get_drugs, get_symptoms, search_diseases, search_drugs, search_symptoms

_SYMPTOM_CATEGORY_ALIASES = {
    "general condition": "общее состояние",
    "respiratory": "дыхание",
    "cardiovascular": "общее состояние",
    "neurological": "неврология",
    "gastrointestinal": "ЖКТ",
    "urinary": "мочевыделительная",
    "dermatology": "кожа/шерсть",
    "trauma": "травмы",
    "poisoning": "отравления",
    "reproductive": "репродуктивная система",
    "eyes": "глаза",
    "ears": "уши",
    "musculoskeletal": "травмы",
}

_REQUIRED_SYMPTOM_CATEGORIES = [
    "general condition",
    "respiratory",
    "cardiovascular",
    "neurological",
    "gastrointestinal",
    "urinary",
    "dermatology",
    "trauma",
    "poisoning",
    "reproductive",
    "eyes",
    "ears",
    "musculoskeletal",
]

_DISEASE_CATEGORY_ALIASES = {
    "infectious": "инфекционные",
    "parasitic": "паразитарные",
    "neurological": "неврологические",
    "cardiovascular": "кардиологические",
    "gastrointestinal": "гастроэнтерология",
    "dermatology": "дерматология",
    "orthopedics": "ортопедия",
    "oncology": "онкология",
    "endocrinology": "эндокринология",
    "toxicology": "токсикология",
    "ophthalmology": "офтальмология",
    "otology": "отология",
}

_SEVERITY_MAP = {
    "low": ["mild", "intermittent", "single episode", "home observation possible"],
    "medium": ["persistent", "moderate discomfort", "requires clinical assessment"],
    "high": ["severe", "progressive", "significant functional decline"],
    "critical": ["life threatening", "emergency", "immediate clinic visit"],
}

_DIAGNOSTIC_BY_CATEGORY = {
    "инфекционные": ["ПЦР/экспресс-тест по показаниям", "Общий анализ крови", "Клинический осмотр"],
    "паразитарные": ["Микроскопия/паразитология", "Клинический осмотр", "Анализ кала по показаниям"],
    "неврологические": ["Неврологический осмотр", "Визуальная диагностика по показаниям", "Лабораторный скрининг"],
    "кардиологические": ["Аускультация", "ЭхоКГ по показаниям", "ЭКГ по показаниям"],
    "гастроэнтерология": ["ОАК/биохимия", "УЗИ брюшной полости", "Клинический осмотр"],
    "дерматология": ["Дерматологический осмотр", "Цитология/соскоб", "Микробиология по показаниям"],
    "ортопедия": ["Ортопедический осмотр", "Рентген по показаниям", "Оценка походки"],
    "онкология": ["Цитология/гистология по показаниям", "Визуальная диагностика", "Лабораторный скрининг"],
    "эндокринология": ["Гормональные тесты по показаниям", "ОАК/биохимия", "Анализ мочи"],
    "токсикология": ["Токсикологический анамнез", "Лабораторный скрининг", "Мониторинг жизненных показателей"],
    "офтальмология": ["Офтальмологический осмотр", "Флюоресцеиновая проба по показаниям", "Тонометрия по показаниям"],
    "отология": ["Отоскопия", "Цитология ушного содержимого", "Микробиология по показаниям"],
}


def normalize_symptom_category(category: str | None) -> str | None:
    if not category:
        return None
    normalized = category.strip().lower()
    return _SYMPTOM_CATEGORY_ALIASES.get(normalized, category)


def symptom_categories() -> list[dict[str, str]]:
    return [{"name": name, "mapped_to": _SYMPTOM_CATEGORY_ALIASES.get(name, name)} for name in _REQUIRED_SYMPTOM_CATEGORIES]


def normalize_disease_category(category: str | None) -> str | None:
    if not category:
        return None
    normalized = category.strip().lower()
    return _DISEASE_CATEGORY_ALIASES.get(normalized, category)


def _severity_indicators_from_symptom(symptom: dict[str, Any]) -> dict[str, Any]:
    row = dict(symptom)
    if row.get("red_flag"):
        severity = "critical"
    else:
        name = str(row.get("name", "")).lower()
        if any(k in name for k in ("боль", "рвота", "одыш", "кашель", "диар")):
            severity = "medium"
        else:
            severity = "low"
    row["severity_indicators"] = _SEVERITY_MAP[severity]
    return row


def symptom_dataset(q: str | None, category: str | None, red_flag: bool | None, limit: int = 200) -> list[dict[str, Any]]:
    mapped_category = normalize_symptom_category(category)
    rows = search_symptoms(q=q, category=mapped_category, red_flag=red_flag, limit=limit)
    return [_severity_indicators_from_symptom(row) for row in rows]


@lru_cache(maxsize=1)
def _symptom_by_id() -> dict[str, dict[str, Any]]:
    return {str(r.get("id")): r for r in get_symptoms()}


def red_flag_library() -> list[dict[str, Any]]:
    rows = [r for r in get_symptoms() if bool(r.get("red_flag"))]
    return [_severity_indicators_from_symptom(r) for r in rows]


def run_triage(
    *,
    symptom_text: str,
    symptom_ids: list[str] | None,
    symptom_names: list[str] | None,
    duration_hours: float | None,
    animal_type: str | None,
    age_years: float | None,
    severity_indicators: list[str] | None,
) -> dict[str, Any]:
    by_id = _symptom_by_id()
    selected_ids = [s for s in (symptom_ids or []) if s in by_id]
    selected_red_flags = [s for s in selected_ids if bool(by_id[s].get("red_flag", False))]
    selected_names_from_ids = [str(by_id[s].get("name", "")) for s in selected_ids]
    all_selected_names = list(selected_names_from_ids)
    if symptom_names:
        all_selected_names.extend(symptom_names)

    if selected_red_flags:
        return {
            "level": "RED",
            "red_flags_detected": [str(by_id[s].get("name", s)) for s in selected_red_flags],
            "key_reasons": ["Selected symptoms include emergency red flags."],
            "questions_to_ask": ["When did this start?", "Is the state getting worse now?"],
            "next_steps": ["Emergency clinic visit required immediately."],
            "disclaimer": "AI does not diagnose and does not prescribe treatment.",
            "matched_symptoms": [
                {"id": sid, "name": by_id[sid].get("name"), "red_flag": bool(by_id[sid].get("red_flag", False))}
                for sid in selected_ids
            ],
        }

    triage_result = triage(
        symptom_text,
        selected_ids,
        all_selected_names,
        duration_hours=duration_hours,
        animal_type=animal_type,
        age_years=age_years,
        severity_indicators=severity_indicators,
    )

    if selected_ids:
        triage_result["matched_symptoms"] = [
            {
                "id": sid,
                "name": by_id[sid].get("name"),
                "red_flag": bool(by_id[sid].get("red_flag", False)),
            }
            for sid in selected_ids
        ]
    return triage_result


def disease_dataset(q: str | None, category: str | None, species: str | None, limit: int = 200) -> list[dict[str, Any]]:
    mapped_category = normalize_disease_category(category)
    rows = search_diseases(q=q, category=mapped_category, species=species, limit=limit)
    out: list[dict[str, Any]] = []
    for row in rows:
        row_copy = dict(row)
        category_name = str(row_copy.get("category", "")).lower()
        row_copy["diagnostic_methods"] = _DIAGNOSTIC_BY_CATEGORY.get(
            category_name, ["Клинический осмотр", "Лабораторные исследования по показаниям"]
        )
        row_copy["treatment_category"] = "Назначается только ветеринарным врачом по клинической оценке."
        row_copy["prevention"] = "Профилактика по календарю и рекомендациям клиники."
        out.append(row_copy)
    return out


def medication_dataset(
    q: str | None,
    species: str | None,
    prescription_required: bool | None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    rows = search_drugs(q=q, species=species, prescription_required=prescription_required, limit=limit)
    out: list[dict[str, Any]] = []
    for row in rows:
        required = bool(row.get("prescription_required", False))
        out.append(
            {
                "id": row.get("id"),
                "name": row.get("name"),
                "active_substance": row.get("active_substance") or row.get("name"),
                "species": row.get("species", []),
                "dosage_range": row.get("dose_range_text")
                or row.get("dose_reference", {}).get("text")
                or "Дозировка определяется ветеринарным врачом.",
                "contraindications": row.get("contraindications", []),
                "side_effects": row.get("side_effects", []),
                "prescription_required": required,
                "warning": "Prescription required. Only veterinarian can prescribe."
                if required
                else "Reference only. Final decision belongs to veterinarian.",
                "raw": row,
            }
        )
    return out


def rer(weight_kg: float) -> dict[str, Any]:
    return {"formula": "RER = 70 * (weight_kg ^ 0.75)", "weight_kg": weight_kg, "rer_kcal_day": 70 * (weight_kg**0.75)}


def der(weight_kg: float, activity_factor: float) -> dict[str, Any]:
    rer_value = 70 * (weight_kg**0.75)
    return {
        "formula": "DER = RER * activity_factor",
        "weight_kg": weight_kg,
        "activity_factor": activity_factor,
        "rer_kcal_day": rer_value,
        "der_kcal_day": rer_value * activity_factor,
    }


def fluid_therapy(
    *,
    weight_kg: float,
    maintenance_ml_per_kg_day: float,
    duration_hr: float,
    dehydration_percent: float,
) -> dict[str, Any]:
    maintenance_ml = weight_kg * maintenance_ml_per_kg_day * (duration_hr / 24)
    dehydration_deficit_ml = weight_kg * dehydration_percent * 10
    total_fluid_ml = maintenance_ml + dehydration_deficit_ml
    rate_ml_per_hr = total_fluid_ml / duration_hr
    return {
        "maintenance_ml": maintenance_ml,
        "dehydration_deficit_ml": dehydration_deficit_ml,
        "total_fluid_ml": total_fluid_ml,
        "rate_ml_per_hr": rate_ml_per_hr,
    }


def drug_dosage(*, weight_kg: float, dose_mg_per_kg: float, concentration_mg_per_ml: float) -> dict[str, Any]:
    total_mg = weight_kg * dose_mg_per_kg
    volume_ml = total_mg / concentration_mg_per_ml
    return {"total_mg": total_mg, "volume_ml": volume_ml}


def transfusion(*, weight_kg: float, species_constant: float) -> dict[str, Any]:
    blood_volume = weight_kg * species_constant
    return {"blood_volume_ml": blood_volume}
