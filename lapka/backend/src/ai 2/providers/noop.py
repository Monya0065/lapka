"""Rule-based provider: no external LLM, returns empty or predefined responses."""

from __future__ import annotations

from src.ai.providers.base import LLMProvider


class NoOpProvider(LLMProvider):
    """Provider that does not call any external LLM.

    Used when no API key is configured or LLM_PROVIDER=noop.
    Service layer falls back to rule-based logic.
    """

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> str:
        return ""

    def is_available(self) -> bool:
        return True
