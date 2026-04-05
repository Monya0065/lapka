"""AI provider abstraction for Lapka.

Supports pluggable LLM backends. Default is rule-based (noop).
Set LLM_PROVIDER=openai and OPENAI_API_KEY for OpenAI integration.
"""

from src.ai.providers.base import LLMProvider
from src.ai.providers.registry import get_provider

__all__ = ["LLMProvider", "get_provider"]
