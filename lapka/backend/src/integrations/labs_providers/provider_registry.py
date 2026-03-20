from __future__ import annotations

from src.core.config import get_settings
from src.integrations.labs_providers.base import LabsProvider
from src.integrations.labs_providers.demo_provider import DemoLabsProvider


_PROVIDERS: dict[str, LabsProvider] = {
    "demo": DemoLabsProvider(),
}


def get_labs_provider() -> LabsProvider:
    settings = get_settings()
    provider_key = (settings.labs_provider or "demo").strip().lower()
    return _PROVIDERS.get(provider_key, _PROVIDERS["demo"])
