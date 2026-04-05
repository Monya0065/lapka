from __future__ import annotations

from src.core.config import get_settings
from src.integrations.pharmacy_providers.base import PharmacyProvider
from src.integrations.pharmacy_providers.demo_provider import DemoPharmacyProvider


_PROVIDERS: dict[str, PharmacyProvider] = {
    "demo": DemoPharmacyProvider(),
}


def get_pharmacy_provider() -> PharmacyProvider:
    settings = get_settings()
    provider_key = (settings.pharmacy_provider or "demo").strip().lower()
    return _PROVIDERS.get(provider_key, _PROVIDERS["demo"])
