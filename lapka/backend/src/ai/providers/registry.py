"""Provider registry: resolves LLM provider from environment."""

from __future__ import annotations

from src.ai.providers.base import LLMProvider
from src.ai.providers.noop import NoOpProvider
from src.core.config import get_settings

_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    """Return the configured LLM provider. Default: NoOpProvider."""
    global _provider
    if _provider is not None:
        return _provider
    _provider = _resolve_provider()
    return _provider


def _resolve_provider() -> LLMProvider:
    settings = get_settings()
    primary = (settings.llm_provider or "noop").lower().strip()
    fallback = (settings.llm_fallback_provider or "noop").lower().strip()

    resolved = _try_provider(primary)
    if resolved is not None:
        return resolved

    resolved = _try_provider(fallback)
    if resolved is not None:
        return resolved

    return NoOpProvider()


def _try_provider(name: str) -> LLMProvider | None:
    if name in ("yandexgpt", "yandex"):
        try:
            from src.ai.providers.yandexgpt_provider import YandexGPTProvider

            provider = YandexGPTProvider()
            if provider.is_available():
                return provider
            return None
        except ImportError:
            return None
    if name == "groq":
        try:
            from src.ai.providers.groq_provider import GroqProvider

            provider = GroqProvider()
            if provider.is_available():
                return provider
            return None
        except ImportError:
            return None
    if name == "ollama":
        try:
            from src.ai.providers.ollama_provider import OllamaProvider

            provider = OllamaProvider()
            if provider.is_available():
                return provider
            return None
        except ImportError:
            return None
    if name == "openai":
        try:
            from src.ai.providers.openai_provider import OpenAIProvider

            provider = OpenAIProvider()
            if provider.is_available():
                return provider
            return None
        except ImportError:
            return None
    if name == "noop":
        return NoOpProvider()
    return None
