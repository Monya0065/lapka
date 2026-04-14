from __future__ import annotations

from functools import lru_cache
from typing import Any

from src.services.catalog import get_symptoms

RED_FLAGS = {
    "судороги",
    "затрудненное дыхание",
    "тяжело дышит",
    "тяжёлое дыхание",
    "одышка",
    "сильная одышка",
    "не может дышать",
    "задыхается",
    "удушье",
    "потеря сознания",
    "сильное кровотечение",
    "подозрение на отравление",
    "травма",
    "травма головы",
    "температура > 41",
    "сильная вялость",
    "повторная рвота",
    "вздутие живота",
    "сильная боль",
    "паралич",
    "коллапс",
    "тепловой удар",
    "невозможность мочеиспускания",
    "сильное обезвоживание",
    "seizures",
    "loss of consciousness",
    "severe bleeding",
    "breathing difficulty",
    "labored breathing",
    "trouble breathing",
    "shortness of breath",
    "suspected poisoning",
    "heat stroke",
    "severe trauma",
    "collapse",
    "inability to urinate",
    "severe dehydration",
}

DISALLOWED_OWNER_PATTERNS = [
    "что дать",
    "какую таблетку",
    "какую дозу",
    "сделать укол",
    "дозировка",
    "сколько мг",
    "какой антибиотик",
    "как лечить дома",
    "what should i give",
    "what drug",
    "what medicine",
    "what dose",
    "how much mg",
    "can i inject",
    "give injection",
    "treatment steps",
]


@lru_cache(maxsize=1)
def _symptom_catalog() -> dict[str, dict[str, Any]]:
    return {str(row.get("id")): row for row in get_symptoms()}


def has_policy_violation(text: str) -> bool:
    txt = (text or "").lower()
    return any(p in txt for p in DISALLOWED_OWNER_PATTERNS)


def triage(
    symptom_text: str,
    selected_symptoms: list[str],
    selected_names: list[str] | None = None,
    *,
    duration_hours: float | None = None,
    animal_type: str | None = None,
    age_years: float | None = None,
    severity_indicators: list[str] | None = None,
) -> dict[str, Any]:
    txt = (symptom_text or "").lower()
    selected_values = [str(item).lower() for item in (selected_symptoms or [])]
    names = [n.lower() for n in (selected_names or [])]
    indicators = [i.lower() for i in (severity_indicators or [])]
    all_text = " ".join([txt] + selected_values + names + indicators)

    catalog = _symptom_catalog()
    red_from_catalog = []
    for item in selected_symptoms or []:
        row = catalog.get(str(item))
        if row and bool(row.get("red_flag")):
            red_from_catalog.append(str(row.get("name") or item))

    red_detected = [flag for flag in RED_FLAGS if flag in all_text]
    red_detected.extend(red_from_catalog)

    prepare_base = [
        "Кратко запишите, когда начались симптомы и как они менялись.",
        "Подготовьте список текущих лекарств и недавних процедур.",
        "Возьмите последние документы и результаты анализов, если они есть.",
    ]
    prepare_red = prepare_base + [
        "Организуйте немедленный выезд в клинику и безопасную переноску питомца.",
    ]
    prepare_yellow = prepare_base + [
        "Снимите короткое видео симптомов, если они проявляются эпизодически.",
    ]
    prepare_green = [
        "Ведите наблюдение 12-24 часа: аппетит, вода, активность, стул/мочеиспускание.",
        "Если появятся красные флаги, сразу обращайтесь в клинику.",
    ]

    if red_detected:
        return {
            "level": "RED",
            "red_flags_detected": sorted(set(red_detected)),
            "key_reasons": ["Обнаружены красные флаги."],
            "questions_to_ask": ["Когда началось состояние?", "Есть ли ухудшение?"],
            "next_steps": ["Немедленно обратиться в ветеринарную клинику."],
            "what_to_prepare_for_visit": prepare_red,
            "disclaimer": "AI не ставит диагноз и не назначает лечение.",
        }

    yellow_markers = ["рвота", "диар", "вял", "кашель", "боль", "температур", "отказ от еды", "anorexia", "vomit"]
    score = 0

    if any(m in all_text for m in yellow_markers):
        score += 2
    if len(selected_symptoms) >= 3:
        score += 1
    if duration_hours is not None and duration_hours >= 24:
        score += 1
    if any(k in all_text for k in ("умеренная", "moderate", "persistent")):
        score += 1
    if animal_type and animal_type.strip().lower() in {"котенок", "щенок", "kitten", "puppy"}:
        score += 1
    if age_years is not None and age_years >= 10:
        score += 1

    if score >= 2:
        return {
            "level": "YELLOW",
            "red_flags_detected": [],
            "key_reasons": ["Симптомы требуют осмотра ветеринаром в ближайшее время."],
            "questions_to_ask": ["Есть ли динамика за последние 6-12 часов?", "Пьет ли питомец воду?"],
            "next_steps": ["Запишитесь на прием к ветеринару в течение 24 часов."],
            "what_to_prepare_for_visit": prepare_yellow,
            "disclaimer": "AI не ставит диагноз и не назначает лечение.",
        }

    return {
        "level": "GREEN",
        "red_flags_detected": [],
        "key_reasons": ["Критичных признаков не обнаружено по введенным данным."],
        "questions_to_ask": ["Сохраняется ли симптом?", "Есть ли новые проявления?"],
        "next_steps": ["Наблюдайте состояние. При ухудшении обратитесь в клинику."],
        "what_to_prepare_for_visit": prepare_green,
        "disclaimer": "AI не ставит диагноз и не назначает лечение.",
    }


