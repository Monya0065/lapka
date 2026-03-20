"""Provider registry: resolves LLM provider from environment."""

from __future__ import annotations

from src.ai.providers.base import LLMProvider
from src.ai.providers.noop import NoOpProvider

_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    """Return the configured LLM provider. Default: NoOpProvider."""
    global _provider
    if _provider is not None:
        return _provider
    _provider = _resolve_provider()
    return _provider


def _resolve_provider() -> LLMProvider:
    import os

    name = (os.environ.get("LLM_PROVIDER") or "noop").lower().strip()
    if name == "openai":
        try:
            from src.ai.providers.openai_provider import OpenAIProvider

            p = OpenAIProvider()
            if p.is_available():
                return p
        except ImportError:
            pass
    return NoOpProvider()
