"""Yandex Cloud Foundation Models (YandexGPT) — доступ из РФ, ключ из консоли Yandex Cloud."""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

from src.ai.providers.base import LLMProvider
from src.core.config import get_settings

logger = logging.getLogger(__name__)

YANDEX_COMPLETION_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


class YandexGPTProvider(LLMProvider):
    """REST `completion` API (v1). Auth: `Api-Key` или краткоживший IAM (`Bearer`)."""

    def __init__(
        self,
        api_key: str | None = None,
        folder_id: str | None = None,
        model: str | None = None,
        iam_token: str | None = None,
    ) -> None:
        settings = get_settings()
        self._api_key = (api_key or settings.yandex_cloud_api_key or os.environ.get("YANDEX_CLOUD_API_KEY") or "").strip()
        self._folder_id = (folder_id or settings.yandex_cloud_folder_id or os.environ.get("YANDEX_CLOUD_FOLDER_ID") or "").strip()
        self._model = (
            model or settings.yandexgpt_model or os.environ.get("YANDEXGPT_MODEL") or "yandexgpt-lite/latest"
        ).strip()
        self._iam_token = (
            iam_token or settings.yandex_cloud_iam_token or os.environ.get("YANDEX_CLOUD_IAM_TOKEN") or ""
        ).strip()

    def is_available(self) -> bool:
        if not self._folder_id:
            return False
        if self._iam_token and len(self._iam_token) > 20:
            return True
        return bool(self._api_key and len(self._api_key) > 10)

    def complete(self, prompt: str, system: str | None = None, max_tokens: int = 1024) -> str:
        if not self.is_available():
            return ""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "text": system})
        messages.append({"role": "user", "text": prompt[:120_000]})

        model_uri = f"gpt://{self._folder_id}/{self._model}"
        body: dict[str, Any] = {
            "modelUri": model_uri,
            "completionOptions": {
                "stream": False,
                "temperature": 0.3,
                "maxTokens": str(max(1, min(max_tokens, 8000))),
            },
            "messages": messages,
        }
        headers: dict[str, str] = {
            "x-folder-id": self._folder_id,
            "Content-Type": "application/json",
        }
        if self._iam_token:
            headers["Authorization"] = f"Bearer {self._iam_token}"
        else:
            headers["Authorization"] = f"Api-Key {self._api_key}"

        try:
            resp = requests.post(
                YANDEX_COMPLETION_URL,
                json=body,
                headers=headers,
                timeout=120,
            )
            if resp.status_code != 200:
                logger.warning(
                    "YandexGPT HTTP %s: %s",
                    resp.status_code,
                    (resp.text or "")[:500],
                )
                return ""
            data = resp.json()
        except requests.RequestException as exc:
            logger.warning("YandexGPT request failed: %s", exc)
            return ""

        try:
            alts = data.get("result", {}).get("alternatives") or []
            if not alts:
                return ""
            msg = alts[0].get("message") or {}
            text = msg.get("text")
            if isinstance(text, str):
                return text.strip()
        except (TypeError, KeyError, IndexError):
            logger.warning("YandexGPT unexpected response shape: %s", str(data)[:300])
        return ""
