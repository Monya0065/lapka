"""AI provider abstraction for Lapka.

Supports pluggable LLM backends. Default is rule-based (noop).

Examples:
- `LLM_PROVIDER=yandexgpt` + `YANDEX_CLOUD_API_KEY` + `YANDEX_CLOUD_FOLDER_ID` (Yandex Cloud, RU-friendly)
- `LLM_PROVIDER=groq` + `GROQ_API_KEY` (not available from Russia)
- `LLM_PROVIDER=ollama` + `OLLAMA_BASE_URL=http://127.0.0.1:11434` (local, no key)
- `LLM_PROVIDER=openai` + `OPENAI_API_KEY`
"""

from src.ai.providers.base import LLMProvider
from src.ai.providers.registry import get_provider

__all__ = ["LLMProvider", "get_provider"]
