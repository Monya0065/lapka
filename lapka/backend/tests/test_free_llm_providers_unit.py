"""Unit tests for Groq / Ollama LLM providers (no network)."""

from __future__ import annotations

import pytest

from src.ai.providers.groq_provider import GroqProvider, _normalize_groq_api_key
from src.ai.providers.ollama_provider import OllamaProvider
from src.ai.providers.yandexgpt_provider import YandexGPTProvider


def test_normalize_groq_api_key_strips_bearer_prefix() -> None:
    assert _normalize_groq_api_key("Bearer gsk_abc").startswith("gsk_")


def test_groq_provider_not_available_without_real_key() -> None:
    p = GroqProvider(api_key="short")
    assert p.is_available() is False


def test_groq_provider_available_with_long_key() -> None:
    p = GroqProvider(api_key="gsk_" + "x" * 40, model="llama-3.3-70b-versatile")
    assert p.is_available() is True


def test_ollama_provider_not_available_without_base_url() -> None:
    p = OllamaProvider(base_url="", model="llama3.2")
    assert p.is_available() is False


def test_ollama_provider_available_with_http_base() -> None:
    p = OllamaProvider(base_url="http://127.0.0.1:11434", model="llama3.2")
    assert p.is_available() is True


def test_yandexgpt_not_available_without_folder() -> None:
    p = YandexGPTProvider(api_key="AQVN" + "x" * 20, folder_id="", model="yandexgpt-lite/latest")
    assert p.is_available() is False


def test_yandexgpt_available_with_api_key_and_folder() -> None:
    p = YandexGPTProvider(
        api_key="AQVN" + "x" * 20,
        folder_id="b1g" + "x" * 29,
        model="yandexgpt-lite/latest",
    )
    assert p.is_available() is True


def test_yandexgpt_available_with_iam_and_folder() -> None:
    p = YandexGPTProvider(
        api_key="",
        folder_id="b1g" + "x" * 29,
        iam_token="t1." + "y" * 25,
    )
    assert p.is_available() is True


@pytest.mark.parametrize(
    "primary,fallback",
    [
        ("yandexgpt", "noop"),
        ("groq", "noop"),
        ("ollama", "noop"),
        ("openai", "groq"),
    ],
)
def test_registry_resolves_noop_when_primary_unconfigured(
    primary: str, fallback: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    import src.ai.providers.registry as reg_mod
    from src.ai.providers.noop import NoOpProvider
    from src.ai.providers.registry import get_provider
    from src.core.config import get_settings

    monkeypatch.setenv("LLM_PROVIDER", primary)
    monkeypatch.setenv("LLM_FALLBACK_PROVIDER", fallback)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
    reg_mod._provider = None
    get_settings.cache_clear()
    p = get_provider()
    assert isinstance(p, NoOpProvider)
    reg_mod._provider = None
    get_settings.cache_clear()
