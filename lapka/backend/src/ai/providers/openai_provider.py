"""OpenAI provider for Lapka AI. Optional: requires openai package and OPENAI_API_KEY."""

from __future__ import annotations

import os

from src.ai.providers.base import LLMProvider


class OpenAIProvider(LLMProvider):
    """OpenAI API provider. Uses gpt-4o-mini by default for cost/speed balance."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
    ) -> None:
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY") or ""
        self._model = os.environ.get("OPENAI_MODEL") or model

    def is_available(self) -> bool:
        return bool(self._api_key and len(self._api_key) > 10)

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> str:
        if not self.is_available():
            return ""
        try:
            from openai import OpenAI

            client = OpenAI(api_key=self._api_key)
            messages = []
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
        except Exception:
            pass
        return ""
