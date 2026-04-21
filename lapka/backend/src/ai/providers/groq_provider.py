"""Groq Cloud LLM — OpenAI-compatible API, free tier (see https://console.groq.com/)."""

from __future__ import annotations

import logging
import os

from src.ai.providers.base import LLMProvider
from src.core.config import get_settings

logger = logging.getLogger(__name__)

GROQ_OPENAI_BASE = "https://api.groq.com/openai/v1"


def _normalize_groq_api_key(raw: str) -> str:
    key = (raw or "").strip()
    if key.lower().startswith("bearer "):
        key = key[7:].strip()
    return key


class GroqProvider(LLMProvider):
    """Uses official OpenAI Python SDK with Groq base_url."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self._api_key = _normalize_groq_api_key(
            api_key or settings.groq_api_key or os.environ.get("GROQ_API_KEY") or ""
        )
        self._model = (
            model or settings.groq_model or os.environ.get("GROQ_MODEL") or "llama-3.3-70b-versatile"
        ).strip()

    def is_available(self) -> bool:
        return bool(self._api_key and len(self._api_key) > 10)

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> str:
        if not self.is_available():
            return ""
        try:
            from openai import APIStatusError, OpenAI

            client = OpenAI(api_key=self._api_key, base_url=GROQ_OPENAI_BASE)
            messages: list[dict[str, str]] = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            resp = client.chat.completions.create(
                model=self._model,
                messages=messages,
                max_tokens=max_tokens,
            )
            if resp.choices:
                return (resp.choices[0].message.content or "").strip()
        except APIStatusError as exc:
            body = getattr(exc, "body", None) or str(exc)
            if exc.status_code == 403:
                logger.warning(
                    "Groq API 403 Forbidden (%s). GroqCloud is not served from several regions "
                    "(including Russia, China, Iran, DPRK, Syria, Cuba). Use LLM_PROVIDER=ollama, "
                    "OpenAI, or call Groq from an allowed network. Docs: https://community.groq.com/",
                    body,
                )
            else:
                logger.warning("Groq API error HTTP %s: %s", exc.status_code, body)
        except Exception as exc:
            logger.warning("Groq request failed: %s", exc, exc_info=logger.isEnabledFor(logging.DEBUG))
        return ""
