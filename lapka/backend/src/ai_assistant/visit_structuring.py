"""Visit structuring from transcript. Uses LLM when available, else rule-based."""

from __future__ import annotations

import json
import re
from typing import Any

from src.ai import get_provider


def _take_sentence(text: str, fallback: str) -> str:
    tokens = [part.strip() for part in re.split(r"[.!?]\s+", text.strip()) if part.strip()]
    return tokens[0] if tokens else fallback


def _rule_based_structure(normalized: str, first_sentence: str, patient_id: str) -> dict[str, Any]:
    return {
        "patient_id": patient_id,
        "complaints": first_sentence,
        "history": "Уточнить длительность симптомов, динамику и факторы риска по анамнезу.",
        "physical_exam": "Заполнить клинический осмотр: T, ЧСС, дыхание, слизистые, гидратация, боль.",
        "diagnostics": "Сформировать диагностический план по протоколу клиники и данным осмотра.",
        "assessment": "Клиническая оценка состояния (без автоматического диагноза).",
        "plan": "План ведения и наблюдения определяется ветеринарным врачом.",
        "follow_up": "Назначить контроль и критерии повторного обращения.",
    }


def structure_visit_from_transcript(transcript_text: str, patient_id: str) -> dict[str, Any]:
    normalized = (transcript_text or "").strip()
    if not normalized:
        normalized = "Жалобы озвучены владельцем, требуется уточнение на приёме."
    first_sentence = _take_sentence(normalized, "Требуется уточнение жалоб.")

    provider = get_provider()
    if provider.is_available():
        system = (
            "You are a veterinary clinical assistant. Extract structured SOAP-like fields from the transcript. "
            "Return valid JSON only: complaints, history, physical_exam, diagnostics, assessment, plan, follow_up. "
            "Never prescribe treatment or dosage. Keep responses brief."
        )
        prompt = f"Transcript: {normalized[:1500]}\n\nExtract clinical fields as JSON."
        out = provider.complete(prompt, system=system, max_tokens=800)
        if out:
            try:
                # Try to parse JSON and merge
                parsed = json.loads(out)
                if isinstance(parsed, dict):
                    base = _rule_based_structure(normalized, first_sentence, patient_id)
                    for k in ("complaints", "history", "physical_exam", "diagnostics", "assessment", "plan", "follow_up"):
                        if k in parsed and isinstance(parsed[k], str) and parsed[k].strip():
                            base[k] = parsed[k].strip()[:500]
                    return base
            except (json.JSONDecodeError, TypeError):
                pass

    return _rule_based_structure(normalized, first_sentence, patient_id)
