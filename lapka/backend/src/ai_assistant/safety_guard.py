from __future__ import annotations

import json
from typing import Any

SAFE_MESSAGE = "Consult a veterinarian for medical decisions."

OWNER_DISALLOWED_PATTERNS = [
    "что дать",
    "какую таблетку",
    "какую дозу",
    "дозировка",
    "сделать укол",
    "what drug",
    "what dose",
    "how much mg",
    "give injection",
    "treatment steps",
]

DIAGNOSIS_CLAIM_PATTERNS = [
    "точный диагноз",
    "confirmed diagnosis",
    "definitive diagnosis",
    "это точно",
]


def _to_text(payload: Any) -> str:
    if isinstance(payload, str):
        return payload.lower()
    try:
        return json.dumps(payload, ensure_ascii=False).lower()
    except Exception:
        return str(payload).lower()


def has_owner_policy_violation(text: str) -> bool:
    txt = (text or "").lower()
    return any(pattern in txt for pattern in OWNER_DISALLOWED_PATTERNS)


def apply_safety_guard(payload: dict[str, Any], *, role: str, vet_context: bool, mode: str) -> dict[str, Any]:
    serialized = _to_text(payload)

    if role != "vet":
        if any(pattern in serialized for pattern in OWNER_DISALLOWED_PATTERNS):
            return {"message": SAFE_MESSAGE, "blocked": True, "mode": mode}

    if not vet_context and any(pattern in serialized for pattern in DIAGNOSIS_CLAIM_PATTERNS):
        return {"message": SAFE_MESSAGE, "blocked": True, "mode": mode}

    safe_payload = dict(payload)
    safe_payload.setdefault("safety_notice", SAFE_MESSAGE)
    safe_payload.setdefault("blocked", False)
    return safe_payload