def explain_document(doc_type: str, notes: str | None = None) -> dict[str, Any]:
    return {
        "doc_type": doc_type,
        "high_level_summary": "Документ распознан и представлен в понятной форме без клинических назначений.",
        "items_seen": ["Основные показатели", "Дата и тип исследования"],
        "flags": ["Проверьте отклонения от референсов лаборатории"],
        "questions_for_vet": [
            "Какие отклонения клинически значимы для моего питомца?",
            "Нужен ли контрольный анализ в динамике?",
        ],
        "what_not_to_do": ["Не начинать самолечение без консультации ветеринара."],
        "disclaimer": "This explanation does not replace a veterinarian.",
    }


def structure_notes(raw_text: str) -> dict[str, Any]:
    text = (raw_text or "").strip()
    base = {
        "structured_note": {
            "complaints": text[:220] or "Не заполнено",
            "anamnesis": "Уточнить длительность, динамику и факторы риска.",
            "exam": "Заполнить результаты клинического осмотра.",
            "assessment": "Возможные направления для дифдиагноза (не диагноз как факт).",
            "plan": "Сформировать диагностический план по протоколу клиники.",
        },
        "missing_fields": ["вес", "аллергии", "план контроля"],
        "suggested_questions": ["Когда начались симптомы?", "Изменился ли аппетит?"],
        "safety_notes": ["Не использовать как замену клиническому решению врача."],
        "disclaimer": "AI не ставит диагноз и не назначает лечение.",
    }
    try:
        from src.ai import get_provider

        provider = get_provider()
        if provider.is_available() and text:
            system = "Extract SOAP-like fields from clinical note. Return JSON: complaints, anamnesis, exam, assessment, plan. Never prescribe."
            prompt = f"Note: {text[:1200]}\n\nExtract as JSON."
            out = provider.complete(prompt, system=system, max_tokens=600)
            if out:
                import json

                parsed = json.loads(out)
                if isinstance(parsed, dict):
                    for k in ("complaints", "anamnesis", "exam", "assessment", "plan"):
                        if k in parsed and isinstance(parsed[k], str) and parsed[k].strip():
                            base["structured_note"][k] = parsed[k].strip()[:400]
    except Exception:
        pass
    return base


def protocol_completeness(visit: dict[str, Any]) -> dict[str, Any]:
    missing = []
    for field in ["chief_complaint", "exam_findings", "plan_note"]:
        if not str(visit.get(field, "") or "").strip():
            missing.append(field)
    status = "ok" if not missing else "incomplete"
    return {"missing_fields": missing, "status": status}


def summarize_visit(visit: dict[str, Any]) -> dict[str, Any]:
    """Return a lightweight summary of a visit for vet review.

    This is a placeholder implementation; real logic may call an LLM or
    more sophisticated rule-based summarizer. It must remain safe and
    never return treatment instructions to an owner.
    """
    # simple summary using a few known fields, fall back gracefully
    date = visit.get("date") or visit.get("created_at") or "unknown date"
    pet = visit.get("pet_name") or visit.get("pet_id") or "unknown pet"
    complaint = visit.get("chief_complaint") or "(no chief complaint provided)"
    return {
        "summary": f"Visit for {pet} on {date}",
        "chief_complaint": complaint,
        "notes_preview": (visit.get("assessment_note") or "")[:200],
        "disclaimer": "This summary is for veterinary use only and not a substitute for clinical judgement.",
    }
