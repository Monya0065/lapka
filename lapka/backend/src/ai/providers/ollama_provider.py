"""Local Ollama HTTP API — no cloud key; run `ollama serve` and pull a model (e.g. llama3.2)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from src.ai.providers.base import LLMProvider
from src.core.config import get_settings


class OllamaProvider(LLMProvider):
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        settings = get_settings()
        self._base = (
            base_url or settings.ollama_base_url or os.environ.get("OLLAMA_BASE_URL") or ""
        ).rstrip("/")
        self._model = (model or settings.ollama_model or os.environ.get("OLLAMA_MODEL") or "llama3.2").strip()

    def is_available(self) -> bool:
        return bool(self._base.startswith("http") and self._model)

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> str:
        if not self.is_available():
            return ""
        url = f"{self._base}/api/chat"
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        body = json.dumps(
            {
                "model": self._model,
                "messages": messages,
                "stream": False,
                "options": {"num_predict": max_tokens},
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            return ""
        msg = data.get("message") if isinstance(data, dict) else None
        if isinstance(msg, dict):
            content = msg.get("content")
            if isinstance(content, str):
                return content.strip()
        return ""
