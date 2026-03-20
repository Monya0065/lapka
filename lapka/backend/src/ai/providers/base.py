"""LLM provider interface for Lapka AI features."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Abstract interface for LLM completion.

    Implementations must be safe: never return treatment instructions
    or dosages to owners. Safety guard is applied at service layer.
    """

    @abstractmethod
    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> str:
        """Generate text completion. Returns empty string on failure."""
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Whether this provider can make requests (e.g. API key configured)."""
        ...

    def complete_structured(self, prompt: str, system: str | None = None) -> dict[str, Any]:
        """Optional: structured output. Default returns {'text': complete(...)}."""
        text = self.complete(prompt, system=system)
        return {"text": text} if text else {"text": "", "error": "No response"}
