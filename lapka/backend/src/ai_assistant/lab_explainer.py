"""Lab text explanation. Uses LLM when available, else template."""

from __future__ import annotations

from typing import Any

from src.ai import get_provider


def _template_explain(lab_text: str, species: str) -> dict[str, Any]:
    short = lab_text[:220] if lab_text else "Лабораторный документ передан без подробного текста."
    species_safe = (species or "").strip().lower() or "пациента"
    return {
        "summary": f"Получены лабораторные данные для {species_safe}. Выделены ключевые параметры и отклонения из текста.",
        "possible_meaning": "Результаты могут отражать воспалительный/метаболический процесс и требуют клинической интерпретации врачом.",
        "questions_for_vet": [
            "Какие показатели являются клинически значимыми в текущем контексте?",
            "Нужна ли повторная сдача анализов в динамике?",
            "Как эти результаты соотносятся с жалобами и осмотром?",
        ],
        "source_excerpt": short,
        "disclaimer": "This explanation does not replace a veterinarian.",
    }


def explain_lab_text(lab_text: str, species: str) -> dict[str, Any]:
    text = (lab_text or "").strip()
    if not text:
        return _template_explain("", species)

    provider = get_provider()
    if provider.is_available():
        system = (
            "You are a veterinary lab interpretation assistant. Summarize lab results for the vet. "
            "Never prescribe treatment or dosage. Keep summary concise."
        )
        prompt = f"Species: {species or 'unknown'}. Lab text: {text[:1200]}\n\nProvide brief summary and questions for vet."
        out = provider.complete(prompt, system=system, max_tokens=400)
        if out:
            base = _template_explain(text, species)
            base["summary"] = out[:600]
            return base

    return _template_explain(text, species)
